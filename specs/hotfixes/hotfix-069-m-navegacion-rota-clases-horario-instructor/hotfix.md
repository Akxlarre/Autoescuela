# Hotfix: Navegación rota al hacer click en una clase del horario del portal instructor
> id: hotfix-069-m-navegacion-rota-clases-horario-instructor
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Problema
En `InstructorHorarioComponent.onBlockClick()`, al hacer click en una clase `scheduled` o `in_progress` se navega a `/app/instructor/clases/${sessionId}/iniciar` — ruta inexistente (plural "clases" + sufijo "/iniciar" que no es un path param real) — resultando en un 404.

## Cambios
- **Archivo:** `src/app/features/instructor/horario/instructor-horario.component.ts` — en `onBlockClick()`: para `status === 'scheduled'` navegar a `/app/instructor/clase/iniciar` con `queryParams: { sessionId }` (igual que `instructor-dashboard.component.ts`); para `status === 'in_progress'` navegar a `/app/instructor/clase/${sessionId}` (ruta `clase/:id`, para finalizar la clase).
