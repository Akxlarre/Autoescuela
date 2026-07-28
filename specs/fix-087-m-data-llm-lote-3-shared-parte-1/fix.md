# Fix: Cobertura data-llm-* — Lote 3: shared/components parte 1
> id: fix-087-m-data-llm-lote-3-shared-parte-1
> refs: ASG-006
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
[Heredado de ASG-006, a confirmar]: Tercer lote de cobertura `data-llm-*` (ver
`.claude/rules/ai-readability.md`). 8 archivos de `shared/components/` no tienen aplicado el
Shadow Semantic Overlay (`data-llm-action` en botones de mutación, `data-llm-description` en
inputs críticos, `data-llm-nav` en enlaces de navegación), dejando esos nodos sin certeza
explícita de propósito para agentes IA externos que inspeccionen el DOM.

## ACs Afectados
Ninguno — fix autónomo de deuda técnica (cobertura de atributos, no lógica de negocio).

## Cambio
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts`
- **Archivo:** `src/app/shared/components/alert-card/alert-card.component.ts`
- **Archivo:** `src/app/shared/components/alumnos-por-vencer-drawer/alumnos-por-vencer-drawer.component.ts`
- **Archivo:** `src/app/shared/components/async-btn/async-btn.component.ts` — nota especial de
  ASG-006: es un botón wrapper genérico; si `data-llm-action` depende del contexto de uso,
  exponerlo como `input()` opcional en vez de hardcodear un valor genérico.
- **Archivo:** `src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts`
- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
- **Archivo:** `src/app/shared/components/dms-viewer-modal/dms-viewer-modal.component.ts`
- **Archivo:** `src/app/shared/components/drawer-form/drawer-form.component.ts` — componente
  base reutilizado en muchos drawers; cuidado de no romper su API pública (`input()`/`output()`).

## Test de Regresión
- `npm run test:ci` → 100% verde, sin cambios de lógica (solo atributos `data-llm-*`).
- `npm run lint:arch` → sin regresiones nuevas.
