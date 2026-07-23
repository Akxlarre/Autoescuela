# Fix: Registrar Pago con monto excesivo falla en silencio
> id: fix-057-m-registrar-pago-monto-excesivo-silencioso
> refs: ASG-013
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
H-024 resultó ser **dos causas raíz independientes** en el mismo componente, ambas necesarias para que "Registrar Pago" funcione correctamente con montos que exceden el saldo:

**Causa #1 (ya corregida):** el botón "Guardar Pago" (`<app-async-btn>`) estaba enlazado con `(clicked)="onSubmit()"`. `AsyncBtnComponent` no define ningún output `clicked` — los otros 9 usos de `<app-async-btn>` en el repo usan `(click)="..."` (evento nativo del DOM). Resultado: clickear el botón nunca ejecutaba `onSubmit()`, sin importar el monto ingresado.

**Causa #2 (ampliación de scope, confirmada por el usuario tras probar el fix #1 en vivo):** una vez corregido el binding, se confirmó que **nunca existió validación alguna contra el saldo pendiente** — ni en el cliente (`sumMatchesTotalValidator` solo valida que la suma de canales coincida con `total_amount`, no lo compara contra el saldo) ni en la BD (`supabase/migrations/20260301000005_05_payments_and_finances.sql` solo tiene `CHECK (total_amount > 0)` y el check de suma de canales — ningún constraint limita el monto al saldo del enrollment). Se puede registrar un pago de cualquier monto (ej. $200.000.000 sobre una deuda de $90.000) sin ningún freno.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo (hallazgo de QA manual, H-024 en `indices/FLOWS-QA-AUDIT.md`)

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/admin/pagos/registrar-pago-drawer.component.ts`
- **Qué cambia (causa #1):** `(clicked)="onSubmit()"` → `(click)="onSubmit()"` en el botón "Guardar Pago", consistente con el resto de usos de `<app-async-btn>` en el repo.
- **Qué cambia (causa #2, cliente):** agrega validación client-side — getter `saldoExcedido` que compara `total_amount` contra el saldo pendiente resuelto (mismo criterio de prioridad que `onSubmit()`: `estadoCuentaResumen()` primero, luego `alumnosConDeuda()`); mensaje inline junto al campo Monto Total; gate en `onSubmit()` que bloquea el guardado si excede, además de deshabilitar el botón.
- **Archivo:** `supabase/migrations/20260723010000_fix_h024_payments_exceed_pending_balance_guard.sql`
- **Qué cambia (causa #2, servidor):** trigger `BEFORE INSERT` en `payments` (`trg_check_payment_within_pending_balance` → `check_payment_within_pending_balance()`) que bloquea el insert si `total_amount > enrollments.pending_balance`, sin importar el `status` del pago (si `pending_balance` es `NULL` no bloquea — cubre los 2 flujos legítimos que insertan pagos `'pending'` sobre un draft recién confirmado). Usa la misma fórmula que ya mantiene `recalculate_enrollment_balance()` / `trg_update_balance` (`20260301000008_08_misc_and_triggers.sql`), así que no introduce una segunda fuente de verdad. Documentado en `indices/DATABASE.md` (tabla de funciones).

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `registrar-pago-drawer.component.spec.ts` (8 tests, todos ✓), incluyendo:
  - `onSubmit() BLOQUEA el guardado si el monto excede el saldo pendiente (regresión H-024)` ✓ — reproduce el caso reportado por el usuario ($200.000.000 sobre saldo de $90.000): `registrarNuevoPago` NO se invoca, `saveError()` muestra el mensaje, `saldoExcedido` es `true`.
  - `onSubmit() PERMITE pagar exactamente el saldo pendiente completo (ej. alumno con "pago pendiente" al matricularse)` ✓ — confirma que un alumno que dejó pago pendiente por el monto total (ej. $180.000, `pending_balance` sin descontar nada) SÍ puede saldar su deuda completa: `180000 > 180000` es falso, `saldoExcedido` es `false`, `registrarNuevoPago` se invoca. El gate usa `>` estricto, no `>=`.
  - `saldoExcedido es false si no hay matrícula asociada (pago sin vínculo permitido)` ✓ — evita romper el caso legítimo documentado en el componente (pago sin `enrollmentId`).
  - Los 5 tests previos (payload correcto, prioridad de `montosActuales`, manejo de error sanitizado) siguen en verde.
- **Limitación conocida (causa #1):** TestBed en este proyecto no puede compilar templates de standalone components (ver `describe.skip` documentado en `libro-de-clases-subnav.component.spec.ts`), así que el binding `(click)` en sí no se puede verificar con un test automatizado de render+click. Verificado manualmente en el código: los 10 usos de `<app-async-btn>` en el repo ahora usan `(click)` de forma consistente. Se recomienda una verificación visual manual (click real en el drawer) antes de cerrar el fix.
- **Causa #2, servidor — verificado manualmente por el usuario (2026-07-23):** el usuario aplicó la migración `20260723010000_fix_h024_payments_exceed_pending_balance_guard.sql` localmente y confirmó que funciona correctamente (bloquea el insert que excede `pending_balance`, permite pagos dentro del saldo).
