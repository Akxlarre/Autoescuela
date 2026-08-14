# Fix: appScrollReveal nunca revela elementos porque ScrollTrigger escucha `window` en vez de `.shell-content`
> id: fix-170-m-scroll-reveal-scroller-shell-content
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause
`GsapAnimationsService.animateScrollReveal()` pone el elemento en `opacity:0` y crea un `ScrollTrigger.create({ trigger: el, ... })` sin especificar `scroller`. GSAP usa `window` como scroller por defecto, pero el scroll real de la app ocurre dentro de `<main class="shell-content overflow-y-auto ...">` (`app-shell.component.ts:190`), no en `window` — arquitectura ya documentada en `secretaria-matricula.component.scss` ("el real es .shell-content ... un `<div>` de bloque"). Como `window` nunca dispara scroll, `ScrollTrigger` nunca recalcula tras el scroll interno de `.shell-content`: si el elemento queda fuera del umbral `start` en el momento de crear el trigger, `onEnter` nunca se dispara y el elemento queda permanentemente invisible (o se percibe "borroso" si el cálculo inicial coincide justo en el borde del umbral). Afecta a toda página que use la directiva `appScrollReveal` (instructor-ficha, alumno-horario, alumno-clases, instructor-liquidacion, secretaria-matricula, secretaria-dashboard), y es más visible en `InstructorFichaComponent` porque su card de tabla suele quedar fuera del viewport inicial.

## ACs Afectados
Ninguno — fix autónomo (bug de infraestructura visual, no de una spec de negocio).

## Cambio
- **Archivo:** `src/app/core/utils/scroll-container.util.ts` (nuevo)
- **Qué cambia:** función pura `findScrollContainer(el, selector = '.shell-content')` que devuelve el ancestro scrolleable real vía `el.closest(selector)`, o `null` si no existe (páginas sin shell, ej. pre-auth).
- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts`
- **Qué cambia:** `animateScrollReveal()` pasa `scroller: findScrollContainer(el) ?? window` a `ScrollTrigger.create()`, para que el trigger escuche el scroll del contenedor real en vez de `window`.

## Test de Regresión
- `src/app/core/utils/scroll-container.util.spec.ts > findScrollContainer` — devuelve el ancestro `.shell-content` más cercano cuando existe, y `null` cuando no hay ninguno. ✓
