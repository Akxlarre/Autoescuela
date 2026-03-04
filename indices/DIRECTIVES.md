# Registro de Directivas

> **Regla de Actualización:** El Agente debe sugerir adiciones a esta tabla usando `<memory_update>` cada vez que cree una directiva nueva o modifique una existente.

## Directivas de Animación / GSAP

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `AnimateInDirective` | `[appAnimateIn]` | Fade+slide de entrada para elementos bajo `@if` | — | ✅ Estable |
| `CardHoverDirective` | `[appCardHover]` | Efecto hover GSAP sobre `.card` (sombra + y:-2px) | — | ✅ Estable |
| `BentoGridLayoutDirective` | `[appBentoGridLayout]` | FLIP animado para reflows del bento-grid | — | ✅ Estable |

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
