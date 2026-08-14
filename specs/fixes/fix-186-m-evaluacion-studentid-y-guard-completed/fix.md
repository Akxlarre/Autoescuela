# Fix: Evaluación Práctica — ruta con studentId incorrecto + acceso sin guard de status
> id: fix-186-m-evaluacion-studentid-y-guard-completed
> refs: —
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
Dos bugs distintos encontrados juntos por el dueño al navegar "Mi Horario" → clase completada:

1. **Ruta con studentId incorrecto.** `onBlockClick()` en `instructor-horario.component.ts`
   navega a `/app/instructor/alumnos/${block.sessionId}/evaluacion/${block.sessionId}` — usa
   `sessionId` para AMBOS segmentos de la ruta (`:id` y `:sessionId`), porque `ScheduleBlock`
   (el modelo de `Mi Horario`) nunca tuvo un campo `studentId`. La vista de evaluación igual carga
   la clase correcta (busca por `sessionId`, que sí es válido), pero el botón "Volver" de
   `InstructorEvaluacionComponent.goBack()` usa el param `:id` de la URL para volver a
   `/app/instructor/alumnos/:id/ficha` — como ese `:id` en realidad es un `sessionId`, no
   encuentra al alumno real.
2. **Sin guard de status.** `InstructorEvaluacionComponent` renderiza el formulario de evaluación
   para cualquier sesión que cargue, sin verificar `status`. Manipulando la URL con el `sessionId`
   de una clase `scheduled` (aún no iniciada/finalizada) se accede igual a la vista de evaluación
   — debería ser inalcanzable hasta que la clase esté `completed`.

## ACs Afectados
Ninguno — fix autónomo (bug de navegación + falta de guard, reportados por QA manual).

## Cambio
- **Archivo:** `src/app/core/models/ui/instructor-portal.model.ts`
  - **Qué cambia:** agrega `studentId: number | null` a `ScheduleBlock`.
- **Archivo:** `src/app/core/facades/instructor-horas.facade.ts`
  - **Qué cambia:** `fetchWeeklySchedule()` agrega `id` al `students` anidado dentro de
    `enrollments(...)` y mapea `studentId: e?.students?.id ?? null`.
- **Archivo:** `src/app/features/instructor/horario/instructor-horario.component.ts`
  - **Qué cambia:** `onBlockClick()` navega con `block.studentId` (no `block.sessionId`) al
    segmento `:id` de la ruta; si `studentId` es `null` no navega (evita una ruta rota).
- **Archivo:** `src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts`
  - **Qué cambia:** agrega guard de status — si la clase cargada no está `completed`, se muestra
    el mismo `app-empty-state` de "no encontrada/sin acceso" en vez del formulario, bloqueando el
    acceso vía manipulación de URL a clases `scheduled`/`in_progress`/`cancelled`/`no_show`.

## Test de Regresión
Cambio de mapeo de datos (columna adicional en un `select()` ya existente) + un guard de
render — sin lógica condicional compleja que amerite test unitario nuevo aislado. Verificación
visual: `/verify` (Playwright) confirmando que (a) el botón "Volver" desde una evaluación abierta
desde Mi Horario llega a la ficha del alumno correcto, y (b) acceder por URL a
`/app/instructor/alumnos/:id/evaluacion/:sessionId` de una clase `scheduled` muestra el estado
vacío en vez del formulario.
