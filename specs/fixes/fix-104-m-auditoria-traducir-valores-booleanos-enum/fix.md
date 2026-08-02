# Fix: Auditoría — traducir valores booleanos y enum crudos ("true -> false") a español
> id: fix-104-m-auditoria-traducir-valores-booleanos-enum
> refs: fix-102-m-auditoria-diccionario-columnas-completo
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

`fix-102-m` resolvió el **nombre** de columna (`current_step` → "Paso actual") y los
**IDs de FK** (`promotion_course_id: 29` → nombre/código real), pero no tocó los valores
literales que ya vienen en texto plano desde Postgres: booleanos (`true`/`false`) y enums de
`status`/similares (`draft`, `active`, `pending`, `scheduled`, etc.), que se insertan tal cual
en `audit_log.detail`. Resultado reportado: "Primer inicio de sesión: true -> false" — el
nombre de columna ya está en español, pero el valor sigue en inglés. El público del sistema
(dueño, secretarias, instructores) no necesariamente maneja inglés, así que ningún valor
crudo debería llegar a la UI.

`audit_resolve_display_value()` (de `fix-102-m`) solo resuelve columnas que son FK/enum
conocidas por **nombre de columna**; para el resto retorna `NULL` y el caller usa el valor
crudo tal cual. Falta un fallback que traduzca, independientemente de la columna: (a)
booleanos → "Sí"/"No", (b) valores de enum conocidos del esquema (status de
enrollments/vehicles/payments/etc.) → su etiqueta en español.

## ACs Afectados
- Ninguno — fix autónomo (reportado por el dueño tras revisar fix-102-m).

## Cambio
- **Archivo:** `supabase/migrations/20260802140000_audit_log_translate_boolean_enum_values.sql` (nuevo)
- **Qué cambia:** `CREATE OR REPLACE FUNCTION public.audit_resolve_display_value()` — se
  agrega, al final de la función (antes del `RETURN v_result` / cuando el `CASE` de columnas
  no resolvió nada), dos fallbacks en cascada:
  1. Si `p_value` es `'true'`/`'false'` → `'Sí'`/`'No'`.
  2. Si no, buscar `p_value` en un diccionario de ~60 valores de enum conocidos del esquema
     (`draft`→"Borrador", `active`→"Activo", `pending`→"Pendiente", `scheduled`→"Programada",
     `paid_full`→"Pagado completo", `no_show`→"Inasistencia", etc.) vía nueva función
     `audit_humanize_enum_value(text)`.
  3. Si ninguno aplica, se mantiene el comportamiento actual (`NULL` → caller usa crudo).
- No se toca `log_change()` en este fix (ya llama a `audit_resolve_display_value()`, que es
  la única función que cambia de comportamiento).

## Test de Regresión — VERIFICADO 2026-08-02 contra Supabase local
`npx supabase db push --local` aplicó la migración sin errores. Fixture + UPDATE + SELECT
dentro de una transacción con `ROLLBACK` final (no queda ningún dato de prueba en la BD):

1. `UPDATE users SET first_login = false WHERE id = 9003;` (sesión simulada del propio
   instructor vía `SET LOCAL request.jwt.claim.sub`) →
   ```
   [Pedro Instructor] Primer inicio de sesión: Sí -> No
   ```
2. `UPDATE enrollments SET status = 'active', docs_complete = true WHERE id = 9003;`
   (enrollment previo en `status='pending_docs'`) →
   ```
   [Pedro Instructor - Clase B (Test) ($0)] Documentos completos: No -> Sí; Estado: Documentos pendientes -> Activo
   ```

Sin ningún resto en inglés en ninguno de los dos casos. ✓
