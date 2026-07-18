# Hotfix: CardHover — glow de marca en hover (reemplaza sombra+borde)
> id: hotfix-002-b-cardhover-brand-glow
> status: done
> closed: 2026-06-30
> created: 2026-06-29

## Problema
El hover actual cambia sombra negra y borde gris — visualmente ruidoso. El usuario prefiere un halo suave con el color de marca (opción B elegida).

## Cambios
- **Archivo:** `src/styles/tokens/_variables.scss` — agregar token `--card-shadow-hover-glow` en `:root` (sky-500) y en `[data-mode='dark']` (sky-400)
- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts` — `addCardHover` usa `--card-shadow-hover-glow` en enter; elimina cambio de `borderColor`
