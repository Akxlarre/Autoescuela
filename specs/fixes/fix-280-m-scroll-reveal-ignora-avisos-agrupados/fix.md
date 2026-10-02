# Fix: Contenido invisible cuando el reveal recibe dos avisos de visibilidad juntos
> id: fix-280-m-scroll-reveal-ignora-avisos-agrupados
> refs: fix-171-m (introdujo el IntersectionObserver en `animateScrollReveal`), ASG-i-024 (reportado por el owner al revisar la Base de Alumnos B)
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Síntoma

Reportado por el owner (2026-10-02): en la Base de Alumnos B, con "Todas las sedes", a veces el
panel "Nueva Matrícula" se abre vacío. Reproducido con Playwright: 6 de 8 aperturas.

El contenido sí está en el DOM (la pantalla "Selecciona una sede"), pero su contenedor queda en
`opacity: 0` con `translateY(32px)`: el estado inicial de la animación de entrada, que nunca
llega a ejecutarse.

## Root Cause

`GsapAnimationsService.animateScrollReveal()` oculta el elemento y espera a que un
`IntersectionObserver` avise que entró en pantalla. El callback solo mira **el primer aviso** del
lote:

```ts
if (!entries[0]?.isIntersecting) return;
```

El navegador puede entregar **varios avisos del mismo elemento en una sola llamada**. Con el panel
lateral pasa casi siempre: el elemento se observa mientras el panel todavía mide 0 px (aviso "no
visible") y un instante después el panel empieza a abrirse (aviso "visible"). Si ambos llegan
juntos, `entries[0]` es el "no visible", el código retorna, y como el elemento ya no vuelve a
cruzar el umbral, no hay más avisos: queda invisible para siempre.

Medición en el navegador (callback instrumentado), apertura fallida:

```
entries = [ { isIntersecting: false, ratio: 0 }, { isIntersecting: true, ratio: 0.66 } ]
```

Apertura correcta: los mismos dos avisos, pero en dos llamadas separadas.

No es exclusivo de "Todas las sedes" ni de Nueva Matrícula: afecta a cualquier elemento con
`appScrollReveal` que se monte mientras su contenedor está cambiando de tamaño. Ahí se nota más
porque la pantalla "Selecciona una sede" es todo el contenido del panel.

## ACs Afectados

Ninguno de una spec — fix autónomo. Comportamiento esperado:

- Si en un mismo lote de avisos alguno indica que el elemento es visible, el elemento se revela.
- Si ningún aviso del lote indica visibilidad, sigue oculto y se sigue observando.

## Cambio

- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts`
- **Qué cambia:** el callback de `animateScrollReveal()` revela el elemento si **cualquier** aviso
  del lote es visible (`entries.some(...)`), no solo el primero.

## Test de Regresión

- `src/app/core/services/ui/gsap-animations.service.spec.ts > animateScrollReveal > reveals the
  element when a batch carries a stale non-intersecting entry before the intersecting one
  (fix-280-m)`
- Navegador: 8 aperturas seguidas de "Nueva Matrícula" desde `/app/admin/alumnos` con "Todas las
  sedes"; en todas el contenido queda con `opacity: 1`.

## Verificación (2026-10-02)

- Test de regresión: falla sin el cambio, pasa con él. Suite completa en verde.
- Navegador: 16 de 16 aperturas de "Nueva Matrícula" muestran el contenido (antes del cambio,
  2 de 8).
