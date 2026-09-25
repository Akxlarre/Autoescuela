# Asignación ASG-i-019 — Skeleton de Flota dispara NG0955 por track key duplicado

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P3
> **created:** 2026-09-22
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-09-24
> **resulting_track:** hotfix-005-i-skeleton-flota-track-duplicado

---

## Contexto / Objetivo

Encontrado durante el QA de `fix-037-i-qa-visual-piloto` (ASG-i-012). El header del skeleton
desktop de `flota-list-content.component.ts:174` itera un array literal
`['15%', '20%', '15%', '10%', '10%', '12%']` con `track w` (por valor) — hay valores
repetidos ('15%', '10%'), así que Angular no puede diferenciar los items y emite el warning
`NG0955` en consola cada vez que el skeleton se renderiza. Sin impacto visual.

## Alcance sugerido

Ver `specs/hotfixes/hotfix-005-i-skeleton-flota-track-duplicado/hotfix.md` — cambiar
`track w` por `track $index` (los anchos son puramente decorativos, sin identidad propia).
Revisar si el mismo patrón se repite en otros skeletons del proyecto.

## Archivos involucrados

- `src/app/shared/components/flota-list-content/flota-list-content.component.ts:174`

## Notas para quien la reclame

El track `hotfix-005-i-skeleton-flota-track-duplicado` ya existe con el diagnóstico completo.
Hotfix trivial — buen candidato para alguien con poco tiempo disponible.
