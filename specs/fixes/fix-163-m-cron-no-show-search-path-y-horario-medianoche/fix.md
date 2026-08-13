# Fix: Cron de no-show Clase B — search_path roto por trigger de fix-152
> id: fix-163-m-cron-no-show-search-path-y-horario-medianoche
> refs: fix-152-m (causa del bug), fix-145-m (mismo patrón de search_path ya resuelto una vez)
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause

`mark_end_of_day_class_b_absences()` corre como `SECURITY DEFINER` con `SET search_path = ''`
(correcto, evita hijacking de schema). El `UPDATE public.class_b_sessions SET status = 'no_show'`
que hace dispara el trigger `trg_prevent_double_booking` (agregado en fix-152, migración
`20260811110000`), cuya función `prevent_double_booking_class_b_sessions()` **no declara su
propio `search_path`** y referencia la tabla sin calificar (`FROM class_b_sessions cb`).

Un trigger sin `SET search_path` propio hereda el `search_path` de la sesión que lo disparó —
en este caso, el `search_path=''` del `UPDATE` que lo invocó indirectamente. Con `search_path`
vacío, `class_b_sessions` sin prefijo no resuelve a nada → `relation "class_b_sessions" does not
exist`, capturado y logueado por el `EXCEPTION WHEN OTHERS` de `mark_end_of_day_class_b_absences()`
(que aísla el fallo por fila, así que el cron "corre" pero nunca marca nada como `no_show`).

Mismo patrón de bug que fix-145-m corrigió dos días antes en otra función; no se replicó al
escribir el trigger de fix-152.

> **Nota de scope:** en un momento de esta sesión se evaluó también mover el horario del cron
> de 21:00 CLT a medianoche CLT, a pedido del dueño. Se revirtió: el dueño confirmó que el
> horario 21:00 (fin de jornada) es intencional — no hay evidencia en el repo de que la
> intención original fuera medianoche. El cron sigue en `0 1 * * *`, sin cambios.

## ACs Afectados

Ninguno — fix autónomo (bug operacional detectado por logs de Postgres, no por un AC de spec).

- El cron `mark-end-of-day-class-b-absences` vuelve a marcar `no_show` correctamente en
  `class_b_sessions` sin abortar por `relation does not exist`.

## Cambio

- **Archivo:** `supabase/migrations/20260812150000_fix163_prevent_double_booking_trigger_search_path.sql`
- **Qué cambia:** `CREATE OR REPLACE FUNCTION prevent_double_booking_class_b_sessions()` — agrega
  `SET search_path = ''` y califica `public.class_b_sessions` en el `FROM` (mismo patrón que
  `mark_end_of_day_class_b_absences()` / `apply_class_b_absence_penalty()`). El horario del cron
  (`0 1 * * *`) no se toca.

## Test de Regresión

No hay test automatizado para funciones `pg_cron`/triggers SQL en este proyecto (no hay runner
de tests SQL). Verificación manual post-deploy:
- `SELECT public.mark_end_of_day_class_b_absences();` ejecutado a mano contra una sesión
  `class_b_sessions.status='scheduled'` con `scheduled_at` de ayer → debe quedar `status='no_show'`
  sin `WARNING` en los logs.
- Confirmar que `trg_prevent_double_booking` sigue funcionando normalmente ante un INSERT/UPDATE
  manual de sesión con solape de horario (debe seguir lanzando la excepción `P0001`).
