# Hotfix: "Conmutar Sede" a veces dice "No se encontró una sede profesional disponible"
> id: hotfix-098-b-conmutar-sede-espera-sedes
> refs: ASG-i-022 (checklist 022, H08 / H09)
> status: closed
> created: 2026-10-19

## Problema
Con una sede sin Clase Profesional elegida, el menú ofrece "Conmutar Sede" al hacer clic en un ítem
profesional. Al aceptar, el sidebar busca la sede con Profesional en `branchFacade.branches()`. Si
la lista real de sedes todavía no terminó de cargar, `branches()` es el reemplazo de una sola sede
sacado de `localStorage` (sin `hasProfessional`): no la encuentra, avisa "No se encontró una sede
profesional disponible." y no cambia nada. En el e2e falló 3 de 6 veces, al admin y a la secretaria
con grant. El guard de esas rutas ya esperaba la carga por lo mismo (fix-334-m).

## Cambios
- **Archivo:** `src/app/core/facades/branch.facade.ts` (+ spec) — `switchToProfessionalBranch()`:
  espera la lista real (`ensureBranchesLoaded`) y recién ahí elige la sede con Profesional.
- **Archivo:** `src/app/layout/sidebar.component.ts` — usa ese método.

## Verificación
- [x] vitest del facade (lista todavía cargando → igual encuentra la sede).
- [x] e2e `auth-sesion-4.spec.ts` H08/H09 repetido 3 veces: 6/6 (antes 3/6 fallas).
