# Fix: A 1280 px la tabla de Promociones no cabe y el botón Editar queda fuera de la vista
> id: fix-345-m-tabla-de-promociones-cabe-en-notebook
> refs: ASG-i-025 · fix-319-m (J10)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause
La página cambia de tabla a tarjetas cuando su contenedor mide 850 px o menos
(`admin-profesional-promociones.component.ts:362`), pero la tabla necesita más que eso: a 1280×800
el contenedor mide 888 px y la tabla 959. Ninguna columna puede encogerse:

- la celda del nombre no trunca (el `truncate` del `<span>` no actúa porque una celda de tabla
  crece hasta su contenido);
- la columna Cursos, al quedar estrecha, apila sus 4 badges en vertical (`flex-wrap`) y cada fila
  pasa de 61 a 119 px;
- el resto queda fuera: scroll horizontal dentro de la card, "Acciones" cortada y **Editar
  invisible** sin desplazar.

## ACs Afectados
Ninguno — layout de la lista de Promociones (admin y secretaria comparten el componente).

## Cambio
`src/app/features/admin/profesional-promociones/admin-profesional-promociones.component.ts` pasa a
usar la **tabla compacta compartida** (`.table-compact`, de `fix-294-m` / `fix-302-m`, la misma de
las listas de alumnos), en vez de inventar estilos propios:
- `table-compact` en el contenedor de la tabla: relleno horizontal de 6 px por celda;
- `table-compact-main` en la columna del nombre: es la que cede (ocupa el ancho sobrante y trunca
  con "…"; el nombre completo queda en el `title`);
- `table-compact-action` en los botones Ver y Editar (32 px en vez de los 48 del tema);
- los badges de curso no se apilan (una sola línea).

Un primer intento con clases propias en el componente no funcionó: el relleno de las celdas lo
fija `_primeng-overrides.scss` con `!important` y más especificidad.

## Test de Regresión
Cambio solo de plantilla y estilos (sin lógica nueva): se verifica en navegador a 1280, 1366 y
1440 px que el contenedor de la tabla no tenga scroll horizontal y que el botón Editar quede dentro.

## Progreso
- [x] Plantilla (sin estilos nuevos).
- [x] Revisión en navegador (admin, 2026-10-06), contenedor de la tabla sin scroll horizontal,
  filas de 61 px y botón Editar dentro de la vista en los cuatro anchos:

  | Viewport | Contenedor | Tabla | Nombre visible |
  |---|---|---|---|
  | 1280×800 | 888 | 888 (antes 959) | completo (242 de 240 px) |
  | 1366×768 | 974 | 974 | completo |
  | 1440×900 | 1062 | 1062 | completo |
  | 1920×1080 | 1542 | 1542 | completo |

  Solo el nombre más largo ("Promoción 9002 (30 de Noviembre 2026)") se trunca a 1280. El
  documento no scrollea. La secretaria usa el mismo componente.
