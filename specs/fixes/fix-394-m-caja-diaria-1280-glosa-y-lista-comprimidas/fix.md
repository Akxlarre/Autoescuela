# Fix: Caja Diaria a 1280 px — la columna de glosa mide 18 px y la lista de ingresos 50 px de alto
> id: fix-394-m-caja-diaria-1280-glosa-y-lista-comprimidas
> refs: fix-192-b (modo dos columnas desde 900 px), 0025-m (donde se observó)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Root Cause

Desde fix-192-b la Caja pone Ingresos y Egresos lado a lado cuando su celda mide 900 px o más
(pantallas de ~1280 px). Entre 900 y ~1200 px cada card queda en ~440 px de ancho, y ese modo no
tiene una variante angosta:

1. **Tabla de Ingresos.** Su modo compacto (bajo 800 px) usa `70px 1fr 80px 100px 36px`. Las
   columnas fijas, los espacios y el padding suman ~366 px; con una tabla de ~398 px a la glosa
   (`1fr`) le quedan ~18 px.
2. **Alto de la lista.** En ese ancho el encabezado de cada card ocupa ~150 px (el título parte en
   dos líneas y la descripción en tres). Con el alto fijo del modo app-like a 800 px de alto, entre
   encabezado, cabecera de columnas y pie a la lista le quedan ~50 px: menos de una fila.

Medido en /verify de la spec 0025-m a 1280×800: `grid-template-columns: 70px 18px 80px 100px 36px`
y lista de 50 px de alto con una fila de 103 px.

## ACs Afectados

Ninguno — fix autónomo.

- AC-1: a 1280×800, con Ingresos y Egresos lado a lado, la glosa de un ingreso mide al menos
  100 px y se lee sin cortarse a una letra.
- AC-2: a 1280×800, la lista de ingresos muestra al menos una fila completa sin scroll interno.
- AC-3: el medio de pago sigue visible en la fila angosta.
- AC-4: a 1600 px de ancho y en móvil (375 px) la Caja se ve igual que antes.

## Cambio

- **Archivo:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
- **Qué cambia:** tercer modo de la tabla de Ingresos bajo 520 px (el medio de pago pasa a una
  segunda línea bajo la glosa y se libera su columna) y encabezado compacto de las dos cards
  cuando van lado a lado en una celda de menos de 1200 px (sin la línea de descripción).

## Test de Regresión

Es CSS dentro de un componente cuyo template no compila en Vitest (misma limitación documentada en
`cuadratura-content.component.spec.ts`). Se verifica en navegador, midiendo:

- `/verify` a 1280×800: ancho de la glosa ≥ 100 px, alto de la lista ≥ alto de una fila, medio de
  pago visible.
- `/verify` a 1600×900 y 375×812: sin cambios respecto de las capturas de la spec 0025-m.

## Evidencia de Verificación

`/verify` en localhost:4200 como `secretaria@test.com`, sede Autoescuela Chillán, con el pago de
prueba `PRUEBA-0025` (anulado) en la Caja del 13-10-2026.

| Caso | Antes | Después |
|---|---|---|
| AC-1 1280×800: columnas de la fila | `70px 18px 80px 100px 36px` | `64px 158px 88px 32px` (glosa 158 px) |
| AC-2 1280×800: alto visible de la lista | 50 px para una fila de 103 px | 125 px, la fila completa sin scroll interno |
| AC-3 medio de pago | columna "Medio" de 80 px | "Efectivo" en una segunda línea bajo la glosa |
| AC-4 1600×900 | `70px 192px 80px 100px 36px`, descripción visible | igual |
| AC-4 móvil 375×812 | cards, sin scroll horizontal | igual |
| Documento sin scroll en escritorio (app-like), claro y oscuro, consola | — | ✅, 0 errores |

`npm run test:ci` y `npm run lint:arch` en verde (ver commit).
