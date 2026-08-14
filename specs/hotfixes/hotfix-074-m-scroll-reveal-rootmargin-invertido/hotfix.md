# Hotfix: rootMargin invertido en animateScrollReveal deja todo oculto hasta scrollear
> id: hotfix-074-m-scroll-reveal-rootmargin-invertido
> refs: fix-171-m-scroll-reveal-intersection-observer
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Problema
`GsapAnimationsService.animateScrollReveal()` (fix-171-m) usa `rootMargin: '0px 0px -${Math.round((1-threshold)*100)}% 0px'` con `threshold: 0`. El signo está invertido: un `rootMargin` bottom negativo ENCOGE la zona efectiva del viewport considerada "visible" — con el threshold default (0.15) deja solo el 15% superior del viewport como zona válida de intersección. Resultado: los elementos solo se revelan al scrollear casi hasta arriba de la pantalla, incluso si ya estaban completamente visibles al cargar la página (confirmado: ni las primeras cards, ya visibles sin scrollear, aparecían).

## Cambios
- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts` — en `animateScrollReveal()`, eliminar el `rootMargin` calculado y usar directamente `threshold` (la opción nativa de `IntersectionObserver`, "fracción del elemento visible") en las opciones del observer. Los elementos ya visibles en el viewport al montarse disparan `isIntersecting:true` en el primer chequeo, sin necesitar scroll.
