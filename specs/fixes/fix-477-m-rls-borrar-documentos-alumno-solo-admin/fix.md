# Fix: Solo el admin borra documentos de alumno (salvo un borrador de matrícula)
> id: fix-477-m-rls-borrar-documentos-alumno-solo-admin
> refs: fix-447-m-testing-documentos-certificacion (P10, S26)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

`delete_student_documents` deja a la secretaria borrar cualquier documento de una matrícula de su
sede. La pantalla no le muestra "Eliminar", pero por API (verificado: `delete … select` sin error)
podía borrar cédulas, certificados médicos, etc. Decisión de Matías (2026-10-20): **se cierra en la
RLS, solo el admin borra.**

Excepción necesaria: el wizard de matrícula de la secretaria borra `student_documents` mientras la
matrícula es **borrador** — "Quitar foto carnet" (`EnrollmentDocumentsFacade.removeCarnetPhoto`),
reemplazar un documento del paso 4 (`removeDocument`) y "Descartar borrador"
(`EnrollmentFacade.discardDraft`). Cerrar del todo rompería esos flujos.

## ACs Afectados

- AC propio — La secretaria NO puede borrar un documento de una matrícula que no es borrador (0
  filas, aunque sea de su sede).
- AC propio — La secretaria SÍ puede borrar documentos de un borrador de su sede (wizard).
- AC propio — El admin borra cualquiera.

## Cambio

- Migración `20261020150000_fix477_borrar_documentos_alumno_solo_admin.sql`: recrea
  `delete_student_documents` (admin, o secretaria si la matrícula es `draft` y de su sede).
  **La aplica Matías.**

## Test de Regresión

- `supabase/tests/rls/fix-477-m-borrar-documentos-alumno.sql` — en una transacción que se revierte:
  secretaria borra 0 filas de una matrícula activa de su sede; borra 1 de un borrador de su sede;
  admin borra 1 de una matrícula activa.

## Progreso

- [x] Test SQL rojo → verde (ensayado con `BEGIN … ROLLBACK`): sin la migración falla D1; con ella, OK D1–D3
- [x] Migración aplicada (Matías, 2026-10-20) y test contra la BD: OK D1, D2, D3
- [x] Wizard: con sesión real de secretaria por la API, el mismo DELETE que "Quitar foto carnet" borra 1 fila en un borrador y 0 en una matrícula activa (datos E2E- borrados)
