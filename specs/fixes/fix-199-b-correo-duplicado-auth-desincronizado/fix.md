# Fix: Cambiar o dar de alta un correo ya usado deja Auth desincronizado y muestra un error 500
> id: fix-199-b-correo-duplicado-auth-desincronizado
> refs: ASG-i-034 (sospechas S5 y S6 —parte servidor—, confirmadas en fix-197-b) · fix-029-i
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] Las Edge Functions de alta y edición de personas
manejan mal el correo duplicado:
1. **Auth y `users` desincronizados (S5):** `update-instructor`, `update-secretary` y
   `update-student-profile` cambian el correo **primero en Auth** y después en `public.users`. Si
   ese UPDATE falla —p. ej. `users_email_key`: el correo ya existe en `users` pero no en Auth, justo
   el caso que registró `fix-029-i`— **no revierten Auth**: la persona entra con el correo nuevo y la
   app la busca por el viejo.
2. **Duplicado reportado como 500 (S6, servidor):** las cinco funciones (`create-instructor`,
   `create-secretary` y los tres `update-*`) detectan el duplicado con
   `message.includes('already registered')`, pero Supabase hoy responde "A user with this email
   address has already **been** registered" (`code: 'email_exists'`): el 409 se vuelve 500 con el
   texto crudo en inglés.

## ACs Afectados
Ninguno de una spec previa. ACs propios:

- **F1:** un correo ya usado por **otro** usuario en `users` se rechaza con 409 "Ya existe un
  usuario con ese correo electrónico" **antes** de tocar Auth.
- **F2:** si Auth ya cambió y el UPDATE de `users` falla, el correo de Auth se revierte al anterior.
  Si el fallo es por duplicado (23505), la respuesta es el mismo 409.
- **F3:** un correo duplicado en Auth (`email_exists` / "already (been) registered") → 409 con el
  mensaje en español, en las cuatro funciones (create-secretary queda fuera, ver abajo).
- **F4:** sin cambios en el camino feliz (correo nuevo y libre, o correo sin cambios).

## Cambio
- `supabase/functions/_shared/email-errors.ts` (+ test) — `isEmailTakenError`, `isUniqueViolation`.
- `supabase/functions/update-instructor`, `update-secretary`, `update-student-profile` — chequeo
  previo en `users` + reversión de Auth.
- `supabase/functions/create-instructor` — detección del duplicado (Auth) y 23505 → 409 con
  `duplicateUserMessage` (RUT o correo).

**`create-secretary` queda fuera:** la versión desplegada tiene código de `fix-182-b` que nunca
llegó a `main` (commit `f68e63b2` y 4 commits de docs, subidos a la rama después de mergear el
PR #184: chequeo previo de RUT duplicado y 23505 → 409). Desplegarla desde esta rama borraría ese
arreglo de producción. Primero hay que recuperar esos commits en `main`.

## Test de Regresión
- `deno test supabase/functions/_shared/email-errors.test.ts`
- Tras el deploy (sin efectos): como admin, editar una secretaria/instructor de prueba poniéndole el
  correo de otro usuario existente → 409 y su correo en Auth y en `users` sin cambios.

## Progreso
- [x] `deno test` de `_shared/email-errors` + `user-edit-authz` → 34/34; sintaxis de las 4 funciones OK (esbuild).
- [x] Lo desplegado de `update-instructor`, `update-secretary`, `update-student-profile` es idéntico a `main`, y `create-instructor` a fix-198-b: el deploy solo agrega este fix.
- [x] Desplegadas (aprobado por el owner, 2026-10-07): `update-instructor` v21 (`verify_jwt:true`, como estaba — un primer deploy lo dejó en false y se corrigió al instante), `update-secretary` v18, `update-student-profile` v9 y `create-instructor` v20 (`verify_jwt:false`, como estaban).
- [x] En vivo, como admin, correo de otro usuario (`admin@test.com`) a secretaria2, `instructor@test.com` y un alumno del seed: las 3 → **409 "Ya existe un usuario con ese correo electrónico"**; correos en `users` sin cambios y secretaria2 sigue entrando con su correo (Auth intacto).
