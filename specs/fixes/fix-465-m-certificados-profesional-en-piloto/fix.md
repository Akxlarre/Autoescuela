# Fix: Certificados Profesional habilitado en el piloto (sin depender de asistencia ni notas)
> id: fix-465-m-certificados-profesional-en-piloto
> refs: fix-447-m-testing-documentos-certificacion · fix-256-m · fix-463-m
> status: done
> closed: 2026-10-19
> created: 2026-10-19

## Root Cause

fix-256-m definió el recorte de Profesional del piloto (`'clase-profesional-recorte'`) y metió
Certificados Prof. en él junto con Relatores, Asistencia y Evaluaciones. La intención del recorte
era omitir los datos académicos que en la práctica se llevan a mano en el libro de clases
(relatores, asistencia, notas), no la emisión del certificado: con Certificados bloqueado, ningún
alumno de una promoción finalizada puede recibir su certificado durante el piloto. fix-463-m
heredó el error al sacar "Certificado Profesional" del editor de plantillas.

Además, la elegibilidad de la secretaria exige teoría ≥ 75 % de asistencia, dato que en el piloto
no se registra: destapar la vista sin ajustar eso dejaría a todos como no elegibles.

## ACs Afectados

- AC propio — Certificados Prof. (admin y secretaria) es accesible y aparece en el menú aunque el
  recorte siga activo. Relatores, Asistencia, Evaluaciones y Pre-inscritos siguen bloqueados.
- AC propio — con el recorte activo, la elegibilidad de la secretaria depende solo del pago; fuera
  del piloto vuelve a exigir teoría ≥ 75 %. Admin sigue siempre elegible.
- AC propio — con el recorte activo, la vista no muestra las columnas Teoría / Práctica / Nota ni
  los motivos académicos de no elegibilidad (no hay datos que mostrar).
- AC propio — con el portal del alumno en piloto, generar un certificado Profesional no notifica al
  alumno (mismo criterio que fix-463-m aplicó a Clase B).
- AC propio — el editor de plantillas vuelve a ofrecer "Certificado Profesional" en la sede con
  Profesional (revierte esa parte de fix-463-m).

## Cambio

- `app.routes.ts`: las rutas `clase-profesional/certificados` y `profesional/certificados` dejan
  el `pilotPhaseGuard('clase-profesional-recorte')`.
- `menu-config.service.ts`: "Certificados Prof." deja de ser `hiddenInPilotRecorte`.
- `core/utils/certificacion-profesional.utils.ts` (nuevo): `isEligibleForProfessionalCertificate()`
  pura; el facade la usa con `academicRequired = !isBlockedInPilot('clase-profesional-recorte')`.
- `CertificacionProfesionalFacade.notifyCertificateReady()`: `if (isBlockedInPilot('alumno')) return;`.
- `certificacion-profesional-content` y `generar-pendientes-prof-drawer`: ocultan lo académico
  mientras dure el recorte.
- `editableDocumentTypes()`: ya no filtra `certificate_professional`.

## Test de Regresión

- `certificacion-profesional.utils.spec.ts` — elegibilidad con y sin recorte.
- `certificacion-profesional.facade.spec.ts` — con el portal en piloto, generar no notifica.
- `menu-config.service.spec.ts` — Certificados Prof. visible con el recorte activo.
- `document-template-options.utils.spec.ts` — "Certificado Profesional" disponible en la sede con
  Profesional.

## Progreso

- [x] Tests rojos → verdes (facade: notificaba con el portal en piloto; util nueva; menú sin
  Certificados). 41/41 en los 4 specs.
- [x] `npm run lint:arch` 0 errores; `npm run test:ci` 4388 verdes.
- [x] `/verify` (secretaria sede 2, promoción 277 / A2): la ruta carga sin "Módulo no disponible",
  la tabla queda en Alumno · RUT · Promoción · Pago · Estado · Acciones, "Generar" se deshabilita
  solo por pago pendiente, consola sin errores.
