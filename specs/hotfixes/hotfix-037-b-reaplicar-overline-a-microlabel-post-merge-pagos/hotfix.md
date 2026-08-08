# Hotfix: Reaplicar rename `.overline` → `.micro-label` (fix-115-b) en pagos tras merge de main
> id: hotfix-037-b-reaplicar-overline-a-microlabel-post-merge-pagos
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Problema
Al mergear `main` (54 commits nuevos) sobre `claude/tareas-pendientes-sfh2vp`, `admin-pagos.component.ts`
y `secretaria-pagos.component.ts` llegaron reescritos por completo (refactor app-like en main, PR #97) y
tomé la versión de `main` para resolver el conflicto — pero esa versión trae de vuelta 2 usos cada una de
la clase vieja `.overline`, eliminada en fix-115-b (colisión con la utilidad nativa de Tailwind
`overline`, ver `_variables.scss`). Es el mismo cambio mecánico ya validado en fix-115-b, aplicado sobre
código que no existía cuando se hizo ese fix.

## Cambios
- **Archivo:** `src/app/features/admin/pagos/admin-pagos.component.ts` — 2 usos de `class="overline ...".`/`class="overline"` → `.micro-label`.
- **Archivo:** `src/app/features/secretaria/pagos/secretaria-pagos.component.ts` — 2 usos de `class="overline ...".`/`class="overline"` → `.micro-label`.
