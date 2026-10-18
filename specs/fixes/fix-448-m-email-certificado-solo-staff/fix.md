# Fix: El envío del certificado por correo acepta cualquier sesión y cualquier sede
> id: fix-448-m-email-certificado-solo-staff
> refs: fix-447-m-testing-documentos-certificacion (S26) · spec 0009-i · fix-431-m
> status: open
> created: 2026-10-18

## Root Cause

`send-certificate-email` usa la clave de servicio y solo exige que el token resuelva a **algún**
usuario (`auth.getUser()`). No mira el rol ni la sede: un alumno o instructor logueado, o una
secretaria de la sede 1, puede mandar el certificado (con nombre y RUT en el PDF adjunto) de
cualquier matrícula, y la acción queda en `certificate_issuance_log` a su nombre. Es la única
función de documentos/certificados que no pasó por `requireStaff` (spec 0009-i) ni por
`denyIfEnrollmentOutOfScope` (`fix-431-m`, DG-112).

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: sin sesión, con la anon key, o con la sesión de un alumno o instructor → 401/403, sin correo.
- AC-2: una secretaria sin grant que pide una matrícula de otra sede → 403, sin correo.
- AC-3: admin, secretaria de la sede de la matrícula y secretaria con grant siguen enviando igual
  que antes; el log registra a quien envió.

## Cambio

- `supabase/functions/send-certificate-email/index.ts` — reemplaza la validación manual por
  `requireStaff(req, ['admin','secretary'])` + `denyIfEnrollmentOutOfScope(access, enrollment_id)`
  antes de la primera consulta; `user_id` del log sale de `access.userId`.

## Test de regresión

Llamada real a la función con los tokens de admin, secretaria sede 1 (matrícula propia y de la
sede 2) y alumno, tras el deploy de Matías. Los helpers ya tienen tests (`staff-auth.test.ts`).
