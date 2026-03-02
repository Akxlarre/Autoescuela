# GsapAnimationsService

## Propósito

**Fuente única de animaciones en la app.** Todas las animaciones usan este servicio. NUNCA `@angular/animations` ni CSS `@keyframes`.

Respeta `prefers-reduced-motion` y registra plugins GSAP solo en browser.

## API pública (principales)

| Método | Descripción |
|--------|-------------|
| `animateBentoGrid(containerEl)` | Entrada stagger de celdas bento |
| `animateHero(el)` | Entrada hero con blur + scale |
| `animateCounter(el, target, suffix)` | Contador animado para KPIs |
| `addCardHover(el)` | Hover en cards (sombra, elevación). Usa tokens `--card-shadow`, `--card-shadow-hover`, `--border-default`, `--border-strong` (white-labeling). |
| `addButtonHover(el)` | Hover en botones |
| `addPressFeedback(el)` | Feedback press en triggers |
| `addInteractiveFeedback(el)` | Feedback combinado (hover + press) |
| `animateThemeChange(onSwap, origin?)` | Cambio de tema. Ejecuta `onSwap` y deja el suavizado a transiciones CSS de colores. `origin` es opcional y actualmente no se usa. |
| `animateThemeToggleIcon(iconEl)` | Animación del icono sol/luna al cambiar tema |
| `animatePanelIn(el)` / `animatePanelOut(el)` | Panel overlay |
| `animateDrawer(drawerEl, open)` | Drawer lateral |
| `animateToastIn(el)` / `animateToastOut(el)` | Toasts |
| `animateInputError(el)` | Shake en errores de validación |
| `animateSkeletonToContent(el)` | Transición skeleton → contenido |

## Cuándo usarlo

- **Siempre** para cualquier animación en la app
- Cards con hover → `addCardHover`
- Botones, pills → `addButtonHover`, `addPressFeedback`
- Contadores KPI → `animateCounter`
- Paneles, drawers, modales → métodos `animate*` correspondientes

## Cuándo no usarlo

- NUNCA usar `@angular/animations` ni `animate()`
- NUNCA usar CSS `@keyframes` para animaciones de UI

## Dependencias

- `gsap`, `ScrollTrigger` (plugins)
- `PLATFORM_ID` (SSR-safe)
