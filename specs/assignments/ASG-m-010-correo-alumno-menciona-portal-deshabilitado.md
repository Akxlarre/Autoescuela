# Asignación ASG-m-010 — El correo al alumno menciona el portal, que está deshabilitado en el piloto

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-10-12
> **created_by:** m
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

El portal del alumno está deshabilitado durante el piloto (`'alumno'` en `BLOCKED_MODULES`,
`src/app/core/config/pilot-phase.config.ts`), pero el correo que recibe el alumno al matricularse
sigue invitándolo a él: "Activa tu cuenta para acceder a tu portal de alumno", los tres íconos
"Mi horario / Mi progreso / Mis pagos", el botón principal "Activar mi cuenta" (crear contraseña)
y el recuadro "¿Qué sigue?". Hay que dejar de prometer algo que el alumno no puede usar. Se decidió
no invitarlo hasta que se levante la fase (ver "Alcance sugerido").

## Alcance sugerido

- Recomendación inicial (a confirmar al reclamar): **no invitar durante el piloto**, igual que
  con los instructores (`fix-214-b`): no se crea la cuenta de Auth ni se manda el enlace para
  crear la contraseña. Motivos para no dejarlo crear la contraseña ahora:
  - El enlace vence en 1 día, así que el alumno tendría que crear la contraseña el día de la
    matrícula y recordarla meses después.
  - Al crearla, el enlace lo lleva a la app, donde el portal está bloqueado. Es la misma
    confusión que se quiere evitar.
  - Si alcanza a activarla, `first_login` pasa a `false` y ya no se le puede reenviar la
    invitación (409); tendría que usar "recuperar contraseña".
- Hacerlo como en `fix-214-b`: la app decide con `isBlockedInPilot('alumno')`, no el servidor.
  Para el alumno es más simple que para el instructor: la invitación es la que crea la cuenta
  (`inviteUserByEmail`), así que en el piloto basta con **no llamar** a
  `activate-student-account`. No hay que desplegar ninguna edge function.
  - `enrollment.facade.ts` → `inviteStudentToAuth()` (se llama desde los dos caminos que
    confirman la matrícula).
  - `admin-editar-perfil-drawer.component.ts` → ocultar "enviar invitación" y poner la misma nota
    que en Editar instructor: las invitaciones se habilitan cuando termine el piloto.
- Decidido por Matías (2026-10-12): durante el piloto el alumno **no recibe ningún correo** al
  matricularse.
- **Riesgo que hay que cubrir sí o sí:** `cleanup_expired_drafts()` borra el `user` de un
  borrador vencido si `supabase_uid IS NULL` y no es instructor, **sin revisar que su `student`
  siga existiendo**. Hoy casi todo alumno matriculado tiene `supabase_uid`, porque la invitación
  lo crea; en el piloto ninguno lo tendrá. Basta con que un alumno con matrícula activa deje
  vencer un segundo borrador (refuerzo, Profesional): el `DELETE FROM users` choca con la FK
  `students.user_id` y aborta toda la limpieza de borradores. Arreglarlo con una migración que
  solo borre users sin `students` (ni otras referencias) restantes, y ensayarla en una
  transacción con un caso así. El bug ya existe hoy para alumnos cuya invitación falló.
- Al levantar la fase, sacar `'alumno'` de `BLOCKED_MODULES` y revisar que el texto del correo
  ("Mi horario / Mi progreso / Mis pagos") coincida con lo que el portal ofrezca entonces.
- Al levantar la fase, los alumnos matriculados durante el piloto no tendrán invitación. Queda
  el botón de invitar en la ficha del alumno; evaluar si hace falta una acción masiva (puede
  quedar fuera de este track).
- La notificación interna "Bienvenido al portal" que se crea en la primera invitación debería
  seguir la misma regla.

## Referencias

- `fix-214-b` (H06/C29 de ASG-i-034): no se invita a instructores mientras su portal está en piloto.
- `fix-193-b`: el secret `PUBLIC_ENROLLMENT_ENABLED` cierra la inscripción pública en el servidor.
- `fix-254-m`: el reenvío por SMTP usa una copia exacta de `invite-user.html`.
- `fix-255-m`: `pilot-phase.config.ts` es la fuente única de los módulos bloqueados.

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/activate-student-account/index.ts`
- `supabase/email-templates/invite-user.html` (lo usa también el reenvío; deben quedar iguales)
- `src/app/core/facades/enrollment.facade.ts`
- `src/app/core/facades/admin-alumno-detalle.facade.ts`
- `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts`
- `src/app/core/config/pilot-phase.config.ts`
- `cleanup_expired_drafts()` (última versión: `supabase/migrations/20260805100000_fix_cleanup_drafts_orphan_notifications.sql`) → migración nueva

## Notas para quien la reclame

- `invite-user.html` es el template nativo de Supabase Auth: se configura en el Dashboard, así
  que un cambio ahí lo despliega Matías.
- Confirmar si `invite-user.html` lo usan otros roles. El template lee `role` de `Data`; los
  instructores usan su propio correo (`staff-invite-email.ts`).
