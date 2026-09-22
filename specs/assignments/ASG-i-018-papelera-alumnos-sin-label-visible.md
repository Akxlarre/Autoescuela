# Asignación ASG-i-018 — Botón "Papelera" de listados de alumnos sin label visible

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P3
> **created:** 2026-09-22
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** hotfix-004-i-papelera-alumnos-sin-label-visible

---

## Contexto / Objetivo

Encontrado durante el QA de `fix-037-i-qa-visual-piloto` (ASG-i-012). El botón que abre la
vista de papelera (alumnos archivados) en `admin-alumnos.component.ts` (grupo "Acciones
principales", junto a "Nueva Matrícula") solo tiene ícono, sin texto visible ni
`data-llm-action`/`aria-label` explícito distinguible del resto de los botones del grupo —
indistinguible de "Nueva Matrícula" hasta hacer clic.

## Alcance sugerido

Ver `specs/hotfixes/hotfix-004-i-papelera-alumnos-sin-label-visible/hotfix.md` — agregar
tooltip visible (`pTooltip`) y `data-llm-action="toggle-papelera-alumnos"`. Fix mecánico y de
bajo riesgo, no cambia comportamiento.

## Archivos involucrados

- `admin-alumnos.component.ts` (y su equivalente `admin-alumnos-profesional.component.ts` si
  comparte el mismo patrón — verificar)

## Notas para quien la reclame

El track `hotfix-004-i-papelera-alumnos-sin-label-visible` ya existe con el diagnóstico
completo. Es un hotfix simple — buen candidato para alguien con poco tiempo disponible.
