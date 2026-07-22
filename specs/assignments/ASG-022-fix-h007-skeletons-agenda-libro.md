# Asignación ASG-022 — Fix H-007: skeletons faltantes en Agenda y Libro de Clases

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Al entrar por primera vez a `/app/admin/agenda` (~4s) o `/app/admin/libro-de-clases` (~3s), el `<main>` queda completamente vacío (sin ningún `<app-skeleton-block>`) hasta que llega la data. Viola el canon de skeletons/SWR del propio proyecto (`.claude/rules/swr-pattern.md`, `.claude/rules/visual-system.md`) — todo componente que carga datos async debe resolver el skeleton internamente con `@if (loading())`.

## Alcance sugerido

- Agregar el patrón `<app-skeleton-block>` con `@if (loading())` en Agenda y Libro de Clases, siguiendo el mismo patrón "Single-Component Skeleton" ya usado en otras páginas del repo (ver `indices/COMPONENTS.md` para ejemplos existentes).
- Verificar visualmente que el skeleton realmente aparece (throttling de red o similar) — no basta con que el código lo referencie.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-007.
- `.claude/rules/swr-pattern.md`, `.claude/rules/visual-system.md` (sección Skeletons y Estados de Carga).

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/agenda/admin-agenda.component.ts`
- `src/app/features/admin/libro-de-clases/admin-libro-de-clases.component.ts`

## Notas para quien la reclame

- ⚠️ **Coordinar con ASG-001** (verificación de skeletons de Benjamín en Fase 5) — esta asignación es el FIX del bug ya confirmado, ASG-001 es la verificación en otras páginas. No dupliquen el diagnóstico de este mismo bug.
