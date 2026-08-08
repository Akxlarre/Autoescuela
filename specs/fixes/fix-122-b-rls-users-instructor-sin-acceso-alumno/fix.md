# Fix: RLS de `users` bloquea a instructores ver el nombre de sus propios alumnos
> id: fix-122-b-rls-users-instructor-sin-acceso-alumno
> refs: fix-121-b-evaluacion-ver-reutiliza-form-editable
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Root Cause

La policy `select_users` (SELECT sobre `public.users`) es:

```sql
(auth_user_role() = 'admin') OR (auth_user_role() = 'secretary') OR
((auth_user_role() IN ('instructor','student')) AND (id = auth_user_id()))
```

Para `instructor`/`student` **solo permite ver la propia fila**. Pero múltiples queries del
portal instructor hacen `students!inner(..., users!inner(id, first_names, ...))` para traer el
nombre del **alumno** (no del instructor) — en `instructor-clases.facade.ts`:
`fetchTodayClasses()` y `loadClassDetail()`. Con este RLS, el `users!inner` del alumno siempre
devuelve 0 filas para un instructor autenticado, y al ser `!inner` (no `left`), Postgrest descarta
la fila completa del `class_b_sessions` aunque esa fila sí sea visible por su propio RLS.

Confirmado empíricamente (verificación manual de `fix-121-b`): un instructor con una sesión
`class_b_sessions.instructor_id` correcta (RLS de esa tabla OK), `enrollments`/`students` visibles
(sus RLS ya cubren `instructor` — `select_enrollments` es abierto para el rol, `select_students`
tiene un subquery explícito vía `class_b_sessions.instructor_id = auth_instructor_id()`) — pero
`loadClassDetail()` devuelve `data: null` (sin error, RLS no lanza excepción, solo filtra) →
`InstructorEvaluacionComponent`/`InstructorClaseDetailComponent` muestran "Clase no encontrada".

**Alcance real:** esto afecta a *cualquier* instructor real en producción, no es específico de
`fix-121`. Bloquea: ver el nombre del alumno en "Mis Clases de Hoy" (dashboard), cargar el detalle
de cualquier clase (`clase/:id`, `alumnos/:id/evaluacion/:sessionId`), y probablemente listar
alumnos propios en otras pantallas que usen el mismo patrón de join. Preexistente — no introducido
por `fix-117-b` ni `fix-121-b`, solo salió a la luz al verificarlos con datos reales.

## ACs Afectados

Ninguno — fix autónomo de un gap de RLS descubierto durante QA manual de `fix-121-b`, sin spec
previa.

## Cambio

- **`supabase/migrations/20260807200000_rls_users_instructor_student_relationship.sql`**:
  - ⚠️ **Primer intento revertido en producción**: una policy que referenciaba
    `students`/`enrollments`/`class_b_sessions` directo en el `USING` de `users` causó
    `42P17: infinite recursion detected in policy for relation "users"` — rompió el login para
    TODOS los roles (`select_students` rama secretary consulta `users` directo, sin
    `SECURITY DEFINER`, cerrando el ciclo). Revertido con `DROP POLICY` de emergencia.
  - **Versión corregida** (misma migración, reescrita): nueva función
    `auth_instructor_can_view_student_user(target_user_id int) SECURITY DEFINER` — mismo patrón
    que `auth_instructor_id()`/`auth_user_role()` ya existentes, que bypassea RLS en la consulta
    interna al ejecutar con privilegios del owner de la función. La policy
    `select_users_via_class_relationship` (permisiva, se suma via OR a `select_users`) solo llama
    a esta función — nunca referencia las otras tablas directo.
- **`indices/DATABASE.md`** — documentar la policy y la función nueva en la sección de `users`.

## Test de Regresión

- Verificación manual (ya venía en curso para `fix-121-b`): con la migración aplicada, loguear
  como `instructor@test.com`, navegar a `/app/instructor/alumnos/128/evaluacion/517` (clase
  completada sin evaluar, `instructor_id` reasignado a este instructor de prueba) — debe cargar
  el nombre del alumno y el formulario, no "Clase no encontrada". Repetir en
  `.../evaluacion/513` (clase ya evaluada) para confirmar modo lectura de `fix-121-b`.
- `npx supabase db diff` / revisar que la migración es idempotente (usa `CREATE POLICY IF NOT
  EXISTS` o `DROP POLICY IF EXISTS` + `CREATE POLICY`, patrón del proyecto).
