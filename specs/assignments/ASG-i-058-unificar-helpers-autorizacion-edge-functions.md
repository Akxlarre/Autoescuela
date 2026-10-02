# Asignación ASG-i-058 — Unificar los helpers de autorización de las edge functions

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-10-01
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Hoy hay dos helpers de autorización en `supabase/functions/_shared/`, creados en paralelo el mismo día:

- **`staff-auth.ts`** (spec `0009-i`, Ignacio): resuelve **quién llama** desde el token
  (`auth.getUser()` + `users`/`roles`) y permite o rechaza por rol. Lo usan 11 funciones de
  reportes y documentos. Devuelve `{ ok, status, error }` y responde `{ "error": "..." }`.
- **`user-edit-authz.ts`** (`fix-179-b`, Benjamín): decide **a quién se puede editar** (alumno,
  instructor, sede del objetivo). Es puro: recibe el rol, la sede y el permiso multi-sede del que llama
  ya resueltos. Lo usan `update-instructor` y `update-student-profile`, y cada una carga a mano esos
  datos del llamador. Devuelve `{ ok, status, message }`.

No hay conflicto ni bug: cada uno resuelve una parte distinta. Pero la resolución del llamador está
repetida, y los dos formatos de error difieren (`error` vs `message`). Si cada nueva función copia
uno u otro patrón, la regla de "quién puede qué" se va a dispersar otra vez (que es justo lo que
estos helpers vinieron a corregir).

## Alcance sugerido

- Que `requireStaff()` devuelva también `branchId` y `bothBranches` del llamador, y que
  `update-instructor` / `update-student-profile` lo usen en vez de cargar al llamador a mano.
- Mantener `user-edit-authz.ts` para la regla sobre el objetivo (no fusionar responsabilidades).
- Unificar el formato de error que llega al cliente (`readEdgeFunctionError` en
  `src/app/core/utils/edge-function-error.utils.ts` lee `error`).
- Revisar si otras funciones de usuarios (`update-secretary`, `create-secretary`,
  `create-instructor`, `send-announcement`) repiten la consulta `users.select('id, roles ( name )')`
  y pueden pasar al helper.
- Sin cambio de comportamiento: verificar antes/después con las mismas identidades que usó `0009-i`.

## Referencias

- `specs/specs/0009-i-edge-functions-exigir-usuario-staff/` (helper `staff-auth.ts`)
- `specs/fixes/fix-179-b-edicion-usuarios-sin-validar-objetivo/fix.md` (helper `user-edit-authz.ts`)
- `indices/DATABASE.md` — fila de `_shared/staff-auth.ts`

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/_shared/staff-auth.ts`
- `supabase/functions/_shared/user-edit-authz.ts`
- `supabase/functions/update-instructor/index.ts`
- `supabase/functions/update-student-profile/index.ts`

## Notas para quien la reclame

- No es urgente: es orden, no seguridad. Conviene hacerlo antes de que más funciones adopten uno de
  los dos patrones (por ejemplo `ASG-i-041`, que va a usar `staff-auth.ts`).
- Coordinar con Benjamín (autor de `user-edit-authz.ts`).
