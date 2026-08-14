# Fix: Instructor debe recibir invitación por correo para setear contraseña (igual que alumno)
> id: fix-167-m
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-12

## Root Cause
`create-instructor` (Edge Function) crea la cuenta de Auth con `supabaseAdmin.auth.admin.createUser({ email, password: initialPassword, email_confirm: true })`,
donde `initialPassword` es el RUT sin puntos ni dígito verificador. El instructor nunca
recibe un correo — debe conocer esa convención de contraseña por fuera del sistema
(comunicada verbalmente por quien lo creó). El flujo de alumno (`public-enrollment` →
`inviteStudentToAuth`) en cambio usa `supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data })`,
que dispara el correo nativo de Supabase Auth con un magic link; al hacer clic, el
`SIGNED_IN` de `AuthFacade` carga la sesión y, como `first_login=true`, el
`firstLoginGuard` lo manda a `/force-password-change` donde setea su propia contraseña
vía `AuthFacade.updatePassword()`. `create-instructor` nunca adoptó ese patrón porque se
escribió antes de que existiera el flujo de invitación de alumnos.

**Nota de implementación (revisión post-primera-pasada):** la primera versión de este fix
reutilizó `inviteUserByEmail` directamente, pero ese método dispara el **único** template
nativo de Supabase Auth para invitaciones (`supabase/email-templates/invite-user.html`),
que está hardcodeado con copy y variables de branding exclusivas del flujo de alumno
("tu matrícula", "mis pagos", `schoolName`/`brandColor` por sede que `create-instructor`
no tiene forma de poblar). Se cambió el enfoque a `auth.admin.generateLink({ type: 'invite' })`
(crea la cuenta + devuelve el link de activación sin enviar correo) más un envío de correo
propio vía SMTP (`nodemailer`), replicando el patrón ya existente en `send-zoom-email` y
`send-certificate-email`. Esto deja el template de alumno intacto y le da al instructor un
correo con copy propio.

## ACs Afectados
Ninguno — fix autónomo (no hay spec previa para creación de instructores con AC de login).

- AC-1: Al crear un instructor, el instructor NO obtiene una contraseña utilizable de
  inmediato (no se deriva del RUT) — su cuenta de Auth se crea sin contraseña conocida.
- AC-2: El instructor recibe un correo de invitación (Supabase Auth `inviteUserByEmail`)
  con un link que lo autentica y lo redirige a `/force-password-change` para setear su
  propia contraseña, igual que el flujo de alumno.
- AC-3: El resto del flujo de `create-instructor` (inserts en `users`/`instructors`,
  rollback en cascada si falla algún insert posterior, asignación de vehículo) no cambia.

## Cambio
- **Archivo:** `supabase/functions/create-instructor/index.ts`
- **Qué cambia:**
  - Reemplaza `supabaseAdmin.auth.admin.createUser({ email, password: initialPassword, email_confirm: true, user_metadata })`
    por `supabaseAdmin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo, data } })`,
    que crea la cuenta y devuelve `action_link` sin disparar el correo nativo de Supabase.
  - Se elimina el cálculo de `initialPassword` a partir del RUT (deja de usarse).
  - Agrega `buildInviteEmailHtml()` + `sendInstructorInviteEmail()` (nodemailer + secrets
    `SMTP_HOST/PORT/USER/PASS/FROM`, mismo patrón que `send-zoom-email`/`send-certificate-email`)
    para enviar el correo de activación con copy propio de instructor, disparado al final
    del flujo (best-effort — si falla el envío no se hace rollback del instructor ya creado).
  - El resto del flujo (insert en `users` con `first_login: true`, insert en `instructors`,
    rollback en cascada si fallan esos inserts, asignación de vehículo) queda igual.

## Test de Regresión
- No hay test automatizado para Edge Functions Deno en este repo (no corren bajo `npm run test:ci`).
  Verificación manual: crear un instructor de prueba desde la UI → confirmar que llega
  correo propio (asunto "Activa tu cuenta de instructor", NO el template de matrícula de
  alumno) con el link de activación (no se le informa password) → clic en el link → redirige
  a `/force-password-change` → setea contraseña → login exitoso con esa contraseña. ✓
  **Verificado 2026-08-13** por el usuario: correo llegó con el copy correcto de instructor
  y logró setear la contraseña exitosamente.
