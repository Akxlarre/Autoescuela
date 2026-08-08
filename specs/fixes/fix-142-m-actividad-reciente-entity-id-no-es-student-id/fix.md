# Fix: Actividad Reciente — entity_id de audit_log no es directamente el student.id
> id: fix-142-m-actividad-reciente-entity-id-no-es-student-id
> refs: fix-141-m-actividad-reciente-rutas-inventadas
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause
`audit_log.entity_id` es el PK de la fila afectada en **su propia tabla** (`students.id`,
`enrollments.id`, `class_b_sessions.id`, etc.), no un `student_id` universal. `fix-141-m`
corrigió el *path* de destino (`/alumnos/:id`) pero seguía usando `item.entityId` tal cual
para las entidades `enrollments` y `class_b_sessions` — cuyo `entity_id` es el PK de
`enrollments`/`class_b_sessions`, no de `students`. Resultado: "Nueva clase práctica"
(entity `class_b_sessions`) navegaba a `/app/admin/alumnos/{class_b_sessions.id}`, un ID
que cae en un rango totalmente distinto al de `students.id` (confirmado por el owner: los
IDs de alumnos están en el rango ~100, la ruta generada llevaba a 643).
`admin-alumno-detalle.facade.ts:287` (`initialize(studentId: number)`) espera
inequívocamente un `students.id`.

## ACs Afectados
- Ninguno — fix autónomo (no hay spec activa; corrección de bug reportado por el owner).

## Cambio
- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
  **Qué cambia:** se agrega `resolveStudentIdForActivity(entity, entityId): Promise<number | null>`
  que resuelve el `students.id` real según la entidad: `students` → el mismo id;
  `enrollments` → `enrollments.student_id`; `class_b_sessions` → `enrollments.student_id`
  vía join `class_b_sessions.enrollment_id → enrollments.id`.
- **Archivo:** `src/app/features/dashboard/recent-activity-drawer/recent-activity-drawer.component.ts`
  **Qué cambia:** `handleItemClick` pasa a ser async y, para las entidades de tipo alumno,
  resuelve el `students.id` real vía el Facade antes de navegar (en vez de usar
  `item.entityId` directo). `isClickable` se mantiene síncrono — determina *si el tipo de
  entidad es navegable en principio*, no si el lookup async va a tener éxito (si el lookup
  falla, el click no navega, sin romper la UI).

## Test de Regresión
- Verificación manual: click en "Nueva clase práctica" navega a `/app/{role}/alumnos/{id}`
  usando el `students.id` real del alumno dueño de esa clase (no `class_b_sessions.id`).
  Mismo criterio para un evento de tipo `enrollments`.
- **Verificado en sesión (2026-08-08) contra BD real vía Playwright/REST autenticado:**
  tomada `class_b_sessions.id=133` (enrollment_id=41), la query embebida
  `class_b_sessions?select=enrollments(student_id)` (la misma que usa
  `resolveStudentIdForActivity`) devolvió `student_id=37`, idéntico al lookup directo
  `enrollments.id=41 → student_id=37`. Navegando a `/app/admin/alumnos/37` cargó la ficha
  correcta ("Ignacio Álvarez Smith", Matrícula #0004), no un ID fuera de rango como el
  643 reportado por el owner. Consola sin errores.
