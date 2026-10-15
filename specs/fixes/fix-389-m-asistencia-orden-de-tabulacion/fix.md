# Fix: en Asistencia B el teclado recorre todas las alertas antes de llegar a la tabla
> id: fix-389-m-asistencia-orden-de-tabulacion
> refs: fix-366-m-testing-asistencia-clase-b (O05) · ASG-i-027 · 0030-b
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 4 de `fix-366-m`, O05: con solo teclado, después de las pestañas "Prácticas / Ciclos
Teóricos" el foco entra al panel de alertas y pasa por el botón de cada alumno ("Eliminar",
"Reactivar"): 70 con los datos de prueba. Recién después llega a la fecha, los filtros y la tabla
del día, que es el trabajo principal y que en pantalla está primero (a la izquierda en escritorio,
arriba en móvil).

## Root Cause

En `asistencia-clase-b-content.component.ts` el HTML tiene `[alertas, tabla]` y el orden visible
se invierte con `order-1` / `order-2`. El orden de tabulación sigue al HTML, no al CSS.

## Fix

La tabla va primero en el HTML y el panel de alertas después; se quitan `order-1` y `order-2`. El
resultado visual es el mismo.

## Acceptance Criteria

- [x] AC1 — Desde las pestañas, el siguiente Tab cae en el selector de fecha de la tabla, no en el
  panel de alertas.
- [x] AC2 — La disposición no cambia: tabla a la izquierda y alertas a la derecha en escritorio;
  tabla arriba y alertas debajo en móvil y con el panel lateral abierto.

## Regression Test

Verificación en navegador: secuencia de Tab y posiciones de la tabla y del panel a 1440 px y 375 px.

## Verificación (2026-10-12)

- Componente 26/26; `tsc` sin errores.
- Navegador (secretaria, 1440 px): desde "Ciclos Teóricos" el Tab siguiente cae en la fecha, después
  "Actualizar", los filtros, el selector de instructor y los botones de la tabla. Tabla a la
  izquierda (x = 297) y alertas a la derecha (x = 1041), igual que antes.
- A 375 px la tabla queda arriba (y = 448) y las alertas debajo (y = 1478), sin scroll horizontal
  de página.
