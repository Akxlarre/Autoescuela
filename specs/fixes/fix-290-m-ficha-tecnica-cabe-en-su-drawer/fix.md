# Fix: La Ficha Técnica cabe en su drawer
> id: fix-290-m-ficha-tecnica-cabe-en-su-drawer
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
`app-admin-ficha-tecnica` elige entre su tabla y su vista de tarjetas con `md:` de Tailwind, que
mira el ancho de la **ventana**. Desde que la Ficha Técnica se abre en un drawer (615–720 px de
ancho según la pantalla), la ventana es ancha pero el espacio real no: la tabla mide 904 px y las
columnas "Validación" y "Acción" (el lápiz de reprogramar) solo se alcanzan con scroll horizontal.
Es la trampa ya documentada en `visual-system.md` ("switch de layout por contenedor, no por
breakpoint de Tailwind"). Es B29 de la 2ª pasada de `fix-264-m` (`024b` E08).

## ACs Afectados
- `024b` E08: en el drawer de la Ficha Técnica se ve todo sin scroll horizontal, incluido el lápiz
  de reprogramar, a 1600 y a 1366 px.
- No se pierde ningún dato: la tarjeta suma el kilometraje, que solo estaba en la tabla.

## Cambio
- **Archivo:** `src/app/features/admin/alumno-detalle/components/ficha-tecnica/admin-ficha-tecnica.component.ts`
  — la tabla se muestra solo si el contenedor mide 920 px o más (container query); con menos, las
  tarjetas. La tarjeta muestra el kilometraje cuando existe. Se quita la regla `force-compact`,
  que ya no hace falta.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — el test de reprogramar elige el lápiz visible.

## Test de Regresión
- `e2e/alumnos-b-ficha.spec.ts > E08 (fix-290-m)` (nuevo, a 1600 y a 1366 px) ✓ — 3 corridas
  seguidas de cada uno
- `e2e/alumnos-b-ficha.spec.ts > F04 · F11 · F13 (fix-279-m)` sigue verde ✓
- Captura a 1366 px con el alumno 2815: 12 tarjetas, lápiz y firmas a la vista, sin scroll
  horizontal.

## Queda distinto de antes
En el drawer ya no se ve la tabla (necesita 920 px y el drawer mide a lo más 720): se ven las
tarjetas. La tabla sigue en el componente para un contenedor ancho. Las tarjetas no pintan la fila
de verde/rojo/ámbar según el estado, como hacía la tabla; el estado se lee en el badge
("Inasistencia", "Cancelada — pendiente reagendar").
