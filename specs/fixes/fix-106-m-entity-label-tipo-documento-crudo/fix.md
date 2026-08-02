# Fix: entity_label de log_change() embebe el tipo de documento/mantención crudo (sin traducir)
> id: fix-106-m-entity-label-tipo-documento-crudo
> refs: fix-104-m-auditoria-traducir-valores-booleanos-enum, fix-105-m-actividad-reciente-eliminados-genericos
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

`fix-104-m` agregó `audit_humanize_enum_value()`, pero solo se invoca desde
`audit_resolve_display_value()`, que **solo corre dentro del diff de UPDATE**. La
construcción de `v_entity_label` en `log_change()` (usada para INSERT y DELETE, y como
prefijo `[...]` en UPDATE) es código completamente aparte, con ramas `ELSIF TG_TABLE_NAME =
'<tabla>'` que concatenan columnas crudas directamente vía `v_src->>'columna'` — nunca pasan
por ningún diccionario.

Tres ramas embeben un valor de enum crudo sin traducir:

```sql
-- student_documents
v_entity_label := COALESCE(v_src->>'type', 'Documento') || ' de ' || COALESCE(v_temp_text, '?');
-- vehicle_documents
v_entity_label := COALESCE(v_src->>'type', 'Documento') || ' - ' || COALESCE(v_temp_text, '?');
-- maintenance_records
v_entity_label := COALESCE(v_src->>'type', 'Mantención') || ' - ' || COALESCE(v_temp_text, '?');
```

Confirmado con capturas reales del dueño: `"Sistema / Online eliminó: cedula_identidad de
Ignacio Sorko"` — el valor real de `student_documents.type` en producción (verificado en
`src/app/core/models/ui/enrollment-documents.model.ts` y
`src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts`) es uno
de: `id_photo`, `cedula_identidad`, `licencia_conducir`, `hoja_vida_conductor`,
`autorizacion_notarial`, `contrato`, `certificado_medico`, `certificado_antecedentes` — **no
coinciden con los valores documentados en el comentario de la migración original**
(`'national_id'`, `'driver_license'`, etc., que están obsoletos/nunca se usaron en el código
real). `audit_humanize_enum_value()` (fix-104-m) tenía los valores viejos/en inglés, no los
reales en español-snake_case que usa la app.

## ACs Afectados
- Ninguno — fix autónomo (reportado por el dueño tras revisar capturas de "Actividad
  reciente" post fix-105-m).

## Cambio
- **Archivo:** `supabase/migrations/20260802150000_audit_log_humanize_entity_label_types.sql` (nuevo)
- **Qué cambia:**
  1. `CREATE OR REPLACE FUNCTION public.audit_humanize_enum_value()` — agrega los valores
     reales usados por la app (`cedula_identidad`, `licencia_conducir`,
     `hoja_vida_conductor`, `autorizacion_notarial`, `contrato`, `certificado_medico`,
     `certificado_antecedentes`), conservando las entradas previas de fix-104-m.
  2. `CREATE OR REPLACE FUNCTION public.log_change()` — las tres ramas de `entity_label`
     que embeben `v_src->>'type'` (student_documents, vehicle_documents,
     maintenance_records) ahora usan
     `COALESCE(public.audit_humanize_enum_value(v_src->>'type'), v_src->>'type', '<fallback>')`
     en vez del valor crudo.

## Test de Regresión — VERIFICADO 2026-08-02 contra Supabase local
`npx supabase db push --local` aplicó la migración sin errores. Fixture + DELETE + SELECT
dentro de una transacción con `ROLLBACK` final (no queda ningún dato de prueba en la BD):

```sql
DELETE FROM student_documents WHERE id = 9004; -- type = 'cedula_identidad'
SELECT detail FROM audit_log WHERE entity='student_documents' AND entity_id=9004 ORDER BY id DESC LIMIT 1;
```

Resultado: `Eliminado: Cédula de Identidad de Ignacio Sorko` — exactamente el caso reportado
en la captura, ahora traducido. `npm run lint:arch` sin advertencias nuevas. ✓
