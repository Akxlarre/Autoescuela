# Fix: Cuadratura — operaciones que fallan en silencio y corrompen saldos
> id: fix-044-i-cuadratura-operaciones-fallan-en-silencio
> refs: ASG-i-048
> status: done
> closed: 2026-10-10
> created: 2026-10-08

## Root Cause

[Heredado de ASG-i-048, a confirmar]: causa común: supabase-js **no lanza excepción** cuando una
query falla, devuelve `{ data, error }`. `cuadratura.facade.ts` solo tiene `try/catch` y nunca mira
`error`, así que el `catch` no se ejecuta y se muestra toast de éxito igual. Cinco puntos:

1. **`eliminarIngreso()` (secretaria)**: lee `enrollments`, hace UPDATE (`total_paid` baja,
   `pending_balance` sube; la secretaria sí puede) y recién después hace DELETE del pago, que la RLS
   solo permite al admin. El DELETE falla sin ruido: el pago queda y el saldo del alumno queda
   inflado. Son 3 operaciones sin transacción y con lectura-modificación-escritura desde el
   cliente. Las ramas `singular` y `special_service` tampoco revisan `error`.
2. **`eliminarEgreso()` (secretaria)**: el DELETE sobre `expenses` / `instructor_advances` lo
   bloquea la RLS y aun así avisa "Egreso eliminado correctamente".
3. **`cerrarCaja()`**: el `upsert` a `cash_closings` no revisa `error`; si falla igual avisa
   "Caja cerrada correctamente" y `resetArqueoState()` borra el arqueo contado.
4. **Caja cerrada sobrescribible**: el admin tiene UPDATE sin restricción sobre `cash_closings`
   (`onConflict: date,branch_id_key`); un segundo cierre o el autoguardado de una pestaña vieja
   pisa un cierre ya `closed`.
5. **Lecturas que fallan en silencio** (nota de b, 2026-10-07, fix-190-b caso X01): `fetchPayments()`
   y las demás lecturas de `fetchAll()` descartan `error` y aplican `data ?? []`;
   `refreshSilently()` traga todo. Sin red la Caja muestra $0 y "Caja Abierta" sin aviso, y
   `cerrarCaja()` guarda `totalIngresosHoy()` tal como está en pantalla: se puede cerrar el día en $0
   habiendo cobrado. El resto de pantallas con el mismo problema de lectura va en `ASG-b-102`.

**Paso 1, antes de tocar código:** confirmar cada punto con datos de prueba propios (registrar un
pago de prueba, eliminarlo como `secretaria@test.com`, revisar el saldo; revertir después). Los que
no se reproduzcan se cierran como "no aplica".

## Decisiones (2026-10-09, con Ignacio)

- **Quitar un pago de matrícula: solo admin, y se borra (opción A).** La UI de la secretaria no
  muestra el botón; la RLS ya solo deja borrar `payments` al admin. El cliente hace **un solo**
  `DELETE` y no toca el saldo: `trg_update_balance` pasa a correr también en `DELETE`, así el
  saldo se recalcula en la misma transacción. El rastro queda en Auditoría (`log_change` ya
  audita `DELETE` en `payments` desde fix-363-m).
- **"Anular" (pago visible tachado, con motivo) queda fuera de este fix.** Al inventariar, ~15
  consultas de la app, 4 edge functions y las RPC del dashboard ejecutivo suman `payments` sin
  filtrar por estado: un estado `anulado` se seguiría sumando ahí. Se propone como asignación
  aparte, junto con otra para confirmar si esas consultas ya suman pagos `pending` hoy.
- **Día con caja cerrada: bloqueado.** No se borra un pago, gasto o anticipo cuya fecha tenga un
  `cash_closings` `closed` en su sede; la corrección se hace con un ajuste en Historial de
  Cuadraturas (`cuadratura_adjustments`, spec 0002-i). No se arrastra la diferencia al fondo del
  día siguiente: el fondo es lo que hay en el cajón, y un pago mal registrado no movió efectivo.
- **Cierre definitivo.** Un `cash_closings` con `status = 'closed'` no se puede modificar, ni
  siquiera por admin. El segundo intento de cierre (otra pestaña, otra persona) falla y la
  pantalla avisa quién cerró y a qué hora. Sin "reabrir caja" por ahora: los ajustes cubren las
  correcciones.

## ACs Afectados

Ninguno — fix autónomo (originado de ASG-i-048).

