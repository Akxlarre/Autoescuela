# Fix: Fallback 3 de `v_user_id` en `log_change()` lee un GUC que PostgREST nunca setea — "Sistema / Online" persiste en peticiones reales
> id: fix-108-m-log-change-jwt-guc-inexistente
> refs: fix-103-m-auditoria-atribucion-autor-first-login
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

`fix-103-m` (`20260802130000_audit_log_fix_jwt_sub_cast.sql`) corrigió el cast roto de
UUID→INT en el Fallback 3 de `log_change()`, pero **verificó el fix con un fixture SQL que
simulaba el contexto a mano**:

```sql
SET LOCAL request.jwt.claim.sub = '<uuid>';  -- ← esto SÍ funciona en el fixture
```

Ese fixture nunca probó si **PostgREST realmente setea ese GUC** en una petición HTTP real.
Verificado empíricamente contra Supabase local corriendo (`docker exec ... psql`, JWT firmado
a mano con el `JWT_SECRET` del proyecto, petición real a `POST /rest/v1/rpc/...` y
`PATCH /rest/v1/users`):

```
claims_agg (request.jwt.claims)     = {"aud":"authenticated","sub":"<uuid>",...}  ← SÍ existe
claim_sub  (request.jwt.claim.sub)  = NULL                                        ← NUNCA existe
auth.uid()                                                                        = <uuid> correcto
```

Esta versión de PostgREST (la que usa Supabase, `db-pre-request`/JWT moderno) **solo** expone
el JSON agregado `request.jwt.claims`; el GUC plano `request.jwt.claim.<claim>` (usado por
versiones antiguas de PostgREST con `role-claim-key` legacy) no existe en absoluto en este
stack. `current_setting('request.jwt.claim.sub', true)` devuelve `NULL` (con el flag `missing_ok`
en true, no lanza excepción) → `NULLIF(NULL, '')` → `NULL` → el Fallback 3 nunca resuelve un
usuario real en ninguna petición real, aunque el cast ya esté arreglado. `auth.uid()` (usado
correctamente en `auth_user_id()` para RLS, `20260301000011_10_rls_policies.sql:23-26`) **sí**
funciona en el mismo contexto — confirmado con la misma prueba.

Esto explica que el dueño siga viendo "Sistema / Online" tanto en el DELETE (fix-105-m) como
en el INSERT de `student_documents` — tabla sin columna `registered_by`, por lo que depende
enteramente del Fallback 3 roto.

## ACs Afectados
Ninguno — fix autónomo (reportado por el dueño: "Sistema / Online" persiste tras fix-103-m).

## Cambio
- **Archivo:** `supabase/migrations/20260802160000_audit_log_fix_jwt_guc_real.sql` (nuevo)
- **Qué cambia:** `CREATE OR REPLACE FUNCTION public.log_change()` — Fallback 3 reemplaza
  `current_setting('request.jwt.claim.sub', true)` por `auth.uid()` directo (mismo mecanismo
  que `auth_user_id()`, ya probado en RLS):
  ```sql
  -- Antes (GUC que PostgREST nunca setea en este stack):
  SELECT id INTO v_user_id FROM public.users
  WHERE supabase_uid = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;

  -- Después:
  SELECT id INTO v_user_id FROM public.users WHERE supabase_uid = auth.uid();
  ```
  Se actualiza también `indices/DOMAIN-GOTCHAS.md` (DG-045) para reflejar la causa raíz real
  y advertir contra fixtures que simulan el GUC en vez de probar una petición PostgREST real.

## Test de Regresión
Verificado empíricamente contra Supabase local (no solo fixture SQL) — PATCH real vía
`POST http://127.0.0.1:54321/rest/v1/users?id=eq.1` con JWT firmado (`sub` = `supabase_uid`
de un usuario real, sin header `x-audit-user-id`), confirmando `audit_log.user_id` resuelto
correctamente tras aplicar `auth.uid()` en vez del GUC plano.
