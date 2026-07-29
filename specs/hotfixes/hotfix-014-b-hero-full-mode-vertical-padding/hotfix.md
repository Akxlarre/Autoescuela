# Hotfix: Increase hero full-mode vertical padding
> id: hotfix-014-b-hero-full-mode-vertical-padding
> status: done
> closed: 2026-06-19
> created: 2026-06-19

## Problema
El hero en `density="full"` tiene `p-5 md:p-6` (padding uniforme), lo que deja los botones de acción con poco aire vertical. El usuario percibe los botones ajustados en el eje Y.

## Cambios
- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts` — cambiar `p-5 md:p-6` por `px-5 py-7 md:px-6 md:py-8` en el div raíz del modo full
