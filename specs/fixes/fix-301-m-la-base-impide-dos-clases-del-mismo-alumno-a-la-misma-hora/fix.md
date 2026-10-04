# Fix: La base impide dos clases del mismo alumno a la misma hora
> id: fix-301-m-la-base-impide-dos-clases-del-mismo-alumno-a-la-misma-hora
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
`class_b_sessions` solo tiene guarda de escritura contra el choque de horario del **instructor**
(`trg_prevent_double_booking`, fix-152-m). Nada impide que un mismo **alumno** quede con dos clases
prácticas que se solapan, con instructores distintos. `fix-299-m` lo evita en la grilla de la ficha
(reprogramar y reagendar), pero la grilla solo filtra al leer: el wizard de matrícula usa otra
grilla y dos personas agendando casi a la vez pasan igual. Una vista o una grilla que filtra al
leer no es una garantía de integridad; solo un trigger de escritura lo es.

## ACs Afectados
- `024b` F07 / S20: un alumno no puede quedar con dos clases prácticas vigentes que se solapan,
  sea cual sea la pantalla desde la que se agende.

## Cambio
- **Archivo:** `supabase/migrations/20261004120000_fix301_class_b_sessions_prevent_student_double_booking.sql`
  — función `prevent_student_double_booking_class_b_sessions()` + trigger
  `trg_prevent_student_double_booking` (BEFORE INSERT OR UPDATE OF `enrollment_id, scheduled_at,
  duration_min, status`). Rechaza con `P0001` si el alumno dueño de la matrícula ya tiene otra
  clase vigente (ni `cancelled` ni `no_show`) que se solapa, en cualquiera de sus matrículas.
  Un UPDATE que no mueve la clase ni la reactiva no se valida: los datos que ya existen no quedan
  bloqueados para completarse o cancelarse.
- **Archivo:** `indices/DATABASE.md` — fila del trigger nuevo.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — test por API.

La migración la aplica Matías.

## Progreso
- [x] Migración escrita
- [x] Test por API escrito
- [x] Migración aplicada en la base de desarrollo (Matías, 2026-10-04)
- [x] Test por API verde sin la marca `knownBug`

## Test de Regresión
- `e2e/alumnos-b-ficha.spec.ts > tercera pasada > F07 (fix-301-m): la base rechaza una segunda clase del alumno a la misma hora` ✓ (falló antes de aplicar la migración: la base aceptaba la segunda clase)
