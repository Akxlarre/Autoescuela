# Fix: Alumno con matrícula solo `completed` ve horario histórico sin aviso
> id: fix-128-b-alumno-matricula-completada-sin-aviso
> refs: ASG-b-091
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Root Cause

[Heredado de ASG-b-091, a confirmar]: `StudentEnrollmentContextFacade.initialize()` trae
matrículas con `status in ('active', 'completed')`
(`student-enrollment-context.facade.ts:26-31`), ordenadas por `created_at` desc, y activa por
defecto la más reciente (`tabs[0].id`) sin distinguir si esa matrícula está realmente `active`
o ya `completed`.

El estado "Sin matrícula activa" en `AlumnoHorarioComponent` (y el mismo patrón heredado en
`AlumnoPagosComponent`) está gateado por `facade.licenseGroup() === null` — ese signal **solo**
queda `null` cuando el alumno tiene CERO matrículas en la BD (ni activa ni completada). Si el
alumno tiene ÚNICAMENTE matrículas `completed` (terminó Clase B hace meses, todavía no toma
nada nuevo), `licenseGroup()` se setea igual con el `license_group` de esa matrícula
completada — el horario histórico se renderiza como si fuera normal, sin ningún aviso de que
es un curso ya cerrado.

El check de "vacío" responde "¿tiene alguna matrícula en la BD alguna vez?" en vez de "¿tiene
una matrícula con `status='active'` ahora mismo?" — son preguntas distintas y el código solo
resuelve la primera.

## ACs Afectados

Ninguno formalizado en specs previas — es un gap de UX/estado descubierto durante fix-127-b
(app-like `/alumno/horario`), fuera de su scope porque es lógica de negocio/estado, no layout.

## Cambio

- **Archivo:** `src/app/core/models/ui/student-home.model.ts`
  - `EnrollmentTab` gana `status: 'active' | 'completed'` y `courseName: string` (nombre del
    curso sin el número de matrícula, para mensajes contextuales).
- **Archivo:** `src/app/core/facades/student-enrollment-context.facade.ts`
  - `initialize()` ahora selecciona también la columna `status` de `enrollments` (el `.in()`
    ya filtraba `['active', 'completed']`, pero el valor nunca se propagaba al `EnrollmentTab`).
  - Nuevo computed `activeEnrollment`: devuelve el `EnrollmentTab` completo de la matrícula
    seleccionada (no solo el `id`), buscándolo en `_enrollments()` por `_activeId()`.
- **Archivo:** `src/app/features/alumno/horario/alumno-horario.component.ts`
  - Nuevos computed `isCompletedEnrollment` (`context.activeEnrollment()?.status ===
    'completed'`) y `completedCourseName` (con fallback `'tu curso'`).
  - Nuevo banner, hermano del de "Sin matrícula activa" existente (mismo wrapper
    `.bento-banner` siempre-presente de fix-127-b, no rompe el auto-placement de
    `--fill-screen-kpi`): cuando la matrícula activa es `completed`, muestra "Tu matrícula de
    {{ completedCourseName() }} finalizó. Consulta a la secretaría para una nueva." — el
    calendario semanal sigue mostrándose debajo (es historial real, no se oculta), pero ahora
    con contexto explícito de que el curso está cerrado.
  - Bonus (alcance de la Asignación, no bloqueante): `enrollmentTabs()` agrega el sufijo
    "(finalizada)" al label de las tabs cuyo `status` es `completed`, sin tocar
    `TabsComponent`/`TabOption` (shared) — la distinción vive enteramente en el label que arma
    el Smart Component.
- **Revisión `AlumnoPagosComponent`/`StudentPaymentFacade`:** NO tiene el mismo bug. El RPC
  `get_student_payment_status` (`supabase/migrations/20260416000001_...sql:63`) ya filtra
  `e.status = 'active'` al buscar el enrollment con saldo pendiente — una matrícula `completed`
  simplemente no matchea, y `facade.enrollment()` queda `null` (comportamiento correcto: no hay
  saldo que cobrar sobre un curso cerrado). Sin cambios en ese archivo.

## Test de Regresión

- `src/app/core/facades/student-enrollment-context.facade.spec.ts`: 11 tests (5 nuevos) —
  mapeo de `status`/`courseName`, fallback a `'active'` para valores no-`completed`, y el
  computed `activeEnrollment` (devuelve el tab completo de la matrícula seleccionada, se
  actualiza con `setActive()`, y es `null` sin matrículas). `npx vitest run
  student-enrollment-context.facade.spec.ts` → **11/11 PASS**.
- Sin `.spec.ts` para `AlumnoHorarioComponent` (Smart Component) — consistente con el resto
  del portal alumno: `vitest.config.ts` excluye specs de componentes Angular en este proyecto
  (patrón documentado, verificación real vía `ng build`/`tsc`/`/verify`, no vitest).
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, 0 errores (170 warnings pre-existentes sin relación a los 3
  archivos tocados).
- `/verify` manual en navegador (`ng serve`, logueado `alumno@test.com`, 1440×900):
  - Caso real (matrícula `active`, sin sesiones esta semana): sin banner nuevo, sin regresión
    — igual que antes del fix.
  - Caso `completed` inyectado client-side (mismo patrón que fix-127-b, sin tocar la BD):
    banner "Tu matrícula de Clase B finalizó. Consulta a la secretaría para una nueva." se
    renderiza correctamente, calendario semanal sigue visible debajo.
  - Caso 2 matrículas (1 `completed` + 1 `active`, inyectado client-side): tab de la
    `completed` muestra "Clase B · #0008 (finalizada)", la `active` sin sufijo.
  - `read_console_messages`: mismos 7 `InvalidStateError` (Transition aborted) presentes
    ANTES y DESPUÉS del cambio — pre-existentes, no relacionados (no se tocó código de
    navegación/transiciones).
