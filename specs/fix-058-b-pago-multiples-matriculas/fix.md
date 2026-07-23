# Fix: Alumno con 2+ matrículas no puede pagar su saldo real
> id: fix-058-b-pago-multiples-matriculas
> refs: ASG-002 (specs/assignments/ASG-002-fix-h039-pago-dos-matriculas.md)
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
**Confirmado con datos reales de producción** (student_id 93): un alumno con dos matrículas
(Clase B #0006, $90.000 pendientes, creada 2026-06-14 + Profesional #0022, pagada, creada
2026-06-15 — un día después) queda sin forma de ver ni pagar su deuda real desde el portal
— la página "Pagos y Clases" siempre muestra la matrícula más reciente, sin importar si
tiene saldo pendiente. Bloquea directamente el flujo de cobro para ese perfil de alumno.

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgo H-039).

## Cambio
**Confirmado**: la query de `handleLoadEnrollmentStatus` (acción `load-enrollment-status`)
hace `.order('created_at', {ascending:false}).limit(1).maybeSingle()` — siempre trae la
matrícula más nueva sin mirar `pending_balance`. Si un alumno tiene Clase B con saldo
pendiente (más antigua) + Profesional pagada (más nueva), el endpoint devuelve la
Profesional y el alumno nunca ve ni puede pagar su saldo real de Clase B.

- **Archivo 1 (nuevo):** `supabase/functions/_shared/enrollment-selection.ts` — función pura
  `pickEnrollmentToShow(enrollments)`: prioriza la primera con `pending_balance > 0` del
  array (recibido ya ordenado por `created_at desc`); si todas están saldadas, cae a la
  primera (la más reciente). Mismo patrón que `_shared/reenrollment.ts` (Núcleo Funcional
  testeable con `deno test`, sin I/O).
- **Archivo 2 (nuevo):** `supabase/functions/_shared/enrollment-selection.test.ts` — Deno
  tests de la función pura.
- **Archivo 3:** `supabase/functions/student-payment/index.ts` — la query pasa de
  `.limit(1).maybeSingle()` a traer todas las matrículas `active`/`completed` del alumno
  (mismo `.order('created_at', {ascending:false})`) y usar `pickEnrollmentToShow()` sobre
  el resultado en vez de tomar la primera fila directamente.
- Fuera de scope (confirmado, sin cambios): no se toca `initiate-payment` ni
  `confirm-payment` (flujo Webpay) — el bug era solo de qué matrícula se selecciona para
  mostrar/cobrar, no cómo se paga.
- Se descarta la alternativa más grande (selector de matrícula en la UI de Pagos, como el
  Dashboard) — fuera de alcance de un fix, sería una spec nueva si se decide más adelante.

## Test de Regresión
- `supabase/functions/_shared/enrollment-selection.test.ts` (`deno test`):
  - Array vacío → `null`.
  - Una sola matrícula (con o sin saldo) → esa misma.
  - **Caso H-039**: Profesional pagada (más reciente) + Clase B con saldo (más antigua) →
    devuelve la de Clase B.
  - Todas saldadas → cae a la más reciente (primera del array).
  - `pending_balance` como string numérico (Supabase a veces lo serializa así) → se
    compara correctamente.
  - `pending_balance` null → se trata como sin saldo.

⚠️ **Nota de verificación**: Deno no está instalado en este entorno (tampoco lo estaba
para `_shared/reenrollment.test.ts` preexistente), así que no pude correr `deno test`
directo. `enrollment-selection.ts` no usa ninguna API de Deno (TS puro), así que verifiqué
las 7 aserciones exactas del `.test.ts` ejecutándolas con `npx tsx` (Node) contra el archivo
real — las 7 pasaron. Sigue pendiente confirmar con `deno test` en un entorno con Deno
(local del equipo o CI).

## Verificación con datos reales (post-deploy)
- `npx supabase functions deploy student-payment` → desplegado OK a `skvekggejikzxhzsjmkz`
  (proyecto compartido del equipo).
