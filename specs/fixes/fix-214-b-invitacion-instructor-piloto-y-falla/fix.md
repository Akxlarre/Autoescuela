# Fix: Invitaciones de instructor durante el piloto y cuando el correo falla
> id: fix-214-b-invitacion-instructor-piloto-y-falla
> refs: ASG-i-034 (casos H06 y C29, §5) — decisiones del owner 2026-10-07: no mandar invitaciones durante el piloto (ocultar el botón); avisar al admin si el correo no salió
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.]
- **H06:** el portal de instructores está bloqueado en el piloto (`pilot-phase.config.ts`), pero crear
  un instructor le manda igual "Activa tu cuenta de instructor" y Editar ofrece "Reenviar
  invitación": el instructor activa una cuenta que lleva a "Módulo no disponible".
- **C29:** si el correo de invitación falla, `create-instructor` solo lo escribe en el log y responde
  éxito: el admin ve "Instructor creado" y nadie sabe que el correo no salió.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** con el portal de instructores bloqueado, Crear manda `sendInvite: false` y la función no
  envía el correo (la cuenta igual se crea con su link). Fuera del piloto, `sendInvite: true`.
- **F2:** la función responde `inviteEmailSent: true|false`.
- **F3:** si se pidió el correo y no salió, el toast es de advertencia: "Instructor creado, pero no se
  pudo enviar el correo de invitación. Reenvíala desde Editar instructor."
- **F4:** durante el piloto, Editar oculta "Reenviar invitación" y explica que las invitaciones se
  habilitan cuando termine el piloto.
- **F5:** sin `sendInvite` en el body (llamadores viejos) la función se comporta como antes (envía).

## Cambio
- `supabase/functions/create-instructor/index.ts` — `sendInvite` (default true) e `inviteEmailSent`. **Requiere deploy.**
- `src/app/core/utils/instructor-invite.utils.ts` (+ spec) — `instructorCreatedToast()`.
- `src/app/core/facades/instructores.facade.ts` (+ spec) — manda `sendInvite`, usa la util.
- `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts` — oculta el botón en el piloto.

## Test de Regresión
- `npx vitest run src/app/core/utils/instructor-invite.utils.spec.ts src/app/core/facades/instructores.facade.spec.ts`
- `npx playwright test e2e/instructores-invitacion.spec.ts --workers=1`

## Progreso
- [x] util 4/4 y facade 40/40 (rojo → verde): `sendInvite = !isBlockedInPilot('instructor')`, toast de advertencia si `inviteEmailSent === false`.
- [x] Editar: en el piloto, nota "Las invitaciones se habilitan cuando termine el piloto…" en vez del botón. e2e: H06 ✓ (H03 se salta mientras dure el piloto). `ng build` ✓, `lint:arch` 0 errores (182).
- [x] `create-instructor`: `sendInvite` (default true) e `inviteEmailSent`. `deno lint` sin errores de sintaxis (solo reglas de estilo preexistentes). Lo desplegado era idéntico a `main` antes del cambio.
- [x] `create-instructor` desplegada v21 (aprobado por el owner, 2026-10-07; `verify_jwt:false` como estaba). Lo desplegado antes era idéntico a `main`; después, idéntico a la rama.
- [x] En vivo sin efectos (`e2e/create-instructor-deploy.spec.ts`): alta con un correo ya registrado → la función nueva responde 409 y el front manda `sendInvite` según el piloto; 0 filas creadas.
