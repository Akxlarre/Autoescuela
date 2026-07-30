# Hotfix: Slim hero row-1 vertical padding — más aire en el eje Y
> id: hotfix-015-b-slim-hero-row1-vertical-padding
> status: done
> closed: 2026-06-19
> created: 2026-06-19

## Problema
El dashboard (y todas las páginas admin) usa `density="slim"`. La fila 1 del slim hero tiene
`py-2 sm:py-1.5` (8px / 6px), lo que hace que los botones de acción se sientan apretados
verticalmente. El usuario pide más padding en el eje Y.

## Cambios
- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts`
  — fila 1 slim: `px-4 py-2 sm:py-1.5 sm:min-h-[52px]` → `px-4 py-3 sm:py-2.5 sm:min-h-[60px]`
  — reverts `full` mode al original `p-5 md:p-6` (ya se había corregido)
