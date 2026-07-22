# Asignación ASG-007 — Cobertura data-llm-* — Lote 4: shared/components parte 2

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Cuarto y último lote de cobertura `data-llm-*` (ver ASG-004 para el contexto completo de la regla).

## Alcance sugerido

Archivos de este lote (ninguno se superpone con ASG-004/005/006):
- `src/app/shared/components/empty-state/empty-state.component.ts`
- `src/app/shared/components/evaluation-checklist/evaluation-checklist.component.ts`
- `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
- `src/app/shared/components/media-upload-control/media-upload-control.component.ts`
- `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts`
- `src/app/shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts`
- `src/app/shared/components/signature-pad/signature-pad.component.ts`
- `src/app/shared/components/tabs/tabs.component.ts`
- `src/app/shared/components/user-panel/user-panel.component.ts`

Nota especial para `public-contract.component.ts`: es parte del wizard público de matrícula — verificar si hay overlap de scope con **ASG-012** (matrícula pública, H-019/H-020/H-033/H-034) antes de tocarlo, aunque los cambios de este lote son solo atributos, no debería chocar con la lógica que toca ASG-012.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, Fase 5.9 (iteración 25).
- `.claude/rules/ai-readability.md`.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/shared/components/empty-state/empty-state.component.ts`
- `src/app/shared/components/evaluation-checklist/evaluation-checklist.component.ts`
- `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
- `src/app/shared/components/media-upload-control/media-upload-control.component.ts`
- `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts`
- `src/app/shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts`
- `src/app/shared/components/signature-pad/signature-pad.component.ts`
- `src/app/shared/components/tabs/tabs.component.ts`
- `src/app/shared/components/user-panel/user-panel.component.ts`

## Notas para quien la reclame

- Prioridad baja, cosmético. `tabs.component.ts` es un componente base reutilizado en muchas páginas — revisar con cuidado.
