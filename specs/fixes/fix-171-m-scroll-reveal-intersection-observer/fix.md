# Fix: appScrollReveal sigue sin revelar elementos — ScrollTrigger reemplazado por IntersectionObserver
> id: fix-171-m-scroll-reveal-intersection-observer
> refs: fix-170-m-scroll-reveal-scroller-shell-content
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause
`fix-170-m` corrigió el `scroller` de `ScrollTrigger`, pero el bug persiste (ahora casi siempre, no intermitente) por una segunda causa compuesta: `ScrollTrigger.create()` calcula la posición de trigger del elemento **una sola vez**, en el momento de la creación, y solo la re-evalúa ante eventos `scroll`/`resize` del scroller. `InstructorFichaComponent` usa `appBentoReveal` (→ `animateBentoGrid()`) sobre el `.bento-grid` raíz, que anima de entrada (transform/opacity) el mismo árbol DOM que contiene la card de ficha técnica (con su propio `appScrollReveal`). Si la animación del padre sigue en curso cuando `ScrollTrigger.create()` calcula la posición del hijo, esa posición queda obsoleta. Como `hotfix-070-m`/`071-m` (bento-grid--hero-fit) redujo la altura de la página, ahora frecuentemente no hace falta scrollear, así que nunca se dispara el evento que forzaría el recálculo — el elemento queda en `opacity:0` permanente. El JSDoc de la función ya decía "Usa IntersectionObserver como fallback si ScrollTrigger no está disponible", pero ese fallback nunca se implementó.

## ACs Afectados
Ninguno — fix autónomo (bug de infraestructura visual).

## Cambio
- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts`
- **Qué cambia:** `animateScrollReveal()` reemplaza `ScrollTrigger.create()` por un `IntersectionObserver` nativo (`rootMargin` negativo en el borde inferior para replicar el umbral `top X%` anterior). Un `IntersectionObserver` reevalúa la intersección real de forma continua — se autocorrige ante cualquier layout shift posterior de un padre — y su `root` por defecto (`null` = viewport) ya maneja correctamente contenedores con scroll interno anidados, sin necesitar `scroller`/`findScrollContainer`. Se elimina el registro de `ScrollTrigger` (`gsap.registerPlugin`) y su import, al quedar sin otros usos en el servicio.

## Test de Regresión
- `src/app/core/services/ui/gsap-animations.service.spec.ts > animateScrollReveal (fix-171-m)` — verifica: (1) estado inicial oculto (`gsap.set` con opacity 0), (2) el elemento se revela cuando el `IntersectionObserver` reporta `isIntersecting: true`, (3) modo reducido/no-browser sigue mostrando el elemento de inmediato sin animación. ✓
