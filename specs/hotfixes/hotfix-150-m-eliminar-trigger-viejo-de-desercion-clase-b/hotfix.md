# Hotfix: eliminar el trigger viejo de deserción Clase B (2 faltas cancelaban la matrícula)
> id: hotfix-150-m-eliminar-trigger-viejo-de-desercion-clase-b
> refs: ASG-i-053 — `specs/testing-piloto/027-asistencia-clase-b.md` S1; ajusta hotfix-044-m
> status: done
> closed: 2026-10-10
> created: 2026-10-10

## Problema
[Heredado de ASG-i-053, confirmado]: `trg_class_b_dropout` (AFTER INSERT/UPDATE en
`class_b_practice_attendance`, creado en `20260301000008_08_misc_and_triggers.sql:343-385`) mira
las 2 asistencias más recientes del alumno por `recorded_at`, sin mirar matrícula ni
`archived_at`, y si ambas son ausencias cancela la **matrícula entera**. La regla vigente
(penalización) cancela las clases futuras, no la matrícula. Ninguna migración lo eliminaba.

**Evidencia (BD de dev, 2026-10-10, `npx supabase db query --linked`):**
- `trg_class_b_dropout` existe sobre `class_b_practice_attendance` con `tgenabled = 'D'`:
  **deshabilitado a mano**, sin migración que lo respalde.
- Matrículas `cancelled` con alguna ausencia Clase B registrada: **0 filas** → no canceló
  matrículas por error en dev.

El riesgo real es el desfase: el repo lo crea habilitado, así que un entorno nuevo (producción,
`db reset`) lo traería activo.

## Cambios
- **Archivo:** `supabase/migrations/20261010160000_hotfix150_drop_trigger_desercion_clase_b.sql`
  — `DROP TRIGGER IF EXISTS trg_class_b_dropout` y `DROP FUNCTION IF EXISTS
  verify_class_b_dropout_rule()`. La columna `consecutive_absences` se conserva.
- **Archivo:** `indices/DATABASE.md` — quita `verify_class_b_dropout_rule` del listado de funciones.

## Verificación
Migración aplicada por Matías el 2026-10-10. Después, la consulta de `pg_trigger` por
`trg_class_b_dropout` / `%dropout%` sobre `class_b_practice_attendance` devuelve 0 filas.
