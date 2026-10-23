# Fix: unificar la autorización de las Edge Functions (`staff-auth.ts` + `user-edit-authz.ts`)
> id: fix-235-b-unificar-autorizacion-edge-functions
> refs: ASG-i-058
> status: done
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
Al revisar el código: `requireStaff()` ya devolvía la sede y el grant del llamador (lo agregó
fix-430-m después de crearse la asignación), y las funciones de usuarios ya respondían
`{ "error": ... }` (su `errorResponse` envuelve el `message` de `user-edit-authz`). Lo que quedaba
repetido era la resolución del llamador (`auth.getUser()` + `users`/`roles`), copiada en 8 funciones.

- `_shared/user-edit-authz.ts` (+ test): `editCallerFrom(access)` convierte lo que resolvió
  `requireStaff()` en el `EditCaller` de las reglas sobre el objetivo (T2: las reglas siguen aparte).
- 8 funciones pasan a `requireStaff()` en vez de cargar al llamador a mano: `update-instructor`,
  `update-student-profile`, `create-instructor`, `activate-instructor-account` (con
  `editCallerFrom`), `activate-student-account`, `create-secretary`, `update-secretary` (solo admin)
  y `send-announcement`. Cada una conserva su mensaje propio de 403; `x-audit-user-id` /
  `assigned_by` usan `access.userId`.
- Fuera: `export-table-pdf` solo exige sesión (cualquier rol); no es la misma regla.

## Test de Regresión
- deno `staff-auth.test.ts` + `user-edit-authz.test.ts`: 51/51.
- Matriz antes/después por API contra las funciones desplegadas: 7 identidades (sin sesión, admin,
  secretaria A, B, multisede, instructor, alumno) × 8 funciones con cuerpo vacío + casos de otra sede
  e ids inexistentes — **63/63 respuestas idénticas** (status y cuerpo), sin escrituras.
- e2e `alumnos-b-ficha` M04 (rechazo de otra sede) y M14/M16 (guardado real con auditoría);
  `comunicacion-comunicados` K04/L05 (vista previa de `send-announcement`).
- `deno check`: ninguna función suma errores de tipos (2 bajan: los del bloque viejo).

## Despliegue (2026-10-20)
`activate-student-account` v21, `create-secretary` v21, `update-secretary` v20,
`send-announcement` v9, `activate-instructor-account` v4, `create-instructor` v24,
`update-instructor` v24 (verify_jwt true, como estaba), `update-student-profile` v10.
