# Hotfix: Habilitar pg_cron localmente
> id: hotfix-042-m-habilitar-pg-cron-local
> status: done
> closed: 2026-07-24
> created: 2026-07-23

## Problema
<!-- Qué está roto o mal. Una línea clara. -->
Ninguna migración crea la extensión `pg_cron` — en producción se habilita manualmente desde el Dashboard de Supabase (comentado explícitamente en varias migraciones: "pg_cron debe estar habilitado en Supabase (Dashboard > Extensions > pg_cron)"). Esto bloquea cualquier replay completo de migraciones desde cero (`npx supabase start` / `supabase db reset`) al llegar a la primera migración que usa `cron.schedule(...)` (`20260308160000_enrollment_draft_resilience.sql`), con `ERROR: schema "cron" does not exist (SQLSTATE 3F000)`.

## Cambios
<!-- Listar todos los archivos afectados. Sin límite, pero cada línea debe ser obvia. -->
- **Archivo:** `supabase/migrations/20260308160000_enrollment_draft_resilience.sql` — agregar `CREATE EXTENSION IF NOT EXISTS pg_cron;` antes del primer uso de `cron.schedule(...)`. Idempotente: en remoto no hace nada (ya está habilitado vía Dashboard), en local resuelve el bloqueo de arranque desde cero.
