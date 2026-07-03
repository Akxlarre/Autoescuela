# Registro de Directivas

> **Regla de Actualización:** El Agente debe sugerir adiciones a esta tabla usando `<memory_update>` cada vez que cree una directiva nueva o modifique una existente.

## Directivas de Animación / GSAP

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `AnimateInDirective` | `[appAnimateIn]` | Fade+slide de entrada para elementos bajo `@if` | `appAnimateIn: { useBlur?, delay? } \| ''` | ✅ Estable |
| `CardHoverDirective` | `[appCardHover]` | Efecto hover GSAP: **glow de marca** (`--card-shadow-hover-glow`) + `y: -2px`. Sin sombra negra ni borde gris. Auto-cleanup via `DestroyRef.onDestroy()`. El glow usa `0 0 0 1px` (anillo nítido) + `0 12px 28px -6px` (difuso solo hacia afuera/abajo, sin bleed interior). Token sky-500 en light, sky-400 en dark. | — | ✅ Estable |
| `BentoGridLayoutDirective` | `[appBentoGridLayout]` | FLIP animado para reflows del bento-grid + **flash-fix universal** (pre-hide pre-paint `.is-reveal-pending` con safety-net en `afterNextRender`, guard SSR). Toda página con bento queda libre de parpadeo de entrada sin migración. | — | ✅ Estable |
| `BentoRevealDirective` | `[appBentoReveal]` | **Patrón canónico** de entrada premium del bento-grid (sin flash). Acopla pre-hide pre-paint (`.is-reveal-pending`) + reveal en `afterNextRender` vía `animateBentoGrid`. Reemplaza el patrón manual `#bentoGrid viewChild + ngAfterViewInit`. Para grids con contenido presente en el 1er paint. SWR con swap `@if/@else` siguen usando `effect()`. | `skipOpacity: boolean` (true si una View Transition ya hace el fade) | ✅ Estable |
| `ScrollRevealDirective` | `[appScrollReveal]` | ScrollTrigger reveal (fade+slide) al entrar al viewport. Acepta `{ y, delay, threshold }`. Auto-cleanup vía `DestroyRef`. Respeta `prefers-reduced-motion`. | `appScrollReveal: { y?, delay?, threshold? } \| ''` | ✅ Estable |

## Directivas de Auth / RBAC

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `HasRoleDirective` | `*appHasRole` | Renderizado condicional por rol (estructural) | `appHasRole: UserRole\|UserRole[]` | ✅ Estable |

## Directivas de UX Interactiva

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `PressFeedbackDirective` | `[appPressFeedback]` | Hover+press GSAP sobre botones y triggers | `appPressFeedback: 'full'\|'press'` | ✅ Estable |
| `SearchShortcutDirective` | `[appSearchShortcut]` | Atajo global Ctrl+K / Cmd+K → SearchPanelService | — | ✅ Estable |
| `ClickOutsideDirective` | `[appClickOutside]` | Emite evento al hacer clic fuera del elemento host | `clickOutsideEnabled: boolean` | ✅ Estable |

## Directivas de Layout

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `ModalOverlayDirective` | `[appModalOverlay]` | Teleporta el modal al overlay container (z-index > topbar) | `appModalOverlay: boolean` | ✅ Estable |
| `ScrollContainerDirective` | `[appScrollContainer]` | Scroll interno vertical/horizontal con `max-height` configurable. Evita desborde en páginas y drawers. Scrollbar usa tokens del DS. | `maxHeight: string` (`'65vh'`), `scrollX: boolean` (`false`) | ✅ Estable |

## Auto-Index — Directivas detectadas por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Clase | Selector | Inputs | Outputs | Archivo |
|-------|----------|--------|---------|---------|
| `AnimateInDirective` | `[appAnimateIn]` | `appAnimateIn` | — | `src/app/core/directives/animate-in.directive.ts` |
| `BENTO_GRID_LAYOUT_CONTEXT` | `[appBentoGridLayout]` | — | — | `src/app/core/directives/bento-grid-layout.directive.ts` |
| `BentoRevealDirective` | `[appBentoReveal]` | `skipOpacity` | — | `src/app/core/directives/bento-reveal.directive.ts` |
| `CardHoverDirective` | `[appCardHover]` | — | — | `src/app/core/directives/card-hover.directive.ts` |
| `ClickOutsideDirective` | `[appClickOutside]` | `clickOutsideEnabled`, `clickOutsideExclude` | `clickOutside` | `src/app/core/directives/click-outside.directive.ts` |
| `HasRoleDirective` | `[appHasRole]` | `appHasRole` | — | `src/app/core/directives/has-role.directive.ts` |
| `ModalOverlayDirective` | `[appModalOverlay]` | `appModalOverlay` | — | `src/app/core/directives/modal-overlay.directive.ts` |
| `PressFeedbackDirective` | `[appPressFeedback]` | `appPressFeedback` | — | `src/app/core/directives/press-feedback.directive.ts` |
| `ScrollContainerDirective` | `[appScrollContainer]` | `maxHeight`, `scrollX` | — | `src/app/core/directives/scroll-container.directive.ts` |
| `ScrollRevealDirective` | `[appScrollReveal]` | `appScrollReveal` | — | `src/app/core/directives/scroll-reveal.directive.ts` |
| `SearchShortcutDirective` | `[appSearchShortcut]` | — | — | `src/app/core/directives/search-shortcut.directive.ts` |

<!-- AUTO-GENERATED:END -->
