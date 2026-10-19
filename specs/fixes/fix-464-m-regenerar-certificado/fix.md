# Fix: No se puede regenerar un certificado ya generado
> id: fix-464-m-regenerar-certificado
> refs: fix-447-m-testing-documentos-certificacion (S17) · fix-461-m
> status: done
> closed: 2026-10-19
> created: 2026-10-19

## Root Cause

Una fila "Generado" de Certificación solo ofrece Ver y Email. Si después se corrige el nombre del
alumno o la plantilla, no hay forma de reemitir el PDF: `CertificacionClaseBFacade.descargarPdf()`
regenera, pero ningún botón lo usa.

## ACs Afectados

- AC propio — una fila "Generado" tiene "Regenerar"; pide confirmación, vuelve a generar el PDF con
  los datos y la plantilla actuales y conserva el folio (la RPC `issue_certificate` de fix-461-m
  devuelve el certificado existente).
- AC propio — el admin regenera con `force` (el certificado pudo emitirse con el bypass); la
  secretaria sin `force` (la edge function igual lo ignora para ella).

## Cambio

- Facade: `regenerarCertificado(enrollmentId)` reemplaza a `descargarPdf()` (sin usos): confirma,
  invoca la generación, refresca y abre el visor.
- Contenido de Certificación: botón "Regenerar" (tabla y tarjeta móvil), output
  `regenerarCertificado`; las páginas admin y secretaria lo conectan.

## Test de regresión

- `certificacion-clase-b.facade.spec.ts` — cancelar no invoca; confirmar invoca con `force` según
  el rol y abre el visor.

## Progreso

- [x] Tests del facade (3) rojos antes del cambio (el método no existía) → verdes; certificación
  49/49, `lint:arch` 0 errores, `ng build` limpio.
- Navegador: en la verificación conjunta del testing (fix-447-m).
