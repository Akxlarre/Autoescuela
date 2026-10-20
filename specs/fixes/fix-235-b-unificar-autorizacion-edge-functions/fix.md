# Fix: unificar la autorización de las Edge Functions (`staff-auth.ts` + `user-edit-authz.ts`)
> id: fix-235-b-unificar-autorizacion-edge-functions
> refs: ASG-i-058
> status: in_progress
> created: 2026-10-20

## Root Cause
[Heredado de ASG-i-058, a confirmar]: hay dos helpers de autorización en
`supabase/functions/_shared/`. `staff-auth.ts` (spec 0009-i) resuelve quién llama desde el token y
permite o rechaza por rol; responde `{ "error": "..." }`. `user-edit-authz.ts` (fix-179-b) decide a
quién se puede editar y es puro: `update-instructor` y `update-student-profile` cargan a mano al
llamador (rol, sede, permiso multisede) para pasárselo; devuelve `{ ok, status, message }`.

La resolución del llamador está repetida y los formatos de error difieren (`error` vs `message`). Si
cada función nueva copia uno u otro patrón, la regla de "quién puede qué" se vuelve a dispersar.

## ACs Afectados
Ninguno de comportamiento: es orden. Criterios propios:
- **T1:** `requireStaff()` devuelve también la sede y el permiso multisede del llamador;
  `update-instructor` y `update-student-profile` lo usan en vez de cargarlo a mano.
- **T2:** `user-edit-authz.ts` sigue decidiendo sobre el objetivo (no se fusionan responsabilidades).
- **T3:** las respuestas de error llegan al cliente con la misma forma (`{ "error": "..." }`, la que
  lee `readEdgeFunctionError`).
- **T4:** sin cambio de comportamiento: mismas respuestas antes y después para las mismas identidades.

## Cambio
(por definir al revisar el código)

## Test de Regresión
- deno tests de `_shared/staff-auth.test.ts` y `_shared/user-edit-authz.test.ts`.
- e2e existentes que editan instructores y perfiles de alumnos.
