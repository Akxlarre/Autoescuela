# Fix: Portal Instructor corre sobre datos MOCK
> id: fix-001-i-portal-instructor-datos-mock
> refs: ASG-b-010
> status: done
> closed: 2026-07-29
> created: 2026-07-28

## Root Cause
[Heredado de ASG-010, a confirmar]: `instructor-clases.facade.ts:53` tiene un flag hardcodeado `private readonly useMock = true;` (comentario: "Mock switch para revisión de flujo") que bypassea toda la lógica real de Supabase en `fetchTodayClasses()`, `loadClassDetail()`, `startClass()`, `finishClass()`, `saveEvaluation()` y `fetchUpcomingDays()`. Un instructor real ve alumnos falsos ("Juanito Pérez (Mock)") y puede intentar iniciar una clase que no existe. La rama real de código YA existe completa en el mismo archivo, simplemente nunca se ejecuta.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts`
- **Qué cambia:** activar la rama real de Supabase (`useMock = false`) en `fetchTodayClasses()`, `loadClassDetail()`, `startClass()`, `finishClass()`, `saveEvaluation()` y `fetchUpcomingDays()`, una vez que la rama real tenga cobertura de tests.
- **Archivo:** `src/app/core/facades/instructor-clases.facade.spec.ts`
- **Qué cambia:** agregar tests para la rama real de Supabase (actualmente 0% de cobertura — solo testea el modo mock) ANTES de activar el flag, siguiendo `.claude/rules/testing-tdd.md`.

## Test de Regresión
- `src/app/core/facades/instructor-clases.facade.spec.ts > modo real (useMock=false)` — 17 tests cubriendo `fetchTodayClasses`, `loadClassDetail`, `startClass`, `finishClass`, `saveEvaluation`, `fetchUpcomingDays` (mapeo, error handling, no-op sin instructorId). ✓
- Tests legacy de `startClass`/`finishClass` (mock mode) actualizados para forzar `useMock=true` explícitamente, ya que dejó de ser el valor por defecto. ✓
- Suite completa: 19/19 verde. `tsc --noEmit`, `ng build --configuration=development` y `npm run lint:arch` sin hallazgos nuevos.
- Confirmado en vivo: el Dashboard del Portal Instructor ("Mis Clases de Hoy") consume `InstructorClasesFacade.todayClasses()` directamente (`instructor-dashboard.component.ts`) — no hay mock separado en esa vista; el flag de este facade la cubre por completo.
- **Nota de proceso:** un primer intento de este mismo fix se implementó y validó pero nunca se comiteó — se perdió al sincronizar con el remoto y el instructor siguió viendo datos mock en producción. Esta vez el cambio se comitea inmediatamente tras cerrar el track.
