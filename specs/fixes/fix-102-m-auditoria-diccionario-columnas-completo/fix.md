# Fix: Auditoría — diccionario completo de columnas y resolución de valores FK/enum
> id: fix-102-m-auditoria-diccionario-columnas-completo
> refs: fix-097-m-auditoria-detalle-enriquecido, fix-099-m-audit-log-header-user-id-perdido, fix-100-m-auditoria-website-config-sin-enriquecer
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

`log_change()` (vigente en `supabase/migrations/20260801140000_audit_log_restore_header_user_id.sql`,
líneas 284-298) solo traduce **8 nombres de columna** a español en el diff de UPDATE
(`status`, `payment_status`, `pending_balance`, `total_paid`, `active`, `session_status`,
`amount`, `psych_test_status`). Cualquier otra columna cae al `ELSE v_key` — nombre crudo en
snake_case (`current_step`, `promotion_course_id`, `first_login`, etc.).

Además, **incluso traducido el nombre de columna no basta**: columnas FK (`promotion_course_id`,
`course_id`, `instructor_id`, etc.) muestran el ID crudo de Supabase en el valor
(`null -> 29`), que no significa nada para un humano sin abrir la BD. Se requiere resolver
el ID a su representación legible (nombre, código) igual que ya hace `v_entity_label` para
la fila completa.

Ambos consumidores de `audit_log.detail` (`DashboardFacade.mapAuditLogToActivity` para
"Actividad reciente" y `AuditoriaFacade.mapToRow` para la vista "Auditoría") heredan el mismo
`detail` crudo generado en BD — el fix debe hacerse en el trigger SQL, no en el frontend, para
que ambas vistas se beneficien a la vez.

## ACs Afectados
- Ninguno — fix autónomo (reportado por el dueño viendo "Actividad reciente" en producción/demo).

## Cambio
- **Archivo:** `supabase/migrations/20260802120000_audit_log_humanize_columns_and_values.sql` (nuevo)
- **Qué cambia:**
  1. Nueva función `public.audit_humanize_column(text)` — diccionario amplio de ~90 columnas
     conocidas (todas las tablas auditadas por `log_change()`) + fallback genérico
     (`initcap(replace(col, '_', ' '))`) para cualquier columna futura no listada — nunca
     vuelve a mostrarse snake_case crudo.
  2. Nueva función `public.audit_resolve_display_value(column text, value text)` — resuelve
     IDs de FK conocidos (promotion_course_id, course_id, branch_id, instructor_id,
     lecturer_id, vehicle_id, student_id, enrollment_id, certificate_id, receipt_id,
     discount_id, service_id, sence_code_id, template_id, batch_id, role_id, columnas
     `*_by`) a su nombre/código legible vía subquery; resuelve `current_step` (enum 1-6) a
     su etiqueta de paso del wizard. Devuelve `NULL` si no hay regla — el caller usa el
     valor crudo como antes.
  3. `CREATE OR REPLACE FUNCTION public.log_change()` — mismo cuerpo vigente de
     `20260801140000`, con el bloque de diff de UPDATE modificado para usar las dos
     funciones nuevas en vez del `CASE` de 8 entradas.
- Ambas funciones nuevas son independientes de `log_change()` (no se redefinen en cada
  migración de auditoría) — futuras migraciones que agreguen columnas/tablas solo necesitan
  `CREATE OR REPLACE FUNCTION public.audit_humanize_column` (más fácil que tocar `log_change()`
  completo, evita repetir el problema de DG-043).

## Test de Regresión — VERIFICADO 2026-08-02 contra Supabase local
`npx supabase db push --local` aplicó ambas funciones + `log_change()` sin errores.
Confirmado con `pg_get_functiondef('public.log_change'::regproc)` que la versión vigente en
BD es la que usa `audit_humanize_column()`/`audit_resolve_display_value()`.

UPDATE de prueba (fixture + UPDATE + SELECT dentro de una transacción con `ROLLBACK` final —
no queda ningún dato de prueba en la BD):

```sql
UPDATE enrollments SET promotion_course_id = 9001, current_step = 3 WHERE id = 9001;
SELECT detail FROM audit_log WHERE entity='enrollments' AND entity_id=9001 ORDER BY id DESC LIMIT 1;
```

Resultado:
```
[Juan Perez - Clase Profesional A2 (Test) ($0)] Paso actual: Datos personales -> Documentos; Curso de promoción: Sin asignar -> PC-A2-TEST (Clase Profesional A2 (Test))
```

En vez de `promotion_course_id: null -> 9001; current_step: 2 -> 3`. ✓
