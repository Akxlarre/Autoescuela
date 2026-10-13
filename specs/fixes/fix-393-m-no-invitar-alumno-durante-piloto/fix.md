# Fix: el alumno recibe una invitación a un portal que está deshabilitado en el piloto
> id: fix-393-m-no-invitar-alumno-durante-piloto
> refs: ASG-m-010 · fix-214-b (mismo criterio para instructores) · fix-255-m (`pilot-phase.config.ts`) · fix-193-b (`PUBLIC_ENROLLMENT_ENABLED`)
> status: in-progress
> created: 2026-10-13

## Síntoma

Al confirmar una matrícula, el alumno recibe el correo "Activa tu cuenta para acceder a tu portal
de alumno" (íconos "Mi horario / Mi progreso / Mis pagos", botón "Activar mi cuenta"). El portal
del alumno está bloqueado en el piloto: si activa la cuenta, llega a "Módulo no disponible".

## Root Cause

[Heredado de ASG-m-010, a confirmar]: el portal del alumno está deshabilitado durante el piloto
(`'alumno'` en `BLOCKED_MODULES`, `src/app/core/config/pilot-phase.config.ts`), pero
`EnrollmentFacade.inviteStudentToAuth()` llama igual a `activate-student-account` en los dos
caminos que confirman la matrícula, y Editar perfil del alumno ofrece "Enviar invitación". Esa
función es la que crea la cuenta de Auth, manda el correo y crea la notificación "Bienvenido al
portal".

Riesgo asociado: `cleanup_expired_drafts()` borra el `user` de un borrador vencido si
`supabase_uid IS NULL` y no es instructor, sin revisar que su `student` siga existiendo. Sin
invitación, ningún alumno del piloto tendrá `supabase_uid`: si uno con matrícula activa deja vencer
un segundo borrador, el `DELETE FROM users` choca con la FK `students.user_id` y aborta toda la
limpieza. El bug ya existe hoy para alumnos cuya invitación falló.

## Fix

**Decisión de Matías (2026-10-12):** durante el piloto el alumno no recibe ningún correo de
invitación al matricularse. Decide la app con `isBlockedInPilot('alumno')`, igual que `fix-214-b`;
no se despliega ninguna edge function.

- `EnrollmentFacade.inviteStudentToAuth()` no llama a `activate-student-account` en el piloto.
- Editar perfil del alumno: en el piloto, nota "las invitaciones se habilitan cuando termine el
  piloto" en vez del botón "Enviar invitación".
- Migración: `cleanup_expired_drafts()` solo borra un `user` al que no le queda ningún `student`.

Fuera de alcance:
- `public-enrollment` tiene su propia invitación en el servidor. No se alcanza mientras
  `PUBLIC_ENROLLMENT_ENABLED` mantenga cerrada la inscripción pública.
- Texto de `invite-user.html` y una invitación masiva para los alumnos matriculados durante el
  piloto: se revisan al levantar la fase.

## Acceptance Criteria

- [ ] AC1 — Con el portal del alumno bloqueado, confirmar una matrícula (ambos caminos) no invoca
      `activate-student-account`. Con el portal habilitado, la invoca como antes.
- [ ] AC2 — En el piloto, Editar perfil del alumno no muestra "Enviar invitación" y explica que
      las invitaciones se habilitan cuando termine el piloto.
- [ ] AC3 — `cleanup_expired_drafts()` no falla cuando vence el borrador de un alumno sin
      `supabase_uid` que conserva otra matrícula: borra el borrador y deja `user` y `student`.
- [ ] AC4 — Un borrador vencido de alguien sin otra matrícula sigue borrando su `student` y su
      `user`.

## Regression Test

- `enrollment.facade.spec.ts` → invitación según el piloto
- Ensayo de la migración en una transacción con `ROLLBACK` (AC3 y AC4)
