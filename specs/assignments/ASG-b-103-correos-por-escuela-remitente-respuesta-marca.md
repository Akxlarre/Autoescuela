# Asignación ASG-b-103 — Correos por escuela: remitente, respuesta y marca

> **status:** completada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-11-12
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-11-12
> **resulting_track:** 0061-b-correos-por-escuela-remitente-respuesta-marca

---

## Contexto / Objetivo

Implementar la spec **`0061-b-correos-por-escuela-remitente-respuesta-marca`, ya escrita y aprobada
por el owner el 2026-11-12** (13 AC y 6 casos borde). Las dos escuelas son razones sociales
distintas y hoy todo correo sale con un solo remitente global, sin dirección de respuesta, y los
comunicados mezclan la marca y el consentimiento promocional de las dos. Objetivo: cada correo
sale con el nombre y la dirección de su escuela en `gestordeautoescuelas.cl`, las respuestas llegan
al correo de contacto de esa escuela, cada escuela respeta solo el consentimiento que le dieron a
ella, y el admin configura todo eso desde la app.

## Alcance sugerido

El alcance cerrado está en la spec (§3 AC, §4 Out of scope). Resumen:

- Remitente, dirección de respuesta, asunto y pie por escuela en las 8 Edge Functions que envían
  por SMTP, armados desde un único módulo en `supabase/functions/_shared/`.
- Comunicados: marca de la escuela que envía; consentimiento promocional filtrado por escuela; un
  comunicado de todas las escuelas se envía una vez por escuela.
- Portal del alumno: un consentimiento promocional por escuela, revocable por separado.
- Configuración de correo por escuela, solo admin, con "Enviar correo de prueba" y un solo correo
  de contacto por escuela.
- Primera activación del alumno sin `inviteUserByEmail`.
- Fuera: Zoom, un dominio propio por escuela, contraseñas SMTP desde la app.

## Referencias

- Spec: `specs/specs/0061-b-correos-por-escuela-remitente-respuesta-marca/spec.md`
- `0040-b` (consentimiento de comunicaciones), `fix-181-b` (recuperar contraseña),
  `docs/DEPLOY.md` §Cambiar de dominio

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/_shared/announcement-send.ts`
- `supabase/functions/send-announcement/index.ts`
- `supabase/functions/send-enrollment-contract-email/index.ts`
- `supabase/functions/send-certificate-email/index.ts`
- `supabase/functions/send-zoom-email/index.ts`
- `supabase/functions/activate-student-account/index.ts`
- `supabase/functions/activate-instructor-account/index.ts`
- `supabase/functions/create-instructor/index.ts`
- `supabase/functions/create-secretary/index.ts`
- `supabase/functions/_shared/staff-invite-email.ts`
- `supabase/functions/_shared/contract-email.ts`
- `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts`
- `src/app/features/admin/configuracion-web/`

## Notas para quien la reclame

- **La spec ya existe y está aprobada: no generes una nueva.** `/assign-claim` crea por defecto una
  spec con tu código; acá eso la duplicaría. En vez de eso: marca esta asignación como reclamada
  con `resulting_track: 0061-b-correos-por-escuela-remitente-respuesta-marca`, cambia el Owner de
  la spec y de su fila del ROADMAP a tu nombre, y sigue con `/spec-activate` y `/spec-plan` sobre
  `0061-b`.
- **Antes de planificar, Benjamín tiene que crear en cPanel** las casillas `autoescuela-chillan@`,
  `conductores-chillan@` y `cuentas@` en `gestordeautoescuelas.cl`. Con ellas se resuelve la
  primera decisión abierta (§9 de la spec): si el hosting deja enviar con varios remitentes desde
  una sola cuenta. El hosting sale por MailChannels. El resultado define si hay un secret SMTP o
  uno por escuela.
- La otra decisión abierta es la configuración actual: el valor de `SMTP_FROM` y si Supabase Auth
  ya tiene SMTP propio.
- Supabase es **producción** (no hay BD de desarrollo): cuidado con migraciones y con probar
  envíos reales a alumnos.
