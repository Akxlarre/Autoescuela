# Fix: La Base no muestra la matrícula egresada de un alumno re-matriculado
> id: fix-312-m-la-base-no-muestra-la-matricula-egresada-de-un-alumno-re-matriculado
> refs: ASG-i-024, fix-084-m
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
`fix-084-m` sacó de la Base de Alumnos B a los egresados mirando solo la matrícula que representa
la fila (la más reciente): si está egresada, el alumno no se lista. No cubrió al alumno que egresó
y se volvió a matricular: entra a la Base por su matrícula nueva, y
`AdminAlumnosFacade.mapToAlumnoTableRow()` arma las columnas "Nº Exp." y "Curso" con todas sus
matrículas Clase B válidas, incluida la egresada. La fila muestra dos números ("0083 0082") y el
curso repetido, y la matrícula egresada queda a la vez en la Base y en Ex-Alumnos. Encontrado al
ejecutar `024b` W08 en `fix-264-m`. Es B49.

**Decisión del owner (Matías, 2026-10-05):** el curso del que el alumno ya egresó no debe mostrarse
en la lista.

## ACs Afectados
- `fix-084-m` (DG-034): una matrícula egresada vive solo en Ex-Alumnos. En la Base, un alumno
  re-matriculado muestra el número y el curso de sus matrículas vigentes, no los de la egresada.
- La Papelera sigue mostrando a un egresado archivado con su número y su curso (`fix-276-m`).
- El saldo de la fila sigue sumando todas las matrículas B, también la egresada (`fix-270-m`).

## Cambio
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — "Nº Exp." y "Curso" dejan fuera las
  matrículas egresadas cuando la fila la representa una matrícula vigente.

## Test de Regresión
- `admin-alumnos.facade.spec.ts > alumno re-matriculado — fix-312-m` (3 tests) ✓ — el primero
  falla sin el arreglo (devolvía los dos números); los otros dos protegen el saldo y la Papelera.

## Verificación
2026-10-05: los 49 tests del facade pasan y `tsc` no da errores. En navegador, con el alumno de
prueba de las matrículas 0083 (vigente) y 0082 (egresada): la Base muestra solo "0083" y un solo
"Clase B" (antes "0083 0082" y el curso dos veces); buscar "0082" en la Base no lo encuentra y en
Ex-Alumnos B sí.

## Consecuencia a tener presente
La búsqueda y la exportación de la Base usan lo que muestra la fila: el número de una matrícula
egresada ya no encuentra al alumno en la Base (sí en Ex-Alumnos). La columna "Con deuda" no
cambia: sigue contando lo que deba de la matrícula egresada.
