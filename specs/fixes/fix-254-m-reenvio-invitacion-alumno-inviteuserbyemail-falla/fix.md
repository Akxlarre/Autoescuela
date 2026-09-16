# Fix: Reenvío de invitación a alumno falla con "already registered" porque usa `inviteUserByEmail` para un usuario que ya existe en Auth

> id: fix-254-m
> refs: fix-253-m, fix-168-m, fix-169-m
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Root Cause

`activate-student-account` usa `auth.admin.inviteUserByEmail()` para **ambos** casos: la
primera invitación (`supabase_uid IS NULL`) y el reenvío (`supabase_uid` ya seteado,
`first_login = true`). Esa API de GoTrue **falla** con "A user with this email address has
already been registered" cuando el usuario de Auth ya existe — sin importar si confirmó su
contraseña o no. El comentario del archivo (líneas 23-25) asumía incorrectamente que
`inviteUserByEmail` "reenvía al usuario no confirmado"; no lo hace.

Este es exactamente el gotcha documentado en DG-068 (`indices/DOMAIN-GOTCHAS.md`), ya
resuelto para instructores en fix-168-m/fix-169-m: la regla de aplicabilidad ahí dice
"cualquier Edge Function de reenviar invitación... debe usar `magiclink`, no `invite`, para
el reenvío" — regla que nunca se aplicó a `activate-student-account`. Quedó expuesto recién
ahora porque fix-253-m corrigió la condición de UI que ocultaba el botón de reenvío para
este caso exacto (alumno con cuenta Auth pero `first_login = true`).

Complicación adicional (por qué no es un swap de una línea): `generateLink({ type:
'magiclink' })` NO envía correo — solo genera el link. El correo de la primera invitación
lo envía Supabase automáticamente vía su template nativo (`supabase/email-templates/invite-user.html`,
configurado en el Dashboard). Para el reenvío hay que enviar el correo manualmente (SMTP
propio, mismo patrón que `activate-instructor-account`), pero el copy debe ser **idéntico**
al de la invitación original — no el genérico de instructor.

## ACs Afectados

Ninguno — fix autónomo (mismo patrón que fix-168-m/fix-169-m, sin spec previa).

- AC-1: Reenviar invitación a un alumno con `supabase_uid` ya seteado y `first_login = true`
  ya NO devuelve 409/500 por "already registered".
- AC-2: El correo de reenvío es visualmente idéntico al de la primera invitación (mismo
  copy, mismo theming de marca por sede — `schoolName`, `schoolInitials`, colores de
  `THEME_COLORS`), solo cambia el mecanismo de envío (SMTP propio en vez del nativo de
  Supabase).
- AC-3: El flujo de primera invitación (`!supabase_uid`) no cambia — sigue usando
  `inviteUserByEmail` (correo nativo, sin costo de SMTP).

## Cambio

- **Archivo:** `supabase/functions/activate-student-account/index.ts`
  — Bifurca el envío según `targetUser.supabase_uid`:
    - Sin `supabase_uid` (primera vez): sigue igual, `inviteUserByEmail`.
    - Con `supabase_uid` (reenvío): usa `auth.admin.generateLink({ type: 'magiclink',
      email, options: { redirectTo: siteUrl, data: {...} } })` para obtener el
      `action_link`, y despacha el correo manualmente vía SMTP (nodemailer, secrets
      `SMTP_HOST/PORT/USER/PASS/FROM` — mismos que ya usa `activate-instructor-account`)
      con una función `buildStudentInviteEmailHtml()` que porta el HTML de
      `supabase/email-templates/invite-user.html` a template literals de TS (placeholders
      `{{ index .Data "x" }}` → `${x}`, `{{ .ConfirmationURL }}` → `${actionLink}`),
      reutilizando `THEME_COLORS`/`schoolName`/`schoolInitials` ya calculados en la
      función.

## Test de Regresión

- No hay test automatizado para Edge Functions Deno en este repo. Verificación manual:
  alumno con `supabase_uid` seteado y `first_login = true` (estado real de Andy Fernández,
  id 3221) → clic en "Enviar invitación" desde el drawer → confirmar que NO devuelve error
  → confirmar que llega un correo nuevo, visualmente idéntico al de la invitación original
  (mismo copy, mismo color de marca de la sede) → clic en el link → confirmar que autentica
  y redirige a la pantalla de crear contraseña → setear contraseña → login exitoso.
