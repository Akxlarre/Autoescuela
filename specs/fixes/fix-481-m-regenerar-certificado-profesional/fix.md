# Fix: No se puede regenerar un certificado Profesional ya generado
> id: fix-481-m-regenerar-certificado-profesional
> refs: fix-480-m-testing-certificacion-profesional · fix-464-m
> status: done
> closed: 2026-10-22
> created: 2026-10-22

## Root Cause

`fix-464-m` agregó "Regenerar" solo a Clase B. En Certificados Profesional una fila "Generado"
ofrece Ver y Email: si después se corrige el nombre del alumno o la plantilla, no hay forma de
reemitir el PDF. `CertificacionProfesionalFacade` no tiene `regenerarCertificado`.

## ACs Afectados

- AC propio — una fila "Generado" (tabla y tarjeta) tiene "Regenerar"; pide confirmación
  (`confirmarRegeneracion`), vuelve a generar el PDF con los datos y la plantilla actuales y
  conserva el folio (la RPC `issue_certificate` devuelve el certificado existente).
- AC propio — si el alumno tiene deuda sin habilitación, sigue la convención de la spec 0010-i
  (motivo y reintento), igual que al generar.
- AC propio — cancelar la confirmación no invoca la edge function.

## Cambio

- Facade: `regenerarCertificado(enrollmentId)` — confirma, invoca con autorización de deuda,
  refresca la lista y el historial y abre el visor. No notifica al alumno (ya se le notificó al
  generar).
- Contenido: botón "Regenerar" (tabla y tarjeta), output `regenerarCertificado`; las páginas
  admin y secretaria lo conectan.

## Test de regresión

- `certificacion-profesional.facade.spec.ts` — cancelar no invoca; confirmar invoca la edge
  function, conserva el flujo de deuda y abre el visor.

## Progreso

- [x] Tests (4) rojos antes del cambio → verdes; facade 31/31, `lint:arch` sin errores, `tsc` limpio
- [x] Botón en tabla y tarjeta, admin y secretaria
- [x] Navegador (2026-10-22): con el cierre de la plantilla cambiado, "Regenerar" → confirmación →
  "Certificado regenerado"; el PDF de la matrícula 8554 trae el texto nuevo y conserva el folio 6.
  Plantilla restaurada después.
