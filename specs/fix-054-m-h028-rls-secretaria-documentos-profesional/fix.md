# Fix: H-028 — RLS bloquea a la secretaria en matrícula Profesional (403)
> id: fix-054-m-h028-rls-secretaria-documentos-profesional
> refs: ASG-011
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause

[Heredado de ASG-011, confirmado y corregido tras revisar las policies reales]: La secretaria de una sede CON Academia Profesional no puede completar NINGUNA matrícula profesional: al llegar al paso de subir la foto de carnet, la consola muestra `403 Forbidden` en `POST/PATCH /rest/v1/student_documents?on_conflict=enrollment_id,type` y la UI queda congelada en "Subiendo foto..." para siempre, sin avisar el error.

La hipótesis original (INSERT excluye `secretary`) era incorrecta: `insert_student_documents` (`supabase/migrations/20260301000011_10_rls_policies.sql:850-855`) sí incluye `'secretary'`. La causa real está en `update_student_documents` (mismo archivo, líneas 856-861), que solo permite `admin` o `student` (dueño):

```sql
CREATE POLICY update_student_documents ON student_documents
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'student' AND enrollment_id IN (...))
  );
```

El endpoint hace un **upsert** (`on_conflict=enrollment_id,type`). Si ya existe una fila `student_documents` para ese `(enrollment_id, type)` — típico en un reintento o si ese tipo de documento ya se había subido antes — Postgres resuelve el conflicto como UPDATE, no INSERT, y la policy de UPDATE bloquea a `secretary` → 403. Explica por qué es intermitente y por qué admin (que sí tiene permiso de UPDATE) no lo reproduce.

## ACs Afectados

- Ninguno — fix autónomo (originado de Asignación ASG-011, no de una spec previa).

## Cambio

- **Archivo:** Migración SQL nueva en `supabase/migrations/` — `DROP POLICY update_student_documents` + `CREATE POLICY` agregando rama `secretary` (mismo patrón de scope por sede que `select_student_documents` en `20260413000002_fix_tenant_isolation_documents_rls.sql`, vía `branch_visible(branch_id)` del enrollment asociado).
- **Qué cambia:** `update_student_documents` pasa a permitir `secretary` cuando el `enrollment_id` pertenece a una matrícula de su(s) sede(s) visible(s), igual que ya hace `insert_student_documents`.
- Adicional recomendado (no bloqueante): manejo de error visible en la UI para que un 403 futuro no deje al usuario congelado sin feedback.
- Fuera de scope: no tocar las policies de Clase B, que ya funcionan bien.

## Test de Regresión

- Verificar en vivo con `secretaria2@test.com` (Conductores Chillán, sede CON Profesional): completar matrícula profesional hasta subir foto de carnet sin 403. ✓ Verificado 2026-07-23: matrícula Profesional A2 completada de punta a punta, foto de carnet y HDV subidos correctamente a Storage.
