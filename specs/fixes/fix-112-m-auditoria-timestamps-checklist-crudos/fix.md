# Fix: Auditoría dashboard — timestamps crudos y checklist de evaluación sin traducir en el log de actividad
> id: fix-112-m
> refs: fix-102-m, fix-104-m, fix-106-m, fix-108-m
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
La cadena de fixes previa (fix-102/104/106/108-m) tradujo nombres de columna, IDs de FK,
booleanos y enums en el trigger `log_change()`, pero nunca cubrió dos formas de valor
crudo que siguen llegando al feed de actividad del dashboard:

1. **Fechas/horas ISO**: `audit_resolve_display_value()` solo intenta resolver FK/enum/
   booleano por NOMBRE de columna conocido — nunca intenta formatear el VALOR cuando
   "tiene forma" de timestamp/hora/fecha. Lo mismo en el `entity_label` de
   `class_b_sessions` (INSERT), construido directo desde `v_src->>'scheduled_at'` sin
   pasar por ninguna función.
2. **`evaluation_checklist`** (jsonb, columna de `class_b_sessions`): no está en el
   diccionario `audit_humanize_column`, cae al fallback genérico ("Evaluation
   Checklist"), y el VALOR se inserta como el JSON crudo completo del array de ítems.

Además, el status `'reserved'` de `class_b_sessions` nunca se agregó al diccionario de
enums (`audit_humanize_enum_value`), por lo que aparecía crudo en el diff ("Estado:
reserved -> En curso").

## ACs Afectados
Ninguno — fix autónomo (corrección de auditoría reportada por el dueño sobre el trabajo
de fix-102/104/106/108-m, no hay spec formal con ACs para el log de actividad).

## Cambio
- **Archivo:** `supabase/migrations/20260805090000_audit_log_format_timestamps_and_checklist.sql`
- **Qué cambia:**
  - Nueva función `audit_format_timestamp_value(text)`: detecta por regex timestamp/hora/
    fecha ISO y lo formatea en es-CL (`DD-MM-YYYY HH24:MI`), convirtiendo a
    `America/Santiago` cuando el valor trae timezone.
  - Nueva función `audit_format_evaluation_checklist(text)`: parsea el array jsonb y
    devuelve `"N de M ítems marcados"` en vez del JSON crudo.
  - `audit_humanize_column`: agrega `evaluation_checklist -> 'Checklist de evaluación'`.
  - `audit_humanize_enum_value`: agrega `reserved -> 'Reservada'`.
  - `audit_resolve_display_value`: usa `audit_format_evaluation_checklist` para la
    columna `evaluation_checklist`, y `audit_format_timestamp_value` como fallback antes
    del booleano/enum.
  - `log_change()`: el `entity_label` de `class_b_sessions` ahora formatea `scheduled_at`
    con `audit_format_timestamp_value()` en vez de mostrar el ISO crudo.

## Test de Regresión
No hay test unitario TS (la lógica vive en funciones SQL de un trigger de Postgres, sin
harness de test en este repo). Verificado:
- `npx supabase db push --local` → migración aplica sin errores de sintaxis/tipo (donde
  este trigger suele fallar en silencio, ver DG-042/043).
- Ejecución directa de las funciones nuevas contra Postgres local
  (`docker exec supabase_db_Autoescuela psql`):
  - `audit_format_timestamp_value('2026-08-04T10:07:02.438+00:00')` → `04-08-2026 06:07`
    (convertido a America/Santiago)
  - `audit_format_timestamp_value('16:30:15')` → `16:30`
  - `audit_format_timestamp_value('2026-08-04')` → `04-08-2026`
  - `audit_format_timestamp_value('not-a-date')` → `NULL` (fallback al crudo, sin romper)
  - `audit_format_evaluation_checklist('[]')` → `Sin completar`
  - `audit_format_evaluation_checklist('[{checked:true},{checked:false}]')` → `1 de 2 ítems marcados`
  - `audit_humanize_column('evaluation_checklist')` → `Checklist de evaluación`
  - `audit_humanize_enum_value('reserved')` → `Reservada`
- No había datos de fixture en la BD local para un UPDATE end-to-end sobre
  `class_b_sessions`; pendiente de confirmación visual del dueño en el dashboard real
  (los 4 casos reportados en las capturas quedan cubiertos por las funciones de arriba).
- `indices/DATABASE.md` actualizado con las 2 funciones nuevas.
