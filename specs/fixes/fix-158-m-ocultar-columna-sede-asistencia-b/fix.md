# Fix: Ocultar columna "Sede" en Asistencia B cuando el filtro ya es de una sola sede
> id: fix-158-m-ocultar-columna-sede-asistencia-b
> refs: —
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
`AsistenciaClaseBContentComponent` (tabla "Asistencia del Día — Prácticas") siempre
renderiza la columna "Sede" (`row.branchName`), sin importar si el listado ya está
acotado a una sola sede. Es redundante para: (a) admin con una sede específica
seleccionada en el topbar, y (b) secretaria, que siempre está anclada a su propia sede
(`AuthFacade.currentUser().branchId`, nunca `null`). Solo aporta valor cuando el admin
está en "Todas las sedes" (`BranchFacade.selectedBranchId() === null`), donde filas de
distintas sedes conviven en la misma tabla.

## ACs Afectados
Ninguno — fix autónomo (ajuste de UI, no corrige un AC de spec previa).

## Cambio
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - **Qué cambia:** nuevo input `showBranchColumn` (default `true`); el `<th>`/`<td>` de
    "Sede" se renderizan condicionados a `@if (showBranchColumn())`.
- **Archivo:** `src/app/features/admin/asistencia/admin-asistencia.component.ts`
  - **Qué cambia:** pasa `[showBranchColumn]="branchFacade.selectedBranchId() === null"`.
- **Archivo:** `src/app/features/secretaria/asistencia/secretaria-asistencia.component.ts`
  - **Qué cambia:** pasa `[showBranchColumn]="false"` (secretaria siempre tiene una sola sede).

## Test de Regresión
- `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.spec.ts > oculta la columna Sede cuando showBranchColumn es false` ✓
