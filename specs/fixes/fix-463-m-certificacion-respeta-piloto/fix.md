# Fix: Certificación y el editor de plantillas no respetan la fase piloto
> id: fix-463-m-certificacion-respeta-piloto
> refs: fix-447-m-testing-documentos-certificacion (S21) · fix-255-m · fix-256-m · fix-393-m
> status: done
> closed: 2026-10-19
> created: 2026-10-19

## Root Cause

`pilot-phase.config.ts` bloquea el portal del alumno (`'alumno'`) y el recorte de Profesional
(`'clase-profesional-recorte'`, que incluye `clase-profesional/certificados`), pero dos lugares no
lo consultan:

- `CertificacionClaseBFacade.notifyCertificateReady()` avisa al alumno "Tu certificado … ya está
  disponible en tu portal" aunque el portal esté bloqueado (el alumno ni siquiera tiene cuenta:
  fix-393-m dejó de invitarlo en el piloto).
- El editor de plantillas (`dms-list-content`) ofrece "Certificado Profesional" para la sede con
  Profesional, aunque esos certificados no se emiten en el piloto.

Contrato Profesional **sí** se usa en el piloto (matrícula profesional) y queda en el editor.

## ACs Afectados

- AC propio — con `'alumno'` bloqueado, generar un certificado (uno o en lote) no crea
  notificaciones para el alumno.
- AC propio — con `'clase-profesional-recorte'` bloqueado, el editor no ofrece "Certificado
  Profesional"; "Contrato Profesional" sigue disponible en la sede con Profesional.

## Cambio

- `notifyCertificateReady()`: `if (isBlockedInPilot('alumno')) return;` (mismo patrón que
  `EnrollmentFacade.inviteStudentToAuth`).
- `templateDocumentTypeOptions`: filtra `certificate_professional` mientras dure el recorte, vía la
  función pura `editableDocumentTypes()` (`core/utils/document-template-options.utils.ts`).

## Test de regresión

- `certificacion-clase-b.facade.spec.ts` — con el portal en piloto, generar no notifica; fuera
  del piloto, los tests de Spec 0024 AC7 siguen pasando (piloto mockeado como en
  `enrollment.facade.spec.ts`).
- `document-template-options.utils.spec.ts` — opciones del editor con y sin recorte (el componente
  no tiene spec; la decisión vive en la función pura).

## Progreso

- [x] Test del facade rojo antes del cambio (notificaba con el portal en piloto) → verde; los 5
  tests de Spec 0024 AC7 siguen verdes con el piloto mockeado. Util 3/3.
