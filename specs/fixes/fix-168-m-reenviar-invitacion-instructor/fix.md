# Fix: Botón "Reenviar invitación" para instructores sin cuenta activada

> id: fix-168-m
> refs: fix-167-m
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause

`fix-167-m` le dio a `create-instructor` el mismo flujo de invitación por correo que
alumnos (`generateLink` + correo propio vía SMTP), pero ese correo es best-effort: si
falla el envío (SMTP caído, typo en el email, etc.) el instructor queda con la cuenta
de Auth ya creada (`supabase_uid` seteado, `first_login: true`) pero sin haber recibido
nunca el link para setear su contraseña, y no hay ninguna forma de reintentar desde la
UI — a diferencia del alumno, que sí tiene un botón "Enviar invitación" en
`admin-editar-perfil-drawer.component.ts` cuando `!hasAuthAccount`.

Para instructor la condición de "necesita invitación" no puede ser `!supabase_uid`
(como en alumno) porque `create-instructor` siempre crea la cuenta de Auth en el mismo
paso que crea el registro — `supabase_uid` está seteado desde el principio. La señal
correcta es `first_login === true`: mientras no haya seteado su propia contraseña, sigue
pendiente de activar.

## ACs Afectados

Ninguno — fix autónomo (no hay spec previa para creación/gestión de instructores con AC
de invitación).

- AC-1: El drawer de editar instructor (`admin-instructor-editar-drawer.component.ts`)
  muestra un aviso + botón "Reenviar invitación" cuando el instructor tiene
  `firstLogin === true` (cuenta creada, contraseña nunca seteada).
- AC-2: Al hacer clic, se invoca una nueva Edge Function `activate-instructor-account`
  que reenvía el correo de activación reutilizando el mismo template/copy de
  `create-instructor` (`generateLink` + SMTP propio) — nunca el template nativo de
  Supabase reservado para alumnos.
- AC-3: Mientras se envía, el botón muestra estado de carga y queda deshabilitado; al
  terminar, se refresca el estado del instructor (`refreshSilently`).

## Cambio

- **Archivo:** `supabase/functions/activate-instructor-account/index.ts` (nuevo)
  — Edge Function que valida caller admin/secretary, busca el instructor por `userId`,
  confirma `roles.name === 'instructor'` y `first_login === true`, genera un nuevo link
  de invitación (`auth.admin.generateLink({ type: 'invite' })`) y reenvía el correo con
  el mismo copy que `create-instructor` (instructor nunca ve el template de alumno).
- **Archivo:** `src/app/core/facades/instructores.facade.ts`
  — Agrega `firstLogin` a `INSTRUCTOR_SELECT`/`InstructorRow`/`InstructorTableRow`/`mapRow`
    y un método `enviarInvitacion(userId, email)` que invoca la Edge Function nueva.
- **Archivo:** `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts`
  — Agrega el mismo bloque de aviso + botón que `admin-editar-perfil-drawer.component.ts`,
    condicionado a `facade.selectedInstructor()!.firstLogin`.

## Test de Regresión

- No hay test automatizado para Edge Functions Deno en este repo (no corren bajo
  `npm run test:ci`). Verificación manual: crear un instructor, simular que el correo no
  llegó (o esperar a que no llegue), abrir su ficha desde Admin → Instructores → Editar,
  confirmar que aparece el aviso "no tiene cuenta activada" con botón "Reenviar
  invitación", hacer clic, confirmar que llega el correo con el copy propio de
  instructor y que el link permite setear contraseña y hacer login.
