# Fix: Edge functions que responden sin sesión
> id: fix-043-i-edge-functions-sin-sesion
> refs: ASG-i-041, 0009-i-edge-functions-exigir-usuario-staff
> status: done
> closed: 2026-10-02
> created: 2026-10-01

## Root Cause

[Heredado de ASG-i-041, a confirmar]: cinco edge functions usan la clave de servicio (saltan
RLS) y no verifican quién llama. Tres tienen `verify_jwt = false` en `supabase/config.toml`
(`generate-contract-pdf`, `generate-class-book-pdf`, `auto-create-next-promotions`); las otras
dos (`generate-certificate-professional-pdf`, `export-special-services`) dejan `verify_jwt` en
`true`, pero la anon key pública pasa ese chequeo, así que tampoco basta. Confirmado en vivo
(2026-09-30): `export-special-services` responde 200 sin ningún header, con las ventas de todas
las sedes.

Llamadores legítimos (revisados al reclamar):

| Función | Llamador | Autorización correcta |
|---|---|---|
| `generate-contract-pdf` | Staff: pre-inscritos, matrícula presencial, vista previa de plantillas | `requireStaff(['admin','secretary'])` |
| `generate-class-book-pdf` | Staff: libro de clases | `requireStaff(['admin','secretary'])` |
| `export-special-services` | Staff: servicios especiales | `requireStaff(['admin','secretary'])` |
| `generate-certificate-professional-pdf` | Staff: certificación profesional, plantillas | `requireStaff(['admin','secretary'])` |
| `auto-create-next-promotions` | Solo pg_cron, con la service key del Vault | Claim `role = service_role` (mismo patrón que `dispatch-scheduled-announcements`) |

La matrícula pública no depende de `generate-contract-pdf`: `public-enrollment` usa
`_shared/contract-pdf.ts` directo.

## ACs Afectados

Ninguno — fix autónomo (originado de ASG-i-041).

- AC-1: las 4 funciones de staff responden 401 sin header, con la anon key o con un token
  inválido; 403 a alumno e instructor.
- AC-2: admin y secretaria siguen obteniendo el mismo resultado que antes en las 4 funciones de
  staff (sin regresión en las pantallas que las llaman).
- AC-3: `auto-create-next-promotions` responde 401 a la anon key y a cualquier usuario
  logueado (incluido admin); solo el token de rol de servicio pasa.
- AC-4: el cron diario de `auto-create-next-promotions` sigue funcionando (la clave del Vault es
  de rol de servicio).

## Cambio

- **`supabase/functions/{generate-contract-pdf,generate-class-book-pdf,export-special-services,generate-certificate-professional-pdf}/index.ts`** — `requireStaff()` de `_shared/staff-auth.ts` al inicio del handler.
- **`supabase/functions/auto-create-next-promotions/index.ts`** — chequeo del claim `role = service_role`.
- **`supabase/config.toml`** — quitar `verify_jwt = false` de las 3 funciones que lo tienen.

## Test de Regresión

- `supabase/functions/_shared/staff-auth.test.ts` (ya existente) + test del chequeo de rol de servicio.
- Verificación en vivo con las 7 identidades de 0009-i (admin, secretaria, alumno, instructor,
  sin header, anon key, token inválido).

## Progreso

- [x] Código: `requireStaff()` en las 4 funciones de staff; `isServiceRoleRequest()` (nuevo
  `_shared/service-role-auth.ts`) en `auto-create-next-promotions`; `verify_jwt = false` quitado
  de `config.toml`.
- [x] Tests Deno: 17/17 en verde (`staff-auth.test.ts` 11 + `service-role-auth.test.ts` 6);
  `deno check` limpio en las 5 funciones.
- [x] Despliegue de las 5 funciones a `skvekggejikzxhzsjmkz` (2026-10-02, ejecutado por Ignacio: el control
  de permisos de Claude Code bloqueó el deploy desde el agente).
- [x] Verificación en vivo (AC-1, AC-2, AC-3) — ver Evidencia.
- [x] AC-4: cron forzado desde el SQL Editor con la misma llamada del job (`net.http_post` + service key
  del Vault), request 2142 → `200 {"created":0}`: el cron pasa la autorización (no había promociones
  faltantes, así que no creó ninguna).
- [x] `indices/DATABASE.md`: fila de `_shared/service-role-auth.ts` + funciones nuevas en la de `staff-auth.ts`.
- [x] `/fix-close`.

## Evidencia de Verificación

Script de solo lectura con 7 identidades contra producción (2026-10-02), después del deploy:

| Función | admin / secretaria | alumno / instructor | sin header / anon key / token inválido |
|---|---|---|---|
| `generate-contract-pdf` (`mode: 'sample'`) | 200, PDF | 403 | 401 |
| `generate-class-book-pdf` | 404 "Curso no encontrado" (id inexistente a propósito: pasa la autorización sin escribir en `class_book`) | 403 | 401 |
| `export-special-services` | 200, 6 filas | 403 | 401 |
| `generate-certificate-professional-pdf` (`mode: 'sample'`) | 200, PDF | 403 | 401 |
| `auto-create-next-promotions` | **401** (un usuario logueado no es rol de servicio) | 401 | 401 |

Sin escrituras en BD: los modos `sample` no escriben, y el libro de clases y las promociones se
probaron por el camino de rechazo o de "no encontrado".

## Notes

- Originado de Asignación ASG-i-041 (`specs/assignments/ASG-i-041-edge-functions-accesibles-sin-sesion.md`).
