# Fix: H-007 — skeletons faltantes en Agenda y Libro de Clases
> id: fix-074-b-skeletons-agenda-libro-clases
> refs: ASG-b-022
> status: in_progress
> created: 2026-07-31

## Root Cause
[Heredado de ASG-b-022, a confirmar]: Al entrar por primera vez a `/app/admin/agenda` (~4s) o
`/app/admin/libro-de-clases` (~3s), el `<main>` queda completamente vacío (sin ningún
`<app-skeleton-block>`) hasta que llega la data. Viola el canon de skeletons/SWR del proyecto
(`.claude/rules/swr-pattern.md`, `.claude/rules/visual-system.md`) — todo componente que carga
datos async debe resolver el skeleton internamente con `@if (loading())`.

⚠️ Coordinar con `ASG-b-001`/`fix-071-b`: esta asignación es el FIX del bug ya confirmado ahí, no
duplicar el diagnóstico — solo implementar.

## ACs Afectados
Ninguno — fix autónomo, sin AC de spec previa.

## Cambio
- **Archivo:** `src/app/features/admin/agenda/admin-agenda.component.ts` (y/o
  `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts`, según dónde viva la
  carga real)
- **Archivo:** `src/app/features/admin/libro-de-clases/admin-libro-de-clases.component.ts`
- **Qué cambia:** agregar `<app-skeleton-block>` con `@if (loading())` en ambas páginas, patrón
  "Single-Component Skeleton" ya usado en el resto del repo (ver `indices/COMPONENTS.md`).

## Test de Regresión
⚠️ Este proyecto no tiene tests de componentes Angular (`vitest.config` los excluye).
- Verificación real: throttling de red (o carga en frío) en `/app/admin/agenda` y
  `/app/admin/libro-de-clases` — confirmar que el skeleton aparece de verdad, no solo que el
  código lo referencia. `ng build` + `npm run lint:arch` limpios.
