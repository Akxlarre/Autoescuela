# Fix: Pagos duplicados (doble Enter) y sobrepago con pagos simultáneos
> id: fix-045-i-pagos-duplicados-y-sobrepago
> refs: ASG-i-049
> status: done
> closed: 2026-10-10
> created: 2026-10-10

## Root Cause

[Heredado de ASG-i-049, confirmado leyendo el código al reclamar]:

1. **Doble Enter**: en `registrar-pago-drawer.component.ts` el formulario tiene
   `(ngSubmit)="onSubmit()"` y `onSubmit()` no revisa `isSaving()` al entrar. El botón se deshabilita
   mientras guarda, pero un Enter en un campo dispara `ngSubmit` igual: dos Enter rápidos insertan el
   mismo abono dos veces.
2. **Concurrencia**: `check_payment_within_pending_balance()` (`trg_check_payment_within_pending_balance`,
   `BEFORE INSERT` en `payments`, `20260723010000_fix_h024…`) lee `enrollments.pending_balance` con un
   `SELECT` simple, sin bloquear la fila. Dos pagos simultáneos que caben cada uno en el saldo pasan
   ambos y lo dejan negativo (saldo $100.000, dos pagos de $80.000 → −$60.000).

## ACs Afectados

Ninguno — fix autónomo (originado de ASG-i-049).

- AC-1: un segundo envío del drawer de registrar pago mientras el primero está guardando no inserta
  otro pago.
- AC-2: dos pagos simultáneos sobre la misma matrícula no pueden sumar más que su saldo pendiente:
  el segundo espera al primero y valida contra el saldo ya actualizado.
- AC-3: los demás formularios que registran pagos quedan revisados: corregidos si tienen el mismo
  patrón, o listados en una asignación aparte si son más de 2–3.

## Cambio

- `registrar-pago-drawer.component.ts`: `if (this.isSaving()) return;` al inicio de `onSubmit()`.
- Migración: `check_payment_within_pending_balance()` con `SELECT … FOR UPDATE` sobre la matrícula.
  SQL revisado en el chat antes de crear el archivo; lo aplica Ignacio en el SQL Editor con
  `SET lock_timeout` (DG-107).
- Revisión de los otros formularios que insertan en `payments`.

## Test de Regresión

- Spec del drawer: dos `onSubmit()` seguidos → `registrarNuevoPago` se llama una sola vez.
- Test SQL: la función del trigger contiene `FOR UPDATE` y sigue rechazando un pago mayor al saldo.

## Evidencia de Verificación

### Test SQL — piloto, 2026-10-10 (Ignacio, SQL Editor)

`supabase/tests/rls/fix-045-i-sobrepago-bloquea-matricula.sql` (sub-bloques que abortan, sin datos
residuales). La concurrencia real necesita dos sesiones a la vez: se verifica que la función lea con
`FOR UPDATE` (lo que serializa los pagos a una misma matrícula) y que la regla de saldo siga intacta.

| # | Caso | Esperado | Obtenido |
|---|---|---|---|
| 1 | La función lee el saldo con `FOR UPDATE` | true | true ✅ |
| 2 | La función es `SECURITY DEFINER` | true | true ✅ |
| 3 | Pago mayor al saldo se rechaza | `23514` | `23514` ✅ |
| 4 | Segundo pago que excede el saldo restante se rechaza | `23514` | `23514` ✅ |
| 5 | Control: pago dentro del saldo pasa | sin error | sin error ✅ |

### Tests de la app

`registrar-pago-drawer.component.spec.ts`: el caso de doble envío falló antes del guard
(`registrarNuevoPago` llamado 2 veces) y pasa después.

### /verify — localhost:4200 contra la BD del piloto, 2026-10-10 (admin, Gestión de Pagos)

Solo lectura: Playwright interceptó el `POST /rest/v1/payments` (lo contó y respondió `201` con 1,5 s
de demora, sin llegar a la BD) y abortó cualquier otra escritura.

| Caso | Resultado |
|---|---|
| Enter ×3 en un campo con el formulario completo | **0 envíos**: el formulario no se envía con Enter (ver abajo) |
| Dos clics a "Guardar Pago" en el mismo instante (antes de que se deshabilite) | **1 envío** ✅ |
| Consola | solo la notificación posterior al pago, bloqueada por la intercepción |

**Hallazgo: la sospecha (1) tal como estaba escrita no se reproduce en el navegador.** El botón
"Guardar Pago" está fuera del `<form>` (pie del drawer) y el formulario tiene 7 campos de texto: sin
un botón de envío dentro del form, el navegador no hace envío implícito con Enter. El camino real a un
doble `onSubmit()` es un doble clic que cae antes de que el botón se deshabilite (y cualquier llamada
programática); el guard lo cubre igual, y es el que reproduce el test unitario.

## Progreso

- [x] Confirmar (1) y (2) leyendo el código
- [x] Test primero (TDD) del doble envío: en rojo (2 llamadas) antes del guard, en verde después
- [x] Guard en `onSubmit()` + revisión de otros formularios de pago (ver Notes)
- [x] Migración aprobada (`20261010140000_fix045_sobrepago_bloquea_matricula.sql`) + test
  `supabase/tests/rls/fix-045-i-sobrepago-bloquea-matricula.sql`
- [x] Migración aplicada en el piloto (2026-10-10, Ignacio, SQL Editor) y test SQL 5/5 ✅
- [x] `npm run lint:arch` y `npm run test:ci` (3787 ✅)
- [x] `/verify` del drawer de pago (ver Evidencia)
- [x] Índices sincronizados (COMPONENTS, DATABASE)
- [x] `/fix-close` (2026-10-10, con visto bueno de Ignacio)

## Notes

- Originado de Asignación ASG-i-049 (`specs/assignments/ASG-i-049-pagos-duplicados-y-sobrepago.md`).
- `ASG-b-063` (race condition del saldo) ya está cerrada en `fix-114-m`: sin solape.
- **AC-3, otros formularios que insertan en `payments`:** el wizard de matrícula
  (`EnrollmentPaymentFacade.recordPayment`) borra el pago anterior de la matrícula antes de insertar
  (idempotente) y `EnrollmentFacade.confirmEnrollment`/`confirmWithPayment` ya cortan con
  `_isSubmitting`; `AdminPreInscritosFacade` (Clase Profesional) está oculto en el piloto. Solo el
  drawer de registrar pago tenía el problema: no hace falta asignación aparte.