- AC-1: quitar un pago de matrícula solo lo puede hacer el admin (la secretaria no ve el botón);
  el saldo del alumno queda igual a lo que suman sus pagos restantes, sin cálculo en el cliente.
- AC-2: toda escritura de Caja que falle o no afecte filas (RLS) muestra un error, nunca el toast
  de éxito. Incluye revertir cobros de cursos singulares y servicios especiales, y egresos.
- AC-3: `cerrarCaja()` solo avisa éxito y limpia el arqueo si el cierre quedó guardado.
- AC-4: un cierre `closed` no se puede sobrescribir; el segundo intento avisa a qué hora se cerró y
  actualiza la pantalla con ese cierre.
- AC-5: si la carga del día falla, la Caja muestra error con "Reintentar" y "Cerrar caja" queda
  bloqueado.
- AC-6: no se puede quitar un ingreso o egreso de un día con caja cerrada; el aviso apunta a
  Historial de Cuadraturas.

## Cambio

- `cuadratura.facade.ts`: `assertWriteOk` (fix-362-m) en todas las escrituras, con
  `requireRows` en `DELETE`/`UPDATE`; lecturas que lanzan en `{ error }`; `cargaFallida` bloquea
  `puedeCerrarCaja`; `eliminarIngreso` hace solo el `DELETE` del pago. Sale de `PENDING` en
  `unchecked-writes.guard.spec.ts`.
- UI de Caja: botón de quitar ingreso solo para admin; estado de error con "Reintentar".
- Migración: `trg_update_balance` también en `DELETE`; trigger que bloquea `DELETE` de
  `payments`/`expenses`/`instructor_advances` de un día con caja cerrada; trigger que impide
  modificar un `cash_closings` `closed`. SQL revisado en el chat antes de crear el archivo.

## Test de Regresión

- `cuadratura.facade.spec.ts`: cada escritura con `{ error }` o sin filas → sin toast de éxito,
  `false`; `cerrarCaja` con error → arqueo intacto; lecturas con error → `_error`, carga fallida
  y `puedeCerrarCaja() === false`; `eliminarIngreso` no escribe en `enrollments`.
- `unchecked-writes.guard.spec.ts` sin `cuadratura.facade.ts` en `PENDING`.
- Test SQL de la migración (`supabase/tests/`): saldo tras `DELETE`, bloqueo por día cerrado,
  cierre `closed` inmodificable.

## Evidencia de Verificación

### Test SQL de la migración — piloto, 2026-10-10 (Ignacio, SQL Editor)

`supabase/tests/rls/fix-044-i-caja-saldo-y-cierre.sql`, todo en sub-bloques que abortan (sin datos
residuales). La primera corrida solo devolvió el caso 1: los resultados se anotaban en `r044` dentro de
los sub-bloques que abortan y se deshacían con ellos; el test pasó a acumularlos en una variable.

| # | Caso | Esperado | Obtenido |
|---|---|---|---|
| 1 | Triggers instalados | los 5 | los 5 ✅ |
| 2 | AC-1 `total_paid` sube 1 al registrar el pago (control) | 1 | 1 ✅ |
| 3 | AC-1 `total_paid` vuelve al valor previo al borrar el pago | 0 | 0 ✅ |
| 4 | AC-6 borrar pago de día cerrado | `CAJA_CERRADA` | `CAJA_CERRADA` ✅ |
| 5 | AC-6 borrar gasto de día cerrado | `CAJA_CERRADA` | `CAJA_CERRADA` ✅ |
| 6 | AC-6 control: gasto de día abierto se borra | sin error | sin error ✅ |
| 7 | AC-4 un borrador se puede cerrar | sin error | sin error ✅ |
| 8 | AC-4 modificar un cierre `closed` | `CIERRE_DEFINITIVO` | `CIERRE_DEFINITIVO` ✅ |
| 9 | AC-4 upsert de pestaña vieja sobre cierre `closed` | `CIERRE_DEFINITIVO` | `CIERRE_DEFINITIVO` ✅ |
| 10 | AC-4 borrar un cierre `closed` | `CIERRE_DEFINITIVO` | `CIERRE_DEFINITIVO` ✅ |

### Tests de la app

`cuadratura.facade.spec.ts` (24 casos nuevos, en rojo antes del cambio), `db-error.utils.spec.ts` y
`unchecked-writes.guard.spec.ts` sin `cuadratura.facade.ts` en `PENDING`: suite completa 3786 ✅.

