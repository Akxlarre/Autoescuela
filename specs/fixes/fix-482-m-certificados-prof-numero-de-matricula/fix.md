# Fix: La lista de Certificados Profesional no muestra el Nº de matrícula y se aprieta
> id: fix-482-m-certificados-prof-numero-de-matricula
> refs: fix-480-m-testing-certificacion-profesional
> status: done
> closed: 2026-10-22
> created: 2026-10-22

## Root Cause

La fila identifica al alumno solo por nombre y RUT; el Nº de matrícula, que es como la escuela
identifica a un alumno, no aparece ni se puede buscar. Además la columna "Promoción" repite lo que
ya está elegido en el selector, y le quita ancho a las demás: a 1440 px el RUT, "Al día" y
"Convalida A3" se parten en dos líneas (peor desde que la fila tiene "Regenerar", `fix-481-m`).

## ACs Afectados

- AC propio — tabla y tarjeta muestran el Nº de matrícula como primer dato del alumno.
- AC propio — el buscador encuentra por Nº de matrícula, además de nombre y RUT.
- AC propio — sin columna Promoción (ni línea de promoción en la tarjeta).
- AC propio — a 1280 y 1440 px el RUT y los badges no se parten en dos líneas.

## Cambio

- Modelo: `numeroMatricula` en `CertificacionProfesionalAlumnoRow`; el facade lo lee de
  `enrollments.number`.
- `core/utils/professional-certificate.utils.ts`: `filterCertProfAlumnos()` (pura) reemplaza el
  filtro inline del componente y suma el Nº de matrícula.
- Contenido: columna "Nº" primero, sin "Promoción", `whitespace-nowrap` en RUT, pago, estado y el
  badge de convalidación; la tarjeta muestra el Nº sobre el nombre.
- Contenido (tabla): "Ver" y "Regenerar" como botones de ícono con `aria-label` y `title`; con tres
  botones con texto la tabla se desbordaba a 1280 px. La tarjeta los mantiene con texto.

## Test de regresión

- `professional-certificate.utils.spec.ts` — `filterCertProfAlumnos` por estado, nombre sin
  tildes, RUT sin puntos y Nº de matrícula.

## Progreso

- [x] Tests (6) rojos antes del cambio → verdes; facade + utils 41/41, `tsc` limpio, `lint:arch` 0 errores
- [x] Facade y componente
- [x] Navegador (2026-10-22, modo oscuro): 1440 y 1280 px sin desborde horizontal de la tabla y sin
  cortes de RUT ni badges; 768 y 375 px en tarjetas con "Matrícula 0097" sobre el nombre; buscar
  "0099" deja una fila.
