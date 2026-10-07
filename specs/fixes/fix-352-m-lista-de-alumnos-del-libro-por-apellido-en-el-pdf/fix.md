# Fix: La lista de alumnos del libro se ordena distinto en pantalla y en el PDF
> id: fix-352-m-lista-de-alumnos-del-libro-por-apellido-en-el-pdf
> refs: ASG-i-025 · fix-319-m (P03, D23) · 0017-m
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
La pantalla del Libro ordena a los alumnos por apellido (`libro-de-clases.facade.ts:460`,
`localeCompare` en español). La función que genera el PDF los trae por id de matrícula
(`generate-class-book-pdf/index.ts:111`, `.order('id')`) y los numera en ese orden. Con 27 alumnos
de prueba, la pantalla empezaba por "Ñandú…" y el PDF por "Zúñiga Tmp01, Ñandú Tmp02…": el N° de
cada alumno no coincide entre la pantalla y el libro impreso.

Decisión **D23** (Matías, 2026-10-07): la lista va **por apellido paterno, en pantalla y en el
PDF**. En el libro real van por orden de llegada porque se anotan a mano; siendo un software, se
aprovecha para ordenarlos.

## ACs Afectados
- `0017-m` — réplica del libro: cambia el orden (y por lo tanto el N°) de los alumnos en
  Antecedentes, Firma Diaria, Recuperación de Feriados, Evaluaciones y Resumen.

## Cambio
- `supabase/functions/generate-class-book-pdf/index.ts` — los alumnos se ordenan por apellido
  paterno, materno y nombres (comparación en español, igual que la pantalla) antes de numerarlos.
  **La despliega Matías.**

La pantalla no cambia: ya ordena así.

## Test de Regresión
La función no tiene tests de integración ejecutables aquí (necesita Supabase local). Se verifica en
navegador después del despliegue: con alumnos cuyos apellidos no están en orden de matrícula, el
PDF los lista en el mismo orden y con el mismo N° que la pantalla.

## Progreso
- [x] Cambio en la función
- [x] `deno check` limpio
- [x] Matías desplegó `generate-class-book-pdf` (2026-10-07).
- [x] Revisión en navegador (admin, 2026-10-07, libro 280.2): al alumno con la matrícula más antigua se le puso de forma
  temporal el apellido "Zúñiga". Pantalla y PDF lo listan segundo, con el mismo N° (1 Prueba…
  ProfDoble, 2 Zúñiga… ProfA2); antes el PDF lo habría puesto primero. El apellido quedó de vuelta
  en "Prueba".
