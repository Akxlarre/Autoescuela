# Fix: La Caja Diaria no queda en dos columnas en notebooks (1366/1440 px) y scrollea la página
> id: fix-192-b-caja-diaria-dos-columnas-notebook
> refs: ASG-i-037 (barrido de rutas B12 de fix-190-b)
> status: done
> created: 2026-10-06

## Root Cause
[Confirmado en el barrido de fix-190-b: secretaria, 1440×900 → `.shell-content` sobra 392 px.]
`cuadratura-content` pone Ingresos y Egresos lado a lado solo con
`@container cuadratura-stack (min-width: 1200px)`: el umbral existe para que la tabla de Ingresos
(8 columnas, ~720 px) quepa completa. Con el menú lateral, una pantalla de 1440 px deja ~1060 px de
contenedor → las cards se apilan, cada una con `min-height: 280px` (`fix-234-m`), y la página
scrollea. Las dos columnas recién aparecen desde ~1580 px de pantalla: en los notebooks típicos de
oficina la Caja nunca es app-like.

## ACs Afectados
Ninguno de una spec previa. ACs propios (decisión del owner 2026-10-06: "Tabla compacta"):

- **F1:** Ingresos y Egresos van lado a lado desde un contenedor de ~900 px (pantallas de ~1280 px
  en adelante), sin scroll de página en 1440×900.
- **F2:** con la tabla de Ingresos angosta (contenedor < 800 px), las 4 columnas de medio de pago
  (Efectivo, Transf., Voucher, Tarjeta) se reemplazan por una columna "Medio" (el medio usado, o
  "Mixto" si hubo más de uno). El Total no cambia. Con espacio, la tabla completa como hoy.
- **F3:** se mantiene lo decidido en `fix-230-m`/`fix-234-m`: los dos juntos, del mismo tamaño, y
  con el drawer abierto siguen apilados.

## Cambio
- `src/app/core/utils/cuadratura-medio-pago.utils.ts` (+ spec) — etiqueta "Medio" (función pura).
- `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts` — umbral de 2
  columnas y modo compacto de la tabla por container query.

## Test de Regresión
- `npx vitest run src/app/core/utils/cuadratura-medio-pago.utils.spec.ts`
- `e2e/barrido-rutas.spec.ts -g B12` (secretaria 1440: app-like) contra el build de producción.

## Resultado (2026-10-06)
- `cuadratura-medio-pago.utils.spec.ts` 3/3. `npm run test:ci` 3362/3362, `ng build` OK,
  `lint:arch` 0 errores.
- Barrido `e2e/barrido-rutas.spec.ts -g B12` (rama fix-190-b) contra el build de producción:
  **6/6** — secretaria en 1440 claro y oscuro ya es app-like y sin scroll horizontal.
- Capturas adicionales: **1280** → 2 columnas, tabla compacta · **1920** → 2 columnas, tabla
  compacta · **1440 con drawer abierto** → apilado como antes (sin cambio).
- Durante la verificación aparecieron 2 ajustes, ambos dentro de este fix: (1) en fila, las cards
  usaban el `flex: 1 0 auto` pensado para repartir alto y Egresos se salía 75 px por la derecha →
  en fila `flex: 1 1 0%` + `min-width: 0`; (2) la tabla completa con menos de 800 px dejaba la glosa
  en ~80 px → el modo compacto aplica bajo 800 px (la tabla completa sigue con la Caja apilada).
