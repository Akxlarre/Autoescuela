# Fix: Instructor no puede finalizar clase con firmas — RLS bloquea storage
> id: fix-188-m-instructor-firma-rls-storage-documents
> refs: —
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
La policy `documents_auth_insert` (y `documents_auth_update`, usada por el `upsert:true`)
sobre `storage.objects` del bucket `documents` (migración `20260413000002_fix_tenant_isolation_documents_rls.sql`,
reemplazando a `20260310130000_fix_documents_storage_rls.sql`) solo permite `WITH CHECK`
para roles `secretary` y `admin`. El flujo de "Finalizar Clase" del instructor
(`InstructorClasesFacade.uploadSignature()`, `instructor-clases.facade.ts:420`) sube las
firmas del alumno y del instructor a `documents/sessions/{sessionId}/signature_*.png` — el
rol `instructor` nunca fue agregado a esa policy, por lo que el INSERT viola RLS con
403 "new row violates row-level security policy".

## ACs Afectados
Ninguno — fix autónomo (bug reportado en QA manual del flujo de Finalizar Clase, sección
"Instructor: iniciar/finalizar clase" del UAT plan).

## Cambio
- **Archivos:**
  - `supabase/migrations/20260814165925_fix188_instructor_signature_storage_rls.sql` (v1)
  - `supabase/migrations/20260814171509_fix188_instructor_signature_storage_rls_v2.sql` (v2)
  - `supabase/migrations/20260814175746_fix188_instructor_signature_storage_rls_v3.sql` (v3)
- **Qué cambia:** agrega el rol `instructor` a `documents_auth_insert` y
  `documents_auth_update`, acotado por `WITH CHECK`/`USING` a objetos cuyo `name` empiece
  con `sessions/` y cuyo `session_id` (extraído del path) pertenezca a una `class_b_sessions`
  donde el instructor sea dueño — evita darle acceso de escritura al resto del bucket
  (carnets, contratos, certificados). v1 usaba el helper `auth_instructor_id()` y fallaba
  silenciosamente dentro del contexto RLS de `storage.objects`; v2 lo reemplazó por subquery
  directa. v3 agregó la policy `SELECT` que faltaba para instructor — sin ella, el
  `RETURNING *` del `upsert:true` (INSERT ON CONFLICT DO UPDATE) seguía reportando el mismo
  error de RLS aunque el INSERT/UPDATE ya estuvieran permitidos.

## Test de Regresión
- Verificación manual en la app: instructor finaliza una clase con firma de alumno e
  instructor → sesión pasa a `completed` sin error 403, ambas firmas quedan subidas en
  `documents/sessions/{id}/`.