### /verify — localhost:4200 contra la BD del piloto, 2026-10-10

Solo lectura: Playwright interceptó las respuestas `GET` de `payments`/`expenses`/`instructor_advances`
para inyectar filas falsas (un pago de matrícula, un gasto, un anticipo) y **abortó toda escritura**
(`POST`/`PATCH`/`DELETE`). La falla de red se simuló abortando el `GET` de `payments`.

| Caso | Resultado |
|---|---|
| AC-1 secretaria: fila de pago de matrícula sin botón de quitar; columna Total alineada | ✅ (0 botones de ingreso; gasto sí) |
| AC-1 secretaria: anticipo sin botón de quitar | ✅ (solo el gasto lo tiene) |
| AC-1 admin: pago y anticipo con botón de quitar | ✅ |
| AC-5 carga fallida: aviso "No se pudieron cargar…" con Reintentar, sin esconder lo ya cargado | ✅ |
| AC-5 drawer Arqueo y Cierre: aviso + "Cerrar Caja" deshabilitado | ✅ |
| AC-5 Reintentar con la red de vuelta: el aviso desaparece | ✅ |
| Modo oscuro del aviso | ✅ |
| Consola | solo los `ERR_INTERNET_DISCONNECTED` provocados por la simulación |

**Hallazgo corregido durante /verify:** con el aviso, la grilla `--fill-screen` (`auto 1fr`) le daba el
`1fr` al aviso y empujaba las listas fuera de la pantalla. Con el aviso visible el componente pasa a
`--fill-screen-kpi` (`auto auto 1fr`). **Reserva:** a 1280×800 las listas quedan comprimidas mientras el
aviso está visible; es un estado de error transitorio.

## Progreso

- [x] Confirmación de los puntos: no se reprodujo borrando pagos reales (la BD del piloto es compartida);
  los puntos 1, 2 y 4 se confirmaron en la BD con el test SQL y el 3 y 5 con los tests del facade y /verify
- [x] Decisión de diseño del punto 1 (ver Decisiones)
- [x] Tests primero (TDD): 24 tests nuevos en rojo antes del código, en verde después
- [x] Código (facade, `db-error.utils`, UI de Caja, drawer de arqueo)
- [x] Migración escrita y aprobada (`20261010120000_fix044_caja_saldo_y_cierre_definitivo.sql`) + test
  `supabase/tests/rls/fix-044-i-caja-saldo-y-cierre.sql`
- [x] Migración aplicada en el piloto (2026-10-10, Ignacio, SQL Editor). El primer intento abortó por
  deadlock con tráfico de la app (sin efectos: un solo bloque); el reintento con `SET lock_timeout = '5s'` pasó.
- [x] Test SQL de la migración: 10/10 ✅ en el piloto (ver Evidencia)
- [x] `npm run lint:arch` y `npm run test:ci` (3786 tests en verde, `tsc` limpio)
- [x] `/verify` de la Caja (admin y secretaria, ver Evidencia)
- [x] Índices sincronizados (FACADES, COMPONENTS, SERVICES, DATABASE)
- [x] `/fix-close` (2026-10-10, con visto bueno de Ignacio). Gotchas: DG-106, DG-107.

## Notes

- Originado de Asignación ASG-i-048 (`specs/assignments/ASG-i-048-cuadratura-operaciones-fallan-en-silencio.md`).
- Archivos: `src/app/core/facades/cuadratura.facade.ts`, `core/utils/db-error.utils.ts`
  (tokens `CAJA_CERRADA`/`CIERRE_DEFINITIVO`), `shared/components/cuadratura-content`,
  `features/admin/contabilidad-cuadratura/{admin-contabilidad-cuadratura,arqueo-cierre-drawer}`,
  `features/secretaria/contabilidad-cuadratura`, migración.
- **El bloqueo por día cerrado no aplica a pagos de matrículas en `draft`:** `cleanup_expired_drafts`
  (cron) borra los pagos de borradores vencidos y, desde ASG-m-002, un borrador puede tener un pago
  `paid`. Con el bloqueo el cron fallaría completo.
- **El rastro del borrado queda en `audit_log`, pero la vista Auditoría solo lista acciones de
  secretarias** (`AuditoriaFacade`); un borrado del admin se ve en la actividad reciente del
  dashboard. Anotado para la asignación de "anular pagos".
- **Fuera de alcance, observado:** la Caja suma pagos `paid` y `completado`, pero
  `recalculate_enrollment_balance()` solo suma `paid`.
