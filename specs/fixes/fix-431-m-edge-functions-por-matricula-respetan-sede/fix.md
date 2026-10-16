# Fix: Las funciones que reciben una matrícula la entregan aunque sea de otra sede
> id: fix-431-m-edge-functions-por-matricula-respetan-sede
> refs: fix-429-m-testing-servicios-especiales · fix-430-m · spec 0047-b
> status: in_progress
> created: 2026-10-15

## Root Cause

Hermano de `fix-430-m`, con otra entrada: las funciones de staff que reciben un `enrollment_id`
leen la matrícula con la clave de servicio y nunca comparan su sede con la de quien llama.
Confirmado en vivo el 2026-10-15: con su propio token, la secretaria de la sede 1 descarga la ficha
de matrícula (`generate-enrollment-sheet`) de la matrícula 6985 de la sede 2, con los datos
personales del alumno. Las demás funciones con `enrollment_id` tienen el mismo código (no se
llamaron porque escriben en Storage o envían un correo).

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: una secretaria sin grant que pide una matrícula de otra sede recibe 403, sin efectos
  (no se genera ni sube ningún archivo, no se envía ningún correo).
- AC-2: admin, secretaria con grant y secretaria de la misma sede siguen obteniendo el documento.
- AC-3: una matrícula inexistente sigue respondiendo el 404 de cada función.

## Cambio

- `supabase/functions/_shared/staff-auth.ts` — `canAccessBranch()` (núcleo puro, misma regla que la
  RLS: sede propia o fila sin sede) y `denyIfEnrollmentOutOfScope()`.
- `generate-enrollment-sheet`, `generate-student-license-pdf`, `generate-contract-pdf`,
  `generate-certificate-b-pdf`, `generate-certificate-professional-pdf`,
  `send-enrollment-contract-email` — rechazo antes de leer la matrícula.

Fuera de alcance: `generate-class-book-pdf` (recibe un curso de promoción profesional, que solo
existe en la sede 2) y el modo vista previa de plantillas (`branch_id` elige la plantilla, sin
datos personales).

## Test de Regresión

- `supabase/functions/_shared/staff-auth.test.ts` — 3 casos de `canAccessBranch` (22/22 ✓).
- `deno check` de las 6 funciones: sin errores nuevos.
- Verificación en vivo tras el deploy (pendiente: el deploy lo hace Matías): secretaria A con la
  matrícula 6985 (sede 2) → 403; con una matrícula de la sede 1 → 200.
