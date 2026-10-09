# Fix: hueco bajo la barra de pestañas en móvil y tablet (Comunicación y Anticipos)
> id: fix-359-m-hueco-bajo-la-barra-de-pestanas-en-movil
> refs: fix-319-m-testing-clase-profesional-piloto (observación de fix-355-m) · ASG-i-025 · fix-081
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
En Comunicación (`/app/admin/tareas`, `/app/secretaria/observaciones`) la barra de canales
(`<app-tabs class="bento-banner">`) es una celda propia del bento grid. Fuera de escritorio las
filas del grid son automáticas con un piso de 120 px (`--bento-row-min`, pensado para que las
celdas cuadradas se vean cuadradas), así que la fila de la barra mide 120 px aunque su contenido
mida 40–52 px: quedan ~80 px vacíos entre la barra y la lista. En escritorio no pasa porque
`.bento-grid--fill-screen-kpi` define las filas explícitamente (medido el 2026-10-07: fila de 120 px
a 375 y 768 px, de 52 px a 1440).

El sistema ya tiene el modificador para este caso, `.bento-grid--rows-fit` (fix-081: grids
compuestos solo por celdas de ancho completo, sin celdas cuadradas); estas pantallas no lo llevan.
Anticipos (`admin-contabilidad-anticipos`) tiene la misma estructura.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- `admin-tareas.component.ts`, `secretaria-observaciones.component.ts` y
  `admin-contabilidad-anticipos.component.ts`: el grid raíz suma `bento-grid--rows-fit`. Sus celdas
  son todas `.bento-banner`. El layout de escritorio (filas explícitas) no cambia.

## Test de Regresión
Navegador, a 375 y 768 px: la fila de la barra mide lo que su contenido y la lista queda a un gap
de distancia. A 1440 px las posiciones y alturas de las celdas son las mismas que antes.

## Progreso
- [x] Medición antes (admin): fila de la barra de 120 px a 375 y 768 px en `/app/admin/tareas` y
  en `/app/admin/contabilidad/anticipos`; 52 y 40 px a 1440.
- [x] Implementación: `bento-grid--rows-fit` en los 3 grids. `tsc` sin errores, `lint:arch` 0 errores.
- [x] Medición después: la fila mide 40 px (375) y 52 px (768) en Comunicación y 40 px en
  Anticipos; la lista sube ~80 px y queda a un gap de la barra. A 1440 px, filas y posiciones
  iguales a antes (±1 px) y el documento sigue sin scrollear. Captura a 375 px revisada.
  `e2e/barrido-rutas.spec.ts` completo: 56/56. La pantalla de la secretaria
  (`/app/secretaria/observaciones`) lleva el mismo cambio y la cubre el barrido; no se midió aparte.
