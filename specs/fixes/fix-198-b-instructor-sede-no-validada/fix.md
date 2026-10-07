# Fix: Una secretaria puede crear instructores en otra sede y reenviar invitaciones de cualquier sede
> id: fix-198-b-instructor-sede-no-validada
> refs: ASG-i-034 (sospecha S4, confirmada en fix-197-b) · fix-179-b
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] Las Edge Functions usan la clave de servicio y solo
validan **quién llama** (admin o secretaria), no la **sede** del objetivo:
1. **`create-instructor`** usa el `branchId` del body tal cual: una secretaria de la sede 1 crea
   instructores en la sede 2 llamando la función directo (el front no se lo ofrece, la función sí).
2. **`activate-instructor-account`** deja a cualquier secretaria reenviar la invitación de un
   instructor de cualquier sede (el correo va al email registrado del instructor: no hay toma de
   cuenta, pero sí una acción fuera de su sede).

`fix-179-b` cerró el mismo patrón en `update-instructor` con `_shared/user-edit-authz.ts`; estas
dos funciones quedaron fuera.

## ACs Afectados
Ninguno de una spec previa. ACs propios (mismo criterio que `authorizeInstructorEdit`):

- **F1 — Crear:** una secretaria sin grant solo crea instructores en su propia sede (otro
  `branchId` → 403). Admin y secretaria multi-sede, en cualquier sede.
- **F2 — Reenviar invitación:** una secretaria sin grant solo reenvía la de instructores de su sede
  o "ambas sedes" (otra sede → 403). Admin y multi-sede, cualquiera.
- **F3:** sin cambios para el admin ni para los flujos de la UI de la secretaria.

## Cambio
- `supabase/functions/_shared/user-edit-authz.ts` (+ test) — `authorizeInstructorCreate`,
  `authorizeInstructorReinvite` (funciones puras).
- `supabase/functions/create-instructor/index.ts`, `activate-instructor-account/index.ts` — las usan.

## Test de Regresión
- `deno test supabase/functions/_shared/user-edit-authz.test.ts`
- Tras el deploy: como secretaria de la sede 1, `create-instructor` con `branchId: 2` → 403 (el
  rechazo ocurre antes de crear nada) y `activate-instructor-account` de un instructor de la sede 2
  → 403.

## Progreso
- [x] `deno test supabase/functions/_shared/user-edit-authz.test.ts` → 28/28 (11 nuevos; rojos antes del cambio).
- [x] Embed `instructors(both_branches)` desde `users` verificado contra PostgREST (devuelve objeto; el código acepta objeto o arreglo).
- [x] Desplegadas `create-instructor` v19 y `activate-instructor-account` v3 (aprobado por el owner, 2026-10-07; `verify_jwt:false` como antes). Antes se verificó que lo desplegado era idéntico a `main` (el deploy solo agrega este fix).
- [x] En vivo, secretaria sede 1, sin efectos (licencia vencida / email que no coincide): crear en sede 2 → **403**, reenviar instructor de sede 2 → **403**; controles sede 1 → 400 de licencia y de email (pasan la validación de sede).
