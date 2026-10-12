# Fix: las columnas de la tabla de Asistencia B se montan entre sí
> id: fix-372-m-tabla-asistencia-columnas-se-montan
> refs: fix-366-m-testing-asistencia-clase-b (A08, O04) · ASG-i-027 · 0030-b · fix-159
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`, A08: admin en 1440×900 con "Todas las sedes". La tabla tiene 672 px
para 9 columnas y los textos se pisan: "Agendada" invade "Inicio", la sede pisa al instructor y
el badge de estado pisa "Finalizada". Con el drawer abierto (O04) es peor.

## Root Cause

`table-fixed` + anchos en % (`columnWidths()`, fix-159) sin ancho mínimo. Las celdas son
`whitespace-nowrap` y su contenido mínimo no cabe en el %: "Agendada" necesita ~75 px (8 % → la
tabla debería medir ≥ 940 px) y el badge de "Estado" ~115 px (10 % → ≥ 1.150 px). Por debajo de
eso las columnas se encogen igual y el contenido se desborda sobre la vecina. El contenedor ya
tiene `overflow-x-auto`, pero nunca se activa porque la tabla mide `w-full`.

## Fix

En `asistencia-clase-b-content.component.ts`:
- Rebalanceo de `columnWidths()` para que Agendada y Estado tengan su mínimo con un ancho
  razonable (siguen sumando 100).
- `tableMinWidthPx()` = 760 con columna Sede, 670 sin ella, aplicado como `min-width` de la
  tabla: por debajo, scroll horizontal dentro de la card en vez de solapamiento.
- Los botones de Acciones bajan de línea (`flex-wrap`) y el nombre del alumno puede cortar
  palabras largas (`wrap-anywhere`): así el mínimo no obliga a scroll a la secretaria.

## Acceptance Criteria

- [x] AC1 — En 1440×900, admin "Todas", ninguna celda se desborda sobre la vecina.
- [x] AC2 — Con el drawer abierto, la tabla scrollea en horizontal en vez de montarse.
- [x] AC3 — Secretaria (sin Sede) a 1440: sin scroll horizontal innecesario si cabe.

## Regression Test

Verificación en navegador (`/verify`) midiendo `scrollWidth > clientWidth` por celda. Test de
`columnWidths()`/`tableMinWidthPx()` en el spec del componente: cada set suma 100 y cada columna
alcanza su mínimo con el ancho mínimo declarado.

## Verificación (2026-10-11)

Ninguna celda con `scrollWidth > clientWidth` en: admin "Todas" 1440×900 (tabla 760 px en card de
672 → scroll horizontal de 88 px), admin con el drawer abierto (card de 398 px, scroll) y secretaria
1440×900 (tabla 672 = card, sin scroll). Ajuste extra durante la verificación: los botones de
Acciones bajan de línea (`flex-wrap`) y el nombre del alumno puede cortar palabras largas
(`wrap-anywhere`); con eso el mínimo bajó de 860/780 a 760/670 y la secretaria no tiene scroll.
Capturas `.playwright-mcp/fix372-*.png`. Componente 25/25.
