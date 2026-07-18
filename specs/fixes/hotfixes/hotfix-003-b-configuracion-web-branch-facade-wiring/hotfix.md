# Hotfix: Unificar source of truth de sede en configuración web
> id: hotfix-003-b-configuracion-web-branch-facade-wiring
> status: done
> closed: 2026-05-23
> created: 2026-05-23

## Problema
`AdminConfiguracionWebComponent` tenía su propio `selectedBranchId = signal<number>(1)` local
y un toggle interno hardcodeado para branch 1 y 2. Esto duplicaba la responsabilidad del
`BranchSelector` del topbar y violaba la regla de fuente única de verdad.

## Cambio
- **Archivo:** `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts`
- **Qué cambia:**
  - Eliminado `selectedBranchId` (signal local) → reemplazado por `effectiveBranchId` (computed desde `BranchFacade`)
  - Eliminado toggle interno hardcodeado (botones branch 1/2 con emojis)
  - Eliminado `selectedBranchLabel` → reemplazado por `branchLabel` (dinámico desde catálogo)
  - Añadido `noBranchSelected` computed para el caso admin sin sede
  - Añadido empty state cuando admin no tiene sede seleccionada
  - Secretaria: chip minimalista con nombre de sede desde `branchFacade.branches()`
  - Tabs ocultas cuando no hay sede seleccionada
  - Eliminados: `ngOnInit`, `switchBranch()`, `DestroyRef` (sin uso), import `OnInit`
