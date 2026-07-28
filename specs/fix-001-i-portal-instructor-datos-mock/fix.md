# Fix: Portal Instructor corre sobre datos MOCK
> id: fix-001-i-portal-instructor-datos-mock
> refs: ASG-010
> status: in_progress
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
- `src/app/core/facades/instructor-clases.facade.spec.ts` — cobertura nueva de la rama real (`useMock=false`) para `fetchTodayClasses`, `loadClassDetail`, `startClass`, `finishClass`, `saveEvaluation`, `fetchUpcomingDays` — pendiente de escribir.
