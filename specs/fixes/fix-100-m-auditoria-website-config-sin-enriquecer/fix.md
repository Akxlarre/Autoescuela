# Fix: website_config quedó fuera del enriquecimiento de auditoría de fix-097-m

> id: fix-100-m-auditoria-website-config-sin-enriquecer
> refs: fix-097-m-auditoria-detalle-enriquecido
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause

`fix-097-m` agregó una rama `ELSIF` en `log_change()` para cada tabla que caía al fallback
genérico `"id=X"`, pero la lista se armó a partir de los triggers `trg_audit_*` en
`20260301000008_08_misc_and_triggers.sql` y `20260323110000_add_audit_triggers_missing_tables.sql`,
sin incluir `trg_audit_website_config` (creado en `20260522000000_create_website_config.sql` /
`20260522000004_website_config_audit_trigger.sql`). Resultado: cualquier cambio en
`website_config` sigue generando `"Creado: id=X"` en el log de auditoría.

## ACs

- AC-1: Un INSERT/UPDATE/DELETE en `website_config` resuelve un `entity_label` legible
  (`"Configuración web - <nombre de sede>"`) en vez de `id=X`.
- AC-2: El resto de ramas de `log_change()` no cambian de comportamiento.

## Cambio

- **Archivo:** `supabase/migrations/20260801120000_audit_log_enrich_missing_entities.sql`
  **Qué cambia:** se agrega la rama `ELSIF TG_TABLE_NAME = 'website_config'` (antes del `ELSE`
  genérico), resolviendo el nombre de la sede via `branches.name`.
- **Archivo:** `supabase/migrations/20260801140000_audit_log_restore_header_user_id.sql`
  **Qué cambia:** misma rama `ELSIF TG_TABLE_NAME = 'website_config'`. Esta migración corre
  después de `20260801120000` y hace un `CREATE OR REPLACE FUNCTION log_change()` completo
  (para resolver `user_id` vía header `x-audit-user-id`), copiando el cuerpo de la función
  ANTES de que se le agregara la rama `website_config` — por eso pisa el fix si no se
  replica acá también. Es la versión final que queda vigente en la BD.

## Test de Regresión

`npx supabase db reset --local` + INSERT manual en `website_config` vía `docker exec
supabase_db_Autoescuela psql` → el log resultante en `audit_log` muestra
`"Registrado: Configuración web - <sede>"` en vez de `"Registrado: id=X"`. ✓ (2026-08-01)
