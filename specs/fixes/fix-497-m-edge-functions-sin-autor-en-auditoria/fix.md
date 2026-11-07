# Fix: Certificados, libro de clases y licencias quedan "sin usuario" en Auditoría
> id: fix-497-m-edge-functions-sin-autor-en-auditoria
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

C11 de `fix-485-m`: emitir un certificado queda en Auditoría como "Sistema" ("Registrado: Folio 8
- …", `user_id` NULL), aunque lo emitió una secretaria o el admin.

Las edge functions escriben con la clave de servicio. `log_change()` solo atribuye una escritura
con clave de servicio si la petición trae el header `x-audit-user-id` (fix-069-i). Lo mandan
`create-*`/`update-*` de usuarios, pero no estas cuatro, que escriben en tablas auditadas:

| Función | Escritura auditada |
|---|---|
| `generate-certificate-b-pdf` | `issue_certificate()` → `certificates`; `enrollments.certificate_b_pdf_url` |
| `generate-certificate-professional-pdf` | `issue_certificate()` → `certificates` |
| `generate-class-book-pdf` | upsert de `class_book` |
| `generate-student-license-pdf` | `enrollments.license_*_url` |

## ACs Afectados

- Ninguno de spec; C11 de `fix-485-m` (autor de la acción en Auditoría).

## Cambio

- `supabase/functions/_shared/staff-auth.ts`: `auditClientOptions(userId)` arma las opciones de
  `createClient` con el header `x-audit-user-id` (un solo lugar para la regla).
- Las 4 funciones crean su cliente de servicio con `auditClientOptions(access.userId)`.

## Test de Regresión

- `supabase/functions/_shared/staff-auth.test.ts > auditClientOptions`.
- Desplegadas por Matías (2026-11-07). `generate-class-book-pdf` llamada como admin: el registro de `class_book` queda con `user_id = 2` (admin) y sede 2, ya no "Sistema". Las otras 3 usan el mismo helper.
