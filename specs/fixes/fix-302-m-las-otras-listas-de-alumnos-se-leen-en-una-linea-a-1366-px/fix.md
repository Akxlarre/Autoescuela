# Fix: Las otras listas de alumnos se leen en una línea a 1366 px
> id: fix-302-m-las-otras-listas-de-alumnos-se-leen-en-una-linea-a-1366-px
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
`fix-294-m` compactó solo la tabla de la Base de Alumnos B. Las otras tres listas (Ex-Alumnos B,
Alumnos Profesional y Ex-Alumnos Profesional) siguen con el relleno global de 16 px por lado y sin
reglas de ancho. Medido a 1366 px (panel de 940) el 2026-10-04, con admin en "Todas las sedes":

| Lista | Scroll horizontal | Qué se parte | Alto de fila |
|---|---|---|---|
| Base Alumnos B (referencia, ya corregida) | no | nada | 63 px |
| Ex-Alumnos B | no | RUT en 2 líneas, nombre en 2, sede en 2, título "Nº EXP." en 2 | 80 px |
| Alumnos Profesional | no | nombre en 3 líneas, título "Nº MAT." en 2 | 98 px |
| Ex-Alumnos Profesional | sin datos para medir | misma plantilla que Ex-Alumnos B | — |

Ninguna pierde botones ni tiene scroll horizontal (tienen 7 u 8 columnas, no 9), pero el navegador
reparte el ancho a su manera y parte el RUT y el nombre: con filas de 80 a 98 px caben 3 o 4
alumnos por pantalla en vez de 6. A 1600 px solo queda la sede en dos líneas.

## ACs Afectados
- A 1366 px, en las tres listas, RUT, Nº, licencia, promoción, estado y saldo se leen en una línea.
- El nombre que no cabe se recorta con "…" y se lee completo al pasar el mouse.
- La Base de Alumnos B se sigue viendo igual que tras `fix-294-m`.

## Cambio
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss` — la receta compacta de `fix-294-m`
  pasa a ser una clase compartida (`.table-compact` + `.table-compact-main`,
  `.table-compact-avatar`, `.table-compact-action`), escrita una sola vez.
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
  — usa la clase compartida; se borra su copia local de la receta.
- **Archivos:** `ex-alumnos-content`, `alumnos-profesional-list-content` y
  `ex-alumnos-profesional-content` (en `src/app/shared/components/`) — usan la clase compartida;
  datos cortos sin salto de línea, nombre y correo recortados con su texto completo en `title`.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — test de Ex-Alumnos B a 1366 px.

## Test de Regresión
- `e2e/alumnos-b-lista.spec.ts > B23 (fix-294-m)` ✓ (la Base no cambia: sigue en 63 px por fila)
- `e2e/alumnos-b-ficha.spec.ts > tercera pasada > fix-302-m: a 1366 px Ex-Alumnos B muestra cada fila en una línea` ✓
- Medido en navegador tras el cambio (admin, "Todas las sedes"), a 1366 y 1600 px: Ex-Alumnos B
  63 px por fila y Alumnos Profesional 60, sin scroll horizontal, botones de 32 px a la vista y
  nada partido salvo "Año / Sede", que va en dos líneas por diseño (año arriba, sede abajo).

## Límites conocidos
- Ex-Alumnos Profesional no tiene egresados en los datos de desarrollo: recibió el mismo cambio que
  Ex-Alumnos B (misma plantilla), pero no se pudo medir con filas.
- Los títulos "Nº EXP." y "Nº MAT." siguen en dos líneas en las cuatro listas. No se forzaron a una
  porque la Base de Alumnos B tiene solo unos 20 px de holgura a 1366 px.
