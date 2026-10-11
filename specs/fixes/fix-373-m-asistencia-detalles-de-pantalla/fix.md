# Fix: detalles de pantalla de Asistencia B (subtítulo, tasa, contadores, fecha congelada, toast)
> id: fix-373-m-asistencia-detalles-de-pantalla
> refs: fix-366-m-testing-asistencia-clase-b (S18: B08, B12, B15, KPI tasa; D08) · ASG-i-027
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`:
- **B08:** el subtítulo del hero siempre dice la fecha de hoy aunque se mire otro día.
- **KPI "Tasa Asistencia":** 0 % sin nada registrado y 20 % con 1 presente y 4 pendientes; la
  tendencia "vs mes anterior" es siempre 0.
- **B12:** con un instructor elegido, la tabla muestra 1 fila y los chips siguen en
  "Todos (6) / Pendiente (6)".
- **B15:** "hoy" se calcula una sola vez; con la pantalla abierta pasada la medianoche, "Solo
  lectura" y los botones siguen con el día anterior.
- **D08:** al finalizar sale "Evaluación y asistencia registradas", pero desde Asistencia no se
  evalúa (es del instructor, fix-115-m).

## Root Cause

- `todayLabel` y `todayIsoVal` son constantes del componente calculadas al construirlo.
- `computeKpis()` divide presentes por **todas** las clases con alumno (incluidas las pendientes) y
  fija `tasaAsistenciaTrend: 0`.
- `countByStatus()` cuenta sobre todas las clases del día, sin el filtro de instructor.
- Texto del toast heredado de cuando Finalizar evaluaba.

## Fix

- Componente: el subtítulo sale de `selectedDate()`; `isFutureDate()` compara contra
  `chileToday()` en cada evaluación; `countByStatus()` aplica el filtro de instructor.
- Facade: tasa = presentes / (presentes + ausentes) — 100 % si aún no hay ninguna registrada —;
  sin tendencia (no existe el dato del mes anterior). Toast "Clase finalizada — Asistencia
  registrada."

## Acceptance Criteria

- [x] AC1 — El subtítulo muestra la fecha elegida.
- [x] AC2 — La tasa solo considera clases ya registradas (presente/ausente) y no muestra una
      tendencia inventada.
- [x] AC3 — Con un instructor elegido, los chips cuentan solo sus clases.
- [x] AC4 — "Hoy" se recalcula: un cambio de día no deja la pantalla con el día anterior.
- [x] AC5 — El toast de finalizar no menciona evaluación.

## Regression Test

`asistencia-clase-b.facade.spec.ts` (tasa, toast) y `asistencia-clase-b-content.component.spec.ts`
(subtítulo, contadores, día). Verificación en navegador.

## Verificación (2026-10-11)

Subtítulo con el 10 elegido: "sábado, 10 de octubre de 2026". Tasa 33,3 % = 1 presente de 3
registradas (antes 20 %), sin tendencia. Con Instructor3 elegido: "Todos (1) / Ausente (1)". Toast al
finalizar: "Clase finalizada — Asistencia registrada.". `isFutureDate()` probado en el cambio de
día a las 00:30 de Chile.
