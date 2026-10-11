# Fix: se puede registrar la inasistencia de una clase B antes de su hora
> id: fix-371-m-inasistencia-antes-de-la-hora
> refs: fix-366-m-testing-asistencia-clase-b (E06 / S10, I03, I06) · ASG-i-027 · RF-053
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`, E06: por API, como secretaria, un upsert `absent` en
`class_b_practice_attendance` y el paso a `no_show` de la clase de hoy a las 21:30 (hora de la
prueba ≈ 14:30) se aceptan. Con la cancelación automática activa, eso dispara la penalización
por una clase que todavía no ocurre.

## Root Cause

"Ausente solo después de la hora" existe solo en la pantalla (`isPastStartTime()` del
componente). Ni el facade ni la BD lo validan: un reloj de PC adelantado o una llamada directa
lo saltan. El mismo hueco tiene el cron nocturno: marca `no_show` toda clase cuyo **día** en
Chile sea hoy o anterior, también las de más tarde que la hora del cron (I03/I06 del checklist).

## Fix

Migración `20261011130000_fix371_inasistencia_solo_despues_de_la_hora.sql`, dos triggers
`BEFORE`:

- `class_b_sessions` (INSERT o UPDATE de `status`/`scheduled_at`): rechaza `status = 'no_show'`
  si `scheduled_at > now()`.
- `class_b_practice_attendance` (INSERT o UPDATE de `status`): rechaza `absent`/`no_show` si la
  sesión tiene `scheduled_at > now()`. `excused` (justificar) no se toca.

Error `P0001` con mensaje legible. El cron ya aísla cada clase en su propio bloque
`BEGIN … EXCEPTION`: una clase de hoy que aún no llega a su hora queda con un `WARNING` y se marca
la noche siguiente.

El facade (`markAttendance`) valida lo mismo antes de escribir, con el mensaje "La clase todavía
no empieza".

## Acceptance Criteria

- [x] AC1 — La BD rechaza `no_show` y `absent` para una clase cuya hora no llegó (cualquier rol).
- [x] AC2 — Una clase cuya hora ya pasó se sigue marcando ausente (pantalla y cron).
- [x] AC3 — Justificar (`excused`) no se ve afectado.
- [x] AC4 — El cron no marca una clase de hoy posterior a su hora de ejecución y sigue con las demás.
- [x] AC5 — `markAttendance` no escribe y avisa si la clase todavía no empieza.

## Regression Test

- `supabase/tests/asistencia/fix-371-m-inasistencia-antes-de-la-hora.sql` (aborta siempre).
- `asistencia-clase-b.facade.spec.ts` → `markAttendance` con clase futura.

## Verificación (2026-10-11)

Matías aplicó la migración. `supabase/tests/asistencia/fix-371-m-…sql` contra la BD de dev:
`RESULTADO fix-371-m: TODO OK` (no_show/absent futura rechazados, insert no_show futura rechazado,
excused futura OK, pasada OK, el cron deja `scheduled` la clase de hoy posterior a su hora). Antes de
aplicar, el mismo test daba FALLA en AC1 y AC4. Por API como secretaria sobre la clase de las 21:30:
`P0001 No se puede registrar la inasistencia: la clase todavía no empieza.` en ambos pasos. Facade:
test de `markAttendance` con clase futura (sin upsert, toast "La clase todavía no empieza").

## Despliegue

Migración: la aplica Matías.
