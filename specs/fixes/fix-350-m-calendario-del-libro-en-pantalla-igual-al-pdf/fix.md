# Fix: El calendario del Libro de Clases en pantalla no muestra lo mismo que el PDF
> id: fix-350-m-calendario-del-libro-en-pantalla-igual-al-pdf
> refs: ASG-i-025 · fix-319-m (P06, R04, D21) · 0017-m · 0018-m
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
El Calendario de Clases se arma en dos lugares con reglas distintas:

- **PDF** (`generate-class-book-pdf`): la malla fija del libro real (asignatura, materias, horas y
  profesor por fila), repartida en orden sobre las fechas activas del curso.
- **Pantalla** (`libro-de-clases.facade.ts`, `loadCalendario`): una fila por sesión activa con el
  texto fijo "Clase Teórica · 5" y el primer relator asignado (o "—").

La malla solo existe dentro de la función del PDF, así que la pantalla no tenía de dónde sacarla.
Decisión D21 (Matías, 2026-10-07): la pantalla muestra lo mismo que el PDF, que es el que manda.

## ACs Afectados
- `0017-m` / `0018-m` — Calendario de Clases del libro (normal y de convalidación).

## Cambio
Una sola fuente: la función del PDF arma las filas del calendario y la pantalla se las pide.

- `supabase/functions/_shared/class-book-calendar.ts` (nuevo) — función pura
  `buildCalendarRows()`: agrupa la malla por día del libro real, descarta las filas LIBRE y asigna
  a cada bloque la siguiente fecha activa. Sale de `index.ts` (`groupIntoSessionBlocks` y el
  reparto de fechas que estaba dentro del dibujo del PDF) para poder probarla.
- `supabase/functions/generate-class-book-pdf/index.ts` — el PDF dibuja esas filas (mismo
  resultado que antes) y acepta `mode: 'calendar'`: devuelve las filas en JSON, sin generar el PDF
  ni tocar `class_book`. **La despliega Matías.**
- `src/app/core/models/ui/libro-de-clases.model.ts` — `ClaseCalendario` suma `materias`; `fecha`
  puede venir vacía (bloque sin fecha) y `horas` es el texto de la malla ("5 horas").
- `src/app/core/facades/libro-de-clases.facade.ts` — `loadCalendario` pide las filas a la función.
  No bloquea la carga del resto del libro; tiene su propio estado de carga y de error, y descarta
  la respuesta de un libro que ya no es el elegido.
- `src/app/features/libro-de-clases/libro-de-clases.component.ts` — la tabla suma la columna
  Materias, muestra el aviso de bloques sin fecha igual que el PDF, y los estados de carga y error.

Mientras la función nueva no esté desplegada, la pantalla muestra "No se pudo cargar el
calendario" en esa pestaña (la versión antigua no entiende `mode` y generaría el PDF: por eso se
despliega **antes** de usar la pantalla nueva).

## Test de Regresión
- `supabase/functions/_shared/class-book-calendar.test.ts`: un bloque por día del libro real, LIBRE
  descartado, fechas canceladas saltadas, bloques sin fecha cuando faltan sesiones.
- `libro-de-clases.facade.spec.ts`: las filas que entrega la función llegan tal cual a
  `calendario()`; error de la función → `calendarioError`; respuesta de un libro anterior → se
  descarta.

## Progreso
- [x] Módulo compartido + test Deno: 5/5 (`deno test supabase/functions/_shared/class-book-calendar.test.ts`).
- [x] Función: usa el módulo y acepta `mode: 'calendar'`; `deno check` limpio.
- [x] Modelo + facade (tests primero) + pantalla. Vitest: 35/35 en el spec del facade, 8/8 en el
  de la página.
- [x] `tsc` limpio; `lint:arch` 0 errores, 182 advertencias (las mismas de antes).
- [x] Revisión en navegador **antes** del despliegue (admin, 2026-10-07): la pestaña Calendario
  muestra "No se pudo cargar el calendario de clases." y el resto del libro carga normal.
- [x] Matías desplegó `generate-class-book-pdf` (2026-10-07).
- [x] Revisión en navegador después del despliegue (admin, 2026-10-07, libro 280.2): la pantalla muestra 65 filas, 30 días
  de clase del 05-10 al 10-11-2026, 150 horas, sin el feriado 12-10, con asignatura, materias,
  horas y profesor de la malla. El PDF exportado en el mismo momento trae las mismas 65 filas: la
  secuencia completa de fecha y horas es idéntica fila por fila (se comparó por hash).
