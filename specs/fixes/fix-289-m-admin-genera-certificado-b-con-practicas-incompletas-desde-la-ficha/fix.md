# Fix: El admin genera el certificado Clase B con prácticas incompletas desde la ficha
> id: fix-289-m-admin-genera-certificado-b-con-practicas-incompletas-desde-la-ficha
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
En la ficha del alumno, cuando faltan clases prácticas, el admin ve la confirmación "¿Deseas
generar el certificado de todas formas?". Al aceptar, la ficha llama a
`CertificacionClaseBFacade.generarCertificado(enrollmentId)` sin el segundo argumento `force`. La
Edge Function `generate-certificate-b-pdf` solo se salta el requisito de las 12 clases si recibe
`force: true` de un admin, así que rechaza el pedido y la confirmación no sirve de nada. La
pantalla de Certificación sí lo manda (`generarCertificadoForzado`); la ficha quedó sin
actualizar. Es B34 de la 2ª pasada de `fix-264-m` (`024b` L03, sospecha S10).

## ACs Afectados
- `024b` L03: el admin confirma "generar de todas formas" y el certificado se pide con
  `force: true`.
- `024b` L01: la secretaria con prácticas incompletas sigue sin poder generarlo.
- Con las prácticas completas se genera sin confirmación y sin `force`.

## Cambio
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` —
  `resolveCertificadoBAction()` (función pura) decide entre generar, pedir confirmación forzada o
  bloquear; `handleCertificado()` la usa y pasa `force` cuando el admin confirmó.

## Test de Regresión
- `admin-alumno-detalle.component.spec.ts > resolveCertificadoBAction (fix-289-m)` ✓ (4 tests)
- No se generó un certificado real desde el navegador: la función escribe un PDF en Storage y
  cambia la matrícula. Que la función acepta `force: true` de un admin ya lo cubre
  `certificacion-clase-b.facade.spec.ts > generarCertificado()` y la pantalla de Certificación.
