# Fix: un par de faltas ya penalizado vuelve a cancelar todo, y el cron marca matrículas no activas
> id: fix-384-m-par-penalizado-no-vuelve-a-contar
> refs: fix-366-m-testing-asistencia-clase-b (J07, I04) · ASG-i-027 · RF-053 · spec 0048-b
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 3 de `fix-366-m` (ensayado en una transacción revertida, `b3-penal.sql`):
- **J07:** tras la penalización por las faltas 3-4 se reagendan solo las clases canceladas. El par
  3-4 sigue vivo, así que **cualquier** llamada posterior a `apply_class_b_absence_penalty()`
  (otra falta, aunque no sea seguida, o el cierre nocturno al marcar cualquier clase de esa
  matrícula) vuelve a cancelar las 7 clases recién reagendadas.
- **I04:** `mark_end_of_day_class_b_absences()` marca `no_show` + ausente en matrículas no activas.
  Pasó de verdad la noche del 11-10 con una matrícula `withdrawn` de prueba.

## Root Cause

- La RPC busca **cualquier** par de faltas seguidas vigentes registradas desde que se prendió la
  regla (`enabled_since`). No recuerda que ese par ya causó una penalización.
- El cursor del cron hace `JOIN enrollments` sin filtrar `status`.

## Fix

**Decisiones de Matías (2026-10-12):** un par que ya causó una penalización no vuelve a contar; el
cierre nocturno solo toca matrículas activas.

Migración `20261012130000_fix384_…`:
- `enrollments.absence_penalty_applied_at timestamptz` (nullable): cuándo la penalización canceló
  clases de esa matrícula por última vez.
- `apply_class_b_absence_penalty()`: un par cuenta solo si **ambas** faltas se registraron después
  de esa marca (`recorded_at > absence_penalty_applied_at`), además de `>= enabled_since` como hoy.
  Si cancela algo, actualiza la marca. Lo demás (permisos de `fix-191-b`, -1 con la regla apagada)
  queda igual.
- `mark_end_of_day_class_b_absences()`: `AND e.status = 'active'`.

## Acceptance Criteria

- [x] AC1 — Tras una penalización, reagendar las canceladas y volver a llamar la RPC (sin faltas
      nuevas) no cancela nada.
- [x] AC2 — Después de la penalización, dos faltas nuevas seguidas sí vuelven a penalizar.
- [x] AC3 — Una falta nueva seguida a una del par ya penalizado (4 vieja + 5 nueva) no penaliza.
- [x] AC4 — El cierre nocturno no marca clases de matrículas `withdrawn`/`completed`/`cancelled`.
- [x] AC5 — Sin cambios en lo demás: F01, F02, F03, `enabled_since` e I01 dan lo mismo que en el bloque 3.

## Regression Test

`supabase/tests/asistencia/fix-384-m-par-penalizado-no-vuelve-a-contar.sql` (como postgres,
después de aplicar la migración; termina siempre en `RAISE EXCEPTION`).

## Verificación (2026-10-12)

Ensayo en la BD de dev **sin aplicar** (`BEGIN; <migración>; <test>; ROLLBACK;`):
- Con la migración: `RESULTADO fix-384-m: TODO OK — F01=7; AC1=0; AC3=0; AC2=4; cron ok`.
- Sin la migración (solo la columna): `FALLA — AC1 el par penalizado volvió a cancelar 7; AC2
  esperaba 4, dio 0; AC4 el cron marcó una matrícula retirada` (reproduce J07 e I04).
- Nota del ensayo: el trigger de spec 0048-b fija `enabled_since = now()` al prender la regla; el test
  lo corre hacia atrás con un segundo UPDATE.

**Pendiente:** que Matías aplique `20261012130000_fix384_par_penalizado_no_vuelve_a_contar.sql`;
después correr el test SQL y cerrar.

**Migración aplicada por Matías (2026-10-12).** Test SQL contra la BD real: `RESULTADO fix-384-m: TODO
OK — F01=7; AC1=0; AC3=0; AC2=4; cron ok`.