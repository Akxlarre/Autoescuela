# Plan — Spec 0052-b (feriados sin horarios)

> **Status:** approved (decisiones del owner del 2026-10-19 en el chat)

## Cambios

1. **Migración `20261019120000_spec0052_feriados.sql`**
   - `CREATE TABLE IF NOT EXISTS public.holidays (date date PRIMARY KEY, name text NOT NULL,
     scope text NOT NULL CHECK (scope IN ('national','local')), source text NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now())`.
   - RLS activa; policy `select_holidays` para `authenticated` (lectura). Sin policies de escritura
     (solo `service_role`, que la salta). `GRANT SELECT ... TO authenticated, service_role`;
     `GRANT INSERT, UPDATE ON ... TO service_role`.
   - `CREATE OR REPLACE VIEW v_class_b_schedule_availability` (copia de fix-228-b) +
     `AND NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = days.d)` en `slots`.
   - Cron `sync-holidays-monthly` (`0 7 1 * *`) que llama la Edge Function con `pg_net` y el
     patrón de `vault.decrypted_secrets` de `auto-create-next-promotions`.
2. **Edge Function `supabase/functions/sync-holidays/index.ts`** (`verify_jwt = true`; la llama el
   cron con la clave de servicio): para el año actual y el siguiente prueba las tres fuentes, hace
   `upsert` por fecha (`scope='national'`) y agrega `YYYY-08-20` (`scope='local'`). Devuelve un
   resumen. Si no hay datos de ninguna fuente para un año, no toca ese año (AC-E1).
3. **Tests**
   - `supabase/tests/agenda/0052-b-feriados.sql`: inserta un feriado en un día hábil próximo dentro
     de una transacción que aborta → la vista no tiene bloques ese día (como postgres y como
     secretaria); los demás días sí; la tabla no se puede escribir como `authenticated`.
   - Los tests de fix-224/226/227/228-b siguen en verde.
4. **Despliegue** (aprobación del owner): migración + función + una ejecución manual inicial.
5. **Índices:** `DATABASE.md` (tabla, vista, cron) con la nota de feriados regionales.
