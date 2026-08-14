# Fix: Scroll automático al topbar al seleccionar nota global en evaluación práctica del instructor
> id: fix-172-m-evaluacion-nota-global-scroll-topbar
> refs: —
> status: done
> created: 2026-08-13

## Root Cause
El radio de "Nota Global" está oculto con `sr-only` (`position: absolute`) dentro de un
`<label class="cursor-pointer">` sin `position: relative`. Al hacer click, el input recibe foco
y — sin un ancestro posicionado cercano — el navegador calcula su posición muy lejos del punto
de click y hace scroll automático para "traerlo a la vista", empujando toda la página hacia
arriba y tapando el breadcrumb/título detrás del topbar.

## ACs Afectados
Ninguno — fix autónomo (bug visual reportado directamente por el usuario, sin spec asociada).
- AC-1: Al seleccionar cualquier nota global (3-7) en Evaluación Práctica, la página no debe
  scrollear ni el breadcrumb/título deben quedar ocultos tras el topbar.

## Cambio
- **Archivo:** `src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts`
- **Qué cambia:** Se agrega `relative` al `<label>` que envuelve el radio `sr-only` de nota
  global, para que el input oculto quede anclado a su label y el navegador no necesite
  scrollear para enfocarlo.

## Test de Regresión
- Verificación manual/visual (Playwright `/verify`): seleccionar una nota global en
  `/app/instructor/evaluacion/:id/:sessionId` y confirmar que el breadcrumb "Ficha Técnica /
  Evaluación Práctica" permanece visible bajo el topbar tras el click.
- ✓ Verificado por el usuario directamente en el navegador (2026-08-13): correcto, ya no hay
  scroll ni contenido tapado por el topbar.
