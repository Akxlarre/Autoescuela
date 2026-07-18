# Hotfix: appCardHover rollout — 4 páginas restantes (ex-alumnos, pagar-retorno, progreso, ayuda)
> id: hotfix-001-b-appcardHover-rollout-4-paginas-restantes
> status: done
> created: 2026-06-30

## Problema
4 páginas feature quedaron sin `[appCardHover]` tras el rollout global del batch 3.

## Cambios
- **Archivo:** `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` — agregar import + array + appCardHover en bento-banner card (Archivo Histórico)
- **Archivo:** `src/app/features/alumno/pagar/alumno-pagar-retorno.component.ts` — agregar import + array + appCardHover en 5 cards idénticas (replace_all)
- **Archivo:** `src/app/features/alumno/progreso/alumno-progreso.component.ts` — agregar import statement + imports array al @Component + appCardHover en placeholder card
- **Archivo:** `src/app/features/alumno/ayuda/alumno-ayuda.component.ts` — agregar import statement + imports array al @Component + appCardHover en placeholder card
