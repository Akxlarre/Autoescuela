# Hotfix: Trigger de deserción Clase B se auto-invoca infinitamente
> id: hotfix-044-m-trigger-dropout-recursion-infinita
> status: done
> closed: 2026-07-24
> created: 2026-07-23

## Problema
<!-- Qué está roto o mal. Una línea clara. -->
`verify_class_b_dropout_rule()` (`supabase/migrations/20260301000008_08_misc_and_triggers.sql:343-381`), disparada por `trg_class_b_dropout` (`AFTER INSERT OR UPDATE ON class_b_practice_attendance FOR EACH ROW`), hace un `UPDATE public.class_b_practice_attendance ... WHERE id = NEW.id` sobre la misma fila que la disparó — sin ninguna guarda. Ese `UPDATE` vuelve a disparar el mismo trigger `AFTER UPDATE`, que ejecuta la misma función, que vuelve a hacer `UPDATE ... WHERE id = NEW.id`, indefinidamente, hasta `ERROR: stack depth limit exceeded (SQLSTATE 54001)`. Confirmado en vivo al reproducir migraciones desde cero: se cae al insertar en `class_b_practice_attendance` durante `20260412000002_seed_test_alumnos_clase_b.sql` (stack trace con `verify_class_b_dropout_rule() line 31` repetido cientos de veces).

## Cambios
<!-- Listar todos los archivos afectados. Sin límite, pero cada línea debe ser obvia. -->
- **Archivo:** `supabase/migrations/20260301000008_08_misc_and_triggers.sql` — sin alterar el archivo histórico (ya aplicado en remoto), se agrega una migración nueva `CREATE OR REPLACE FUNCTION verify_class_b_dropout_rule()` con guarda `IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;` al inicio: la ejecución de nivel superior (depth=1) corre la lógica completa igual que antes (incluyendo el `UPDATE` que se re-dispara a sí mismo); la invocación anidada resultante (depth=2) retorna de inmediato sin reprocesar, cortando la recursión sin cambiar el comportamiento observable.
- **Archivo nuevo:** `supabase/migrations/20260723020000_fix_class_b_dropout_trigger_recursion.sql` — contiene el `CREATE OR REPLACE FUNCTION` con la guarda.
