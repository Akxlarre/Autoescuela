# Fix: La cabecera slim baja las acciones a otra línea cuando el título no cabe
> id: fix-291-m-cabecera-slim-baja-las-acciones-cuando-el-titulo-no-cabe
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
En `app-section-hero` (densidad slim) la fila tiene `flex-wrap` para que el bloque derecho (chips
y acciones) baje a una segunda línea cuando no cabe junto al título. Pero el bloque izquierdo
(volver + ícono + título) es `flex-1 min-w-0`: su tamaño base es 0, así que para el navegador
"siempre cabe" y el salto de línea nunca ocurre. En vez de bajar las acciones, el título se
aplasta. A 768 px, en la ficha del alumno, el nombre queda en 34 px de ancho ("Alum Ap…"). Es B31
de la 2ª pasada de `fix-264-m` (`024b` Z04).

## ACs Afectados
- `024b` Z04: a 768 px el nombre del alumno se lee en la cabecera de la ficha; "Editar Perfil" y
  "Eliminar Alumno" bajan a la línea siguiente.
- En pantallas anchas la cabecera no cambia: título y acciones siguen en una sola línea.

## Cambio
- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts` — el bloque
  izquierdo de la fila slim pasa a tener una base de 20 rem desde `sm` (`sm:basis-80`): si eso más
  el bloque derecho no cabe, el derecho baja de línea. Puede seguir encogiéndose (`min-w-0`) cuando
  queda solo en su línea.

## Test de Regresión
- `e2e/alumnos-b-ficha.spec.ts > Z04 (fix-291-m)` (nuevo) ✓
- Medido en navegador (admin, consola limpia en todas):
  - Ficha a 768 px: el nombre mide 440 px (antes 34) y las acciones quedan en la línea de abajo.
  - Ficha a 1366 px y Base de Alumnos a 1366 px: una sola línea, como antes.
  - Base de Alumnos a 1366 px con "Nueva Matrícula" abierto: título arriba, acciones abajo.
  - Ex-Alumnos B a 1024 px: título arriba; chips y acciones debajo en dos líneas (antes el título
    quedaba aplastado y los chips y acciones ya ocupaban dos líneas).

## Alcance
`app-section-hero` es la cabecera de casi todas las pantallas. El cambio solo se nota donde el
título tenía menos de 20 rem junto a las acciones: ahí la cabecera gana una línea de alto. No se
revisaron una por una las demás pantallas a anchos intermedios.