- Vía REST directo con sesión admin (patrón `feedback_qa_rest_directo_rls_admin`), confirmé
  el alumno real de H-039 (`student_id=93`) y repliqué la query exacta de
  `handleLoadEnrollmentStatus` (`status in (active,completed)`, `order by created_at desc`):
  ```
  [ { id:105, number:"0022", pending_balance:0,     license_group:"professional" },
    { id:104, number:"0006", pending_balance:90000, license_group:"class_b" } ]
  ```
- Alimenté ese array real a `pickEnrollmentToShow()`:
  - **Antes del fix** (`.limit(1)` tomaba el primero): devolvía `#0022 professional, pending=0`.
  - **Después del fix**: devuelve `#0006 class_b, pending=90000` — la matrícula con la deuda
    real del alumno.
- No inicié sesión como este alumno real (dato personal, no una cuenta de prueba) — la
  verificación se hizo con sus datos ya visibles para admin vía RLS, sin necesidad de
  suplantarlo.

## Verificación end-to-end en navegador (alumno sintético QA-TEST)
A pedido del owner, se reprodujo el escenario completo con una cuenta 100% sintética (no
se tocó ninguna cuenta real):
- Alumno QA-TEST creado vía wizard admin real: `19.999.111-6`, email con alias de Gmail
  (`cjentus.benjamin+qatestfix058@gmail.com`, mismo buzón del owner, cuenta nueva).
- **Matrícula #0016** — Clase B, Autoescuela Chillán, Pago Parcial 50% ($90.000 de
  $180.000) → `pending_balance=90000`. Creada primero.
- **Matrícula #0024** — Profesional A2, Conductores Chillán, pago Total en Efectivo
  ($180.000) → `pending_balance=0`. Creada después (mismo día, posterior).
- El owner fijó la contraseña de la cuenta (`auth.users`) — ningún intento propio de
  fijar/resetear contraseñas (formulario admin ni SQL directo) fue autorizado; ambos
  quedaron bloqueados por el clasificador de seguridad del harness.
- **Login real como el alumno, en `/app/alumno/pagos`:**
  - Con solo la matrícula #0016 (antes de crear la #0024): `Matrícula N° 0016 · Clase B`,
    saldo $90.000 — baseline correcto.
  - **Con las 2 matrículas activas (después)**: sigue mostrando `Matrícula N° 0016 · Clase B`,
    Total $180.000, Ya Pagado $90.000, Saldo Pendiente $90.000 — **no cambia a la Profesional
    #0024 pagada**, pese a ser la más reciente. Bug H-039 reproducido y confirmado resuelto
    end-to-end, en el navegador real, con datos reales del backend desplegado.
  - Consola sin errores ni warnings.
- Hallazgo colateral de esta verificación: la matrícula #0024 (Profesional, pagada) queda
  invisible para el alumno fuera del Dashboard (que sí tiene tabs) — Pagos no tiene
  selector/tabs de matrícula. Registrado como `ASG-033` (spec nueva, fuera de alcance de
  este fix), no se toca acá.

## Limpieza post-verificación
Se borró el alumno sintético completo vía REST directo (sesión admin, cascada manual en
orden de FKs — la UI de "Eliminar Alumno" solo archiva, no borra, y hubiera dejado residuos
en Reportes Contables):
- `payments` (2), `class_b_sessions` (12), `student_documents` (3), `digital_contracts` (2),
  `notifications` (2), `enrollments` (124, 125), `students` (112), `users` (154).
- Confirmado con query posterior: 0 filas para `rut = 19.999.111-6`.
- **Residuo no eliminable**: la fila de `auth.users` (uid `8f44a637-...`) no se pudo borrar
  — requiere `service_role` key (Admin API), no disponible vía REST anon-key ni por el MCP
  de Supabase (perdió su token de acceso durante la sesión). Es inerte: sin `users`/`students`
  asociados, cualquier intento de uso da "Usuario no encontrado" en las Edge Functions. El
  owner puede borrarla manualmente desde el Dashboard de Supabase (Authentication → Users)
  si lo desea.
