# Asignación ASG-004 — Cobertura data-llm-* — Lote 1: Admin Flota + Documentos + Certificados

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

`ai-readability.md` (Shadow Semantic Overlay) exige `data-llm-action`/`data-llm-description`/`data-llm-nav` en todo elemento interactivo, para que agentes que inspeccionen el DOM no tengan que adivinar. Un grep exhaustivo encontró 35 archivos con `<button>`/`<input>` sin ningún atributo de estos. Este lote cubre 9 archivos del área de Flota/Documentos/Certificados.

## Alcance sugerido

Archivos de este lote (ninguno se superpone con ASG-005/006/007):
- `src/app/features/admin/documentos/alumno-docs-detalle/admin-alumno-docs-detalle.component.ts`
- `src/app/features/admin/documentos/dms-template-drawer/dms-template-drawer.component.ts`
- `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts`
- `src/app/features/admin/flota/route-sheet/route-sheet.component.ts`
- `src/app/features/admin/flota/vehicle-agenda-drawer/vehicle-agenda-drawer.component.ts`
- `src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`
- `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
- `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
- `src/app/features/admin/profesional-certificados/drawers/historial-emisiones-prof-drawer.component.ts`

Para cada botón: `data-llm-action="verbo-kebab-case"` si ejecuta una acción (mutación de negocio o UI relevante como cerrar/cancelar). Para inputs críticos: `data-llm-description="..."` en inglés corto. No tocar lógica, solo atributos HTML.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, Fase 5.9 (iteración 25) — tiene el patrón ya usado en 3 archivos completos como ejemplo de convención (`historial-emisiones-drawer.component.ts`, `configurador-horarios-drawer.component.ts`, `general-tab.component.ts`).
- `.claude/rules/ai-readability.md`.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/documentos/alumno-docs-detalle/admin-alumno-docs-detalle.component.ts`
- `src/app/features/admin/documentos/dms-template-drawer/dms-template-drawer.component.ts`
- `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts`
- `src/app/features/admin/flota/route-sheet/route-sheet.component.ts`
- `src/app/features/admin/flota/vehicle-agenda-drawer/vehicle-agenda-drawer.component.ts`
- `src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`
- `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
- `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
- `src/app/features/admin/profesional-certificados/drawers/historial-emisiones-prof-drawer.component.ts`

## Notas para quien la reclame

- Prioridad baja, cosmético — buen candidato para alguien con poco tiempo o nuevo en el repo.
- Verificar `npm run test:ci` al final (debería seguir 100% verde, son solo atributos HTML).
