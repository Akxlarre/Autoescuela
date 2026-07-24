# Hotfix: Orden invertido en migración bloquea replay completo de Supabase local
> id: hotfix-041-m-orden-drop-view-schedule-availability
> status: done
> closed: 2026-07-24
> created: 2026-07-23

## Problema
<!-- Qué está roto o mal. Una línea clara. -->
En `supabase/migrations/20260308120000_schedule_from_courses_not_instructors.sql`, la Sección 2 (`ALTER TABLE instructors DROP COLUMN available_days/available_from/available_until`) se ejecuta antes que la Sección 3 (`DROP VIEW v_class_b_schedule_availability`), pero esa vista depende justamente de esas columnas. Al reproducir todas las migraciones desde cero (`npx supabase start` / `supabase db reset`), Postgres rechaza el `DROP COLUMN` con `SQLSTATE 2BP01` ("cannot drop column ... because other objects depend on it"), bloqueando cualquier entorno local nuevo. No afecta bases de datos ya migradas (remoto/producción), solo replays completos.

## Cambios
<!-- Listar todos los archivos afectados. Sin límite, pero cada línea debe ser obvia. -->
- **Archivo:** `supabase/migrations/20260308120000_schedule_from_courses_not_instructors.sql` — mover el bloque `DROP VIEW IF EXISTS v_class_b_schedule_availability;` (actual Sección 3, línea 51) para que se ejecute ANTES del `ALTER TABLE instructors DROP COLUMN ...` (actual Sección 2, líneas 38-41). El `CREATE OR REPLACE VIEW` sigue después, sin cambios en su definición.
