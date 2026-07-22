# Asignación ASG-005 — Cobertura data-llm-* — Lote 2: terminar hero-tab + Config Web resto + varios

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

Segundo lote de cobertura `data-llm-*` (ver ASG-004 para el contexto completo de la regla). Incluye terminar un archivo grande que se dejó a medias (`hero-tab.component.ts`, un "studio" visual con selector de layout, pills de fondo/media y selector de íconos con ~40 botones dinámicos — solo los 4 botones de "Tipo de Fondo" tienen el atributo).

## Alcance sugerido

Archivos de este lote (ninguno se superpone con ASG-004/006/007):
- `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts` — **terminar los ~19 elementos restantes**: pills de media lateral (3), inputs de headline/subheadline/trust-badge/CTA (7), selector de íconos completo (toggle dropdown, buscador, botón limpiar, pills de categoría, grilla de íconos — cada uno del `@for` cuenta como un solo elemento de plantilla, no hace falta tagear cada instancia renderizada).
- `src/app/features/admin/configuracion-web/tabs/promo-tab.component.ts`
- `src/app/features/admin/secretarias/admin-secretarias.component.ts`
- `src/app/features/auth/force-password-change/force-password-change.component.ts`
- `src/app/features/dashboard/dashboard.component.ts`
- `src/app/features/instructor/clase-detail/instructor-clase-detail.component.ts`
- `src/app/features/instructor/notificaciones/instructor-notificaciones.component.ts`

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, Fase 5.9 (iteración 25).
- `.claude/rules/ai-readability.md`.
- `specs/fix-055-b-ai-readability-data-llm-coverage/fix.md` — fix ya cerrado que hizo los primeros 3 archivos completos + el arranque de `hero-tab`, útil como referencia de convención exacta usada.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts`
- `src/app/features/admin/configuracion-web/tabs/promo-tab.component.ts`
- `src/app/features/admin/secretarias/admin-secretarias.component.ts`
- `src/app/features/auth/force-password-change/force-password-change.component.ts`
- `src/app/features/dashboard/dashboard.component.ts`
- `src/app/features/instructor/clase-detail/instructor-clase-detail.component.ts`
- `src/app/features/instructor/notificaciones/instructor-notificaciones.component.ts`

## Notas para quien la reclame

- ⚠️ **Coordinar con ASG-018** (fix H-001/H-002/H-008, toca `dashboard.component.ts` también) — no editar el mismo archivo en paralelo sin avisarse.
- Prioridad baja, cosmético.
