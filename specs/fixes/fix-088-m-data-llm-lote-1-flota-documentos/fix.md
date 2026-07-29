# Fix: Cobertura data-llm-* — Lote 1: Admin Flota + Documentos + Certificados
> id: fix-088-m-data-llm-lote-1-flota-documentos
> refs: ASG-b-004
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
[Heredado de ASG-b-004, a confirmar]: `ai-readability.md` (Shadow Semantic Overlay) exige
`data-llm-action`/`data-llm-description`/`data-llm-nav` en todo elemento interactivo, para que
agentes que inspeccionen el DOM no tengan que adivinar. Un grep exhaustivo encontró 35 archivos
con `<button>`/`<input>` sin ningún atributo de estos. Este lote cubre 9 archivos del área de
Flota/Documentos/Certificados.

## ACs Afectados
Ninguno — fix autónomo de deuda técnica (cobertura de atributos, no lógica de negocio).

## Cambio
- **Archivo:** `src/app/features/admin/documentos/alumno-docs-detalle/admin-alumno-docs-detalle.component.ts`
- **Archivo:** `src/app/features/admin/documentos/dms-template-drawer/dms-template-drawer.component.ts`
- **Archivo:** `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts`
- **Archivo:** `src/app/features/admin/flota/route-sheet/route-sheet.component.ts`
- **Archivo:** `src/app/features/admin/flota/vehicle-agenda-drawer/vehicle-agenda-drawer.component.ts`
- **Archivo:** `src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
- **Archivo:** `src/app/features/admin/profesional-certificados/drawers/historial-emisiones-prof-drawer.component.ts`

## Test de Regresión
- `npm run test:ci` → 100% verde, sin cambios de lógica (solo atributos `data-llm-*`).
- `npm run lint:arch` → sin regresiones nuevas.
