# Fix: Cuadratura — operaciones que fallan en silencio y corrompen saldos
> id: fix-044-i-cuadratura-operaciones-fallan-en-silencio
> refs: ASG-i-048
> status: in_progress
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

## ACs Afectados

Ninguno — fix autónomo (originado de ASG-i-048).

- AC-1: eliminar un ingreso como secretaria no deja el saldo del alumno distinto al de antes si el
  borrado del pago no procede, y muestra el error real.
- AC-2: eliminar un egreso o anticipo que la RLS bloquea muestra error, no "eliminado".
- AC-3: `cerrarCaja()` solo avisa éxito y limpia el arqueo si el `upsert` tuvo éxito.
- AC-4: un cierre `closed` no se puede sobrescribir salvo con una reapertura explícita.
- AC-5: si la carga del día falla, la Caja muestra error con "Reintentar" y "Cerrar caja" queda
  bloqueado.

## Cambio

Pendiente de completar por quien ejecuta el fix. Alcance sugerido por la Asignación:

- Revisar `error` en todas las escrituras de `cuadratura.facade.ts` y mostrar el error real.
- (1) No tocar saldos desde el cliente: borrar el pago y dejar que un trigger recalcule, o usar una
  RPC transaccional; decidir si la secretaria puede eliminar ingresos (UI y RLS coherentes).
  Decidir junto con `ASG-i-049` (trigger de saldo).
- (4) Impedir UPDATE sobre cierres `closed` salvo acción explícita de reapertura auditada
  (migración sobre `cash_closings`).
- (5) Que las lecturas lancen en `{ error }`, mostrar error + Reintentar (patrón de `fix-189-b`) y
  bloquear "Cerrar caja" si la carga falló.

Si el diseño del punto (1) crece, derivarlo a un segundo track o a una spec.

## Test de Regresión

Pendiente de completar. Spec del facade con el cliente de Supabase simulado devolviendo `{ error }`
para cada escritura y lectura: no hay toast de éxito, no se limpia el arqueo, no se mueve el saldo.

## Progreso

- [ ] Confirmar los 5 puntos en vivo con datos de prueba propios
- [ ] Decisión de diseño del punto 1 (con ASG-i-049)
- [ ] Tests primero (TDD)
- [ ] Código y migración
- [ ] `npm run lint:arch` y `npm run test:ci`
- [ ] `/verify` de la Caja
- [ ] Índices sincronizados
- [ ] `/fix-close`

## Notes

- Originado de Asignación ASG-i-048 (`specs/assignments/ASG-i-048-cuadratura-operaciones-fallan-en-silencio.md`).
- Archivos: `src/app/core/facades/cuadratura.facade.ts`, migración para `cash_closings`.
