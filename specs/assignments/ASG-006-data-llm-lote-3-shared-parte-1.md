# Asignación ASG-006 — Cobertura data-llm-* — Lote 3: shared/components parte 1

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

Tercer lote de cobertura `data-llm-*` (ver ASG-004 para el contexto completo de la regla).

## Alcance sugerido

Archivos de este lote (ninguno se superpone con ASG-004/005/007):
- `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts`
- `src/app/shared/components/alert-card/alert-card.component.ts`
- `src/app/shared/components/alumnos-por-vencer-drawer/alumnos-por-vencer-drawer.component.ts`
- `src/app/shared/components/async-btn/async-btn.component.ts`
- `src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts`
- `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
- `src/app/shared/components/dms-viewer-modal/dms-viewer-modal.component.ts`
- `src/app/shared/components/drawer-form/drawer-form.component.ts`

Nota especial para `async-btn.component.ts`: es un botón wrapper genérico (probablemente recibe su label/acción del componente consumidor vía `input()`) — si el `data-llm-action` depende del contexto de uso, considerar exponerlo como un `input()` opcional en vez de hardcodear un valor genérico.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, Fase 5.9 (iteración 25).
- `.claude/rules/ai-readability.md`.

## Notas para quien la reclame

- Prioridad baja, cosmético. `drawer-form.component.ts` es un componente base reutilizado en muchos drawers — revisar con cuidado de no romper su API pública (`input()`/`output()`).
