# Fix: La tabla compacta reparte el ancho en pantallas anchas
> id: fix-308-m-tabla-compacta-reparte-el-ancho-en-pantallas-anchas
> refs: ASG-i-024, fix-294-m, fix-302-m
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
`fix-294-m` hizo caber la Base de Alumnos B en un notebook (1366 px) dándole a la columna del
alumno la regla "quédate con todo el ancho que sobre" (`width: 100%` + `max-width: 0` en
`.table-compact-main`), y `fix-302-m` la llevó a las otras tres listas de alumnos. A 1366 px no
sobra nada y se ve bien. En una pantalla ancha sobra mucho y todo se lo queda esa columna: las
demás miden solo lo que mide su contenido y quedan apretadas contra el borde derecho. La regla no
distingue el ancho disponible, y al medirla solo se revisó que cupiera (1366, 1600 y 1920 px), no
cómo quedaba repartido el espacio. Reportado por Matías con una captura a 1920 px.

## ACs Afectados
- `fix-294-m` "En pantallas anchas la tabla sigue ocupando todo el ancho": además, el ancho que
  sobra se reparte entre las columnas en vez de quedar todo en la del alumno.
- A 1366 px las cuatro listas se ven igual que tras `fix-294-m` y `fix-302-m` (sin cambios).
- El nombre que no cabe se sigue recortando con "…" en cualquier ancho.

## Cambio
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss` — con el panel de la lista ancho, la
  columna del alumno pasa de "todo lo que sobre" a una fracción fija del ancho de la tabla; el
  resto se reparte entre las demás columnas.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — test nuevo a 1920 px.

## Test de Regresión
- `e2e/alumnos-b-lista.spec.ts > fix-308-m` — a 1920 px la columna del alumno no pasa de un tercio
  de la tabla, sin scroll horizontal; a 1366 px sigue cabiendo (B23).

## Verificación
Medido en navegador (admin, "Todas las sedes") el 2026-10-04:

| Pantalla | Ancho de la tabla | Columna del alumno antes | Después |
|---|---|---|---|
| 1366 px | 940 | 159 px | 159 px (sin cambio) |
| 1600 px | 1174 | 393 px (33 %) | 393 px (sin cambio: el panel mide menos de 1250) |
| 1920 px | 1494 | 713 px (48 %) | 478 px (32 %) |
| 2560 px | 2134 | — | 683 px (32 %) |

A 1920 px las demás columnas pasan de su ancho mínimo a entre 15 y 65 px más cada una, y la sede
cabe en una línea. Ex-Alumnos B y Alumnos Profesional quedan igual: 32 % a 1920 px y sin cambio a
1366 px. Ex-Alumnos Profesional no tiene datos para medir; usa la misma clase. Sin scroll
horizontal y con filas de 60 a 63 px en todos los casos. Siguen verdes B23, C13 y el test de
`fix-302-m`. `npm run lint:arch`: 0 errores.
