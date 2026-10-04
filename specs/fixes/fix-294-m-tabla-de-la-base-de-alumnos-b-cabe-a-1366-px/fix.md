# Fix: La tabla de la Base de Alumnos B cabe a 1366 px
> id: fix-294-m-tabla-de-la-base-de-alumnos-b-cabe-a-1366-px
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
A 1366 px de ancho (notebook) el panel de la lista mide 990 px y la tabla dispone de 940, pero con
sus 9 columnas necesitaba 1.133. Tres cosas la ensanchaban: cada celda llevaba 32 px de relleno
horizontal (288 px en total, por un ajuste global de las tablas), los tres botones de acción medían
48 px cada uno en vez de los 32 que pide su clase, y la columna Alumno no tenía tope. Como no
cabía, el navegador partía el RUT, la fecha, el curso y el expediente en dos líneas y aun así la
columna Acciones quedaba fuera: el botón de archivar solo se alcanzaba deslizando la tabla. Es B23
de la 2ª pasada de `fix-264-m`.

**Decisión de Matías (2026-10-04):** apretar la tabla para que quepa. Sigue siendo una tabla, con
las columnas más juntas, el nombre recortado si es muy largo y los botones un poco más chicos.

## ACs Afectados
- A 1366 px la tabla se ve entera, sin scroll horizontal, con y sin la columna Sede.
- RUT, fecha de ingreso, curso, estado y expediente se leen en una sola línea.
- Un nombre o un correo que no cabe se recorta con "…" y se lee completo al pasar el mouse.
- En pantallas anchas la tabla sigue ocupando todo el ancho.

## Cambio
**Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
- Relleno horizontal de celda de 16 a 6 px (12 en los bordes de la tabla). Los títulos dejan 16 px
  a su derecha para la flecha de ordenar.
- Botones de acción de 32 × 32 px (antes 48 × 32).
- RUT, fecha, curso, estado y expediente sin salto de línea; la Sede sí puede ir en dos líneas.
- La columna Alumno toma el ancho que sobra y recorta nombre y correo (con el texto completo al
  pasar el mouse); su piso es de 8,5 rem.
- Con el panel bajo 1.150 px se oculta el círculo de iniciales, que es decorativo.

**Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test de B23 pierde la marca `knownBug` y revisa las
dos vistas (todas las sedes y una sede). El helper `filtrar()` reintenta abrir el selector (ver
"Encontrado de paso").

## Test de Regresión
- `e2e/alumnos-b-lista.spec.ts > B23 (fix-294-m)` ✓ — sin scroll horizontal, RUT en una línea y
  botón de archivar a la vista, en las dos vistas.
- `e2e/alumnos-b-lista.spec.ts > C13` (nombre muy largo) sigue verde ✓
- Medido en navegador (admin): cabe a 1366, 1600 y 1920 px con "Todas las sedes", y a 1366 y
  1600 px con una sede; todas las filas miden 63 px de alto (antes entre 71 y 89).

## Límites conocidos
- A 1366 px con "Todas las sedes" el nombre dispone de unos 140 px (unas 19 letras); el resto se
  recorta. Con una sola sede hay 85 px más.
- La holgura a ese ancho es de unos 20 px. Un curso o un estado con un nombre bastante más largo
  que "Refuerzo Clase B" o "Docs Pendientes" volvería a producir scroll horizontal.
- Las otras tres listas de alumnos (Ex-Alumnos B y las dos profesionales) no se tocaron.

## Encontrado de paso
Con la suite completa corriendo, a veces la lista de opciones de un selector de filtro se cierra
sola justo después de abrirse (el test quedaba esperando una opción). Se hizo una prueba A/B: pasa
igual con los estilos de este fix desactivados, siempre en las corridas más lentas. No se encontró
qué la cierra; el helper del test ahora reintenta. No se ha visto usando la app a mano.
