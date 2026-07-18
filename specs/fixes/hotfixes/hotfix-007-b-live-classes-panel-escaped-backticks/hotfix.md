# Hotfix: live-classes-panel styles backticks escapados
> id: hotfix-007-b-live-classes-panel-escaped-backticks
> status: done
> closed: 2026-06-18
> created: 2026-06-18

## Problema
`live-classes-panel.component.ts` tiene `styles: [\`...\`]` con backticks escapados
en lugar de backticks literales. Causa TS1127/TS1160 (invalid character / unterminated
template literal) y rompe `ng build --configuration development`.

## Cambios
- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts` — Reemplazar `\`` por `` ` `` en el array `styles`
