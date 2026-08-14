# Hotfix: Eliminar vista "Ensayos Teóricos" del portal instructor
> id: hotfix-068-m-eliminar-vista-ensayos-teoricos-instructor
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Problema
La vista `/app/instructor/ensayos-teoricos` no aporta valor (según el dueño) y debe eliminarse por completo, incluyendo el código muerto que solo ella usaba.

## Cambios
- **Archivo:** `src/app/features/instructor/ensayos-teoricos/` — eliminar carpeta completa (componente).
- **Archivo:** `src/app/app.routes.ts` — eliminar la ruta `ensayos-teoricos` del portal instructor.
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts` — eliminar la entrada de menú que apunta a `/app/instructor/ensayos-teoricos`.
- **Archivo:** `src/app/core/facades/instructor-alumnos.facade.ts` — eliminar `examScores`, `_examScores`, `loadExamScores()`, `examLoading`, `_examLoading`, `registerExamScore()` (sin otros consumidores).
- **Archivo:** `src/app/core/facades/instructor-alumnos.facade.spec.ts` — eliminar el test de `loadExamScores`.
- **Archivo:** `src/app/core/models/ui/instructor-portal.model.ts` — eliminar `ExamScoreRow` y `RegisterExamPayload` (sin otros consumidores).
- **Archivo:** `indices/COMPONENTS.md`, `indices/ROUTES.md`, `indices/USAGE-MAP.md`, `indices/FACADES.md`, `indices/MODELS.md`, `indices/APP-LIKE-ROLLOUT.md` — actualizar índices removiendo referencias a la vista eliminada.
