# Fix: `send-zoom-email` envía a cualquier dirección para cualquier sesión
> id: fix-367-m-send-zoom-email-relay-abierto
> refs: fix-366-m-testing-asistencia-clase-b (S13 / L09) · ASG-i-027 · 0001-m (RF-14/15/16)
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Hallado en el bloque 1 de `fix-366-m`. Con la cuenta `alumno@test.com` (y la de instructor),
`functions.invoke('send-zoom-email', …)` responde `200 {"sent":0,"errors":[]}`: la función acepta
la llamada. Si el destinatario tuviera dirección, el correo saldría.

## Root Cause

`supabase/functions/send-zoom-email/index.ts` solo comprueba que haya un usuario logueado
(`auth.getUser()`). **Todo lo demás viene del navegador**: `recipients` (nombre + correo),
`zoomLink`, `sessionTopic` y `sessionDate`. Se interpolan sin escapar en el HTML del correo.
Cualquier cuenta (alumno, instructor, secretaria de otra sede) puede mandar, desde el SMTP de la
escuela y con su marca, un correo con cualquier enlace a cualquier dirección. Es un relay de
phishing.

## Fix

La función deja de confiar en el body:

1. **Rol:** `requireStaff(req, ['admin', 'secretary'])` (`_shared/staff-auth.ts`, el patrón de
   `0009-i`).
2. **Body nuevo:** `{ classId, enrollmentIds }`. Ya no viaja ni el enlace, ni el tema, ni la fecha,
   ni los correos.
3. **Datos desde la BD con la sesión del usuario** (cliente con su JWT, así la RLS por sede
   aplica). La sesión teórica (`class_b_theory_sessions`) aporta enlace, número, fecha y tema. Los
   destinatarios salen de `enrollments` activas **del mismo ciclo** cuyo id esté en
   `enrollmentIds`, con el correo de `students → users`. Una secretaria de otra sede no ve la
   sesión ni las matrículas → 404 / 0 destinatarios.
4. **Enlace:** solo `https://`. Cualquier otro esquema → 400.
5. **HTML:** nombre, tema, fecha y enlace se escapan.

La lógica pura (escape, validación del enlace, armado del asunto y la fecha, filtro de
destinatarios) vive en `_shared/zoom-email.ts` con su test Deno. El facade
(`ciclos-teoricos.facade.ts`) manda `{ classId, enrollmentIds }`.

6. **Al guardar** (agregado al verificar, caso L05 de `fix-366-m`): el facade no guarda un enlace
   que no sea `https://` ni lo intenta enviar; avisa "El enlace Zoom debe empezar con https://".
   Antes "hola" se guardaba sin aviso y el envío fallaba con un error genérico.

Fuera de alcance: mover el sello `zoom_sent_at` al servidor (hoy lo escribe el facade con la RLS
de la secretaria; no es una vía de abuso).

## Acceptance Criteria

- [x] AC1 — Alumno e instructor reciben 403 de `send-zoom-email`.
- [x] AC2 — Una secretaria no puede enviar el Zoom de una sesión de otra sede (404) ni a
      matrículas de otra sede o de otro ciclo (quedan fuera de los destinatarios).
- [x] AC3 — El body ya no acepta destinatarios, enlace, tema ni fecha: se ignoran y salen de la BD.
- [x] AC4 — Un enlace guardado que no es `https://` → 400, sin enviar nada.
- [x] AC5 — Nombre, tema, fecha y enlace llegan escapados al HTML (test Deno).
- [x] AC6 — El envío desde Asistencia → Ciclos Teóricos sigue funcionando: toast "Enlace enviado"
      y badge "Enviado el…" (regresión del facade + prueba real tras el despliegue).

## Regression Test

- `supabase/functions/_shared/zoom-email.test.ts` (Deno, puro).
- `src/app/core/facades/ciclos-teoricos.facade.spec.ts` → `sendZoomEmail` manda
  `{ classId, enrollmentIds }`.
- Script por API (scratchpad): alumno/instructor → 403; secretaria B con sesión de sede 1 → 404.

## Verificación (2026-10-11)

Matías desplegó `send-zoom-email`. `fix367-368-verificar.cjs` (scratchpad de la sesión):
alumno → 403, instructor → 403, secretaria B con sesión de sede 1 → 404 "Clase no encontrada",
body viejo con `recipients` → 400 "Parámetros inválidos". `fix367-ac2.cjs`: secretaria B con la
sesión de la clase 4 del ciclo 27 y una matrícula de otro ciclo de su sede, o una de la sede 1 →
400 "Sin destinatarios con correo en este ciclo"; secretaria A con esa sesión (sede 2) → 404.
Test Deno 8/8. Facade 20/20.

Navegador como `secretaria2@test.com`, Asistencia → Ciclos Teóricos, ciclo 27 (1 alumno de prueba
`e2e-profconb-…@test.com`):
- Enlace "hola" → al guardar: toast "El enlace Zoom debe empezar con https://", no se guarda.
- Enlace `https://zoom.us/j/1234567890` en la clase 4 → "Enviar a 1" → `POST send-zoom-email`
  200, toast "Enlace enviado — Correo enviado a 1 alumno.", badge "Enviado el 11 oct, 14:20".
  Consola sin errores. Captura `.playwright-mcp/fix367-envio-ok.png`.
- Dato dejado: la clase 4 del ciclo 27 queda con ese enlace y `zoom_sent_at`.

## Despliegue

Lo despliega Matías: `npx supabase functions deploy send-zoom-email`. Sin migración.
