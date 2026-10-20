# Fix: correo de comunicados con la marca de su sede, baja de promociones y envío solo en curso
> id: fix-232-b-correo-comunicados-sede-baja-estado
> refs: ASG-i-035 (checklist 035, S5 · S6 · S20 · L04, L05, O05)
> status: done
> created: 2026-10-20

## Root Cause
Confirmado leyendo `supabase/functions/_shared/announcement-send.ts` y `send-announcement/index.ts`:
- **S6:** `buildEmailHtml` tenía la marca fija: logo "CC", "Conductores Chillán" en el encabezado y el
  pie, "© 2026". Un alumno de Autoescuela Chillán recibía el correo con la marca de la otra escuela.
- **S5:** el correo promocional no decía cómo dejar de recibir promociones. En el piloto el alumno no
  puede entrar a su portal para revocar el consentimiento, y la Ley 21.719 (Art. 12) exige que la
  revocación esté permanentemente disponible.
- **S20:** `send-announcement` no revisaba el estado: un admin o una secretaria que llamara la
  función a mano con el id de un comunicado cancelado o programado lo enviaba igual.

Decisiones del owner (2026-10-20): corregir y desplegar; para la baja, un pie que diga cómo pedirla
en la escuela o por el correo de la sede (la revocación la registra admin/secretaría desde la ficha).

## ACs Afectados
- 0041-b / 0042-b: el correo del comunicado (marca y pie).
- 0040-b: revocación del consentimiento promocional disponible para el titular.

## Cambio
- `supabase/functions/_shared/announcement-send.ts` (+ test nuevo `announcement-send.test.ts`):
  `buildEmailHtml(asunto, cuerpo, { sede, correoSede, promocional })` — nombre, iniciales y pie de la
  sede del destinatario, año de Chile (`chileYear`), y en los promocionales el pie de baja. Los
  destinatarios traen también el correo de su sede.
- `supabase/functions/send-announcement/index.ts`: rechaza (409) enviar o cerrar un comunicado que no
  está `enviando`; la vista previa acepta `kind` para mostrar el pie promocional.
- `src/app/core/facades/announcements.facade.ts`: la vista previa manda `kind`.
- Despliegue de `send-announcement` y `dispatch-scheduled-announcements` (comparten el módulo).

## Test de Regresión
- `npx --yes deno test --allow-env --no-lock --node-modules-dir=none supabase/functions/_shared/announcement-send.test.ts`
- e2e `comunicacion-comunicados.spec.ts` K04 (vista previa con la marca de la sede).

## Verificación
- deno: `announcement-send.test.ts` 6/6 (+ `announcement-progress.test.ts` en verde); `deno check` de las dos funciones.
- vitest `announcements.facade` 45/45; `lint:arch` sin errores.
- Desplegadas (2026-10-20): `send-announcement` v8 y `dispatch-scheduled-announcements` v5 (archivos en LF).
- e2e en vivo contra las funciones desplegadas: K04 (logo "AC", sin "Conductores Chillán", sin pie de baja en operativo), L05 (promocional con "Si no quieres recibir más promociones"), O06 (dispatch con token de usuario → 401).
- S20 (409 para un comunicado que no está `enviando`) verificado por código: no hay comunicados en la BD para probarlo en vivo sin crear filas que la RLS no deja borrar.
