# Hotfix: Enviar el certificado por correo muestra el motivo del rechazo
> id: hotfix-160-m-envio-certificado-muestra-el-motivo
> refs: fix-447-m-testing-documentos-certificacion (S16, resto) · fix-455-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
`enviarEmail()` (Certificación B y Profesional) mostraba siempre un error genérico. Los rechazos
de `send-certificate-email` traen un motivo redactado para personas ("El alumno no tiene email
registrado", "El certificado aún no ha sido generado") que se perdía.

## Cambios
- **Archivo:** `src/app/core/facades/certificacion-clase-b.facade.ts` (+ spec) — el toast usa
  `edgeFunctionUserMessage()` (motivo del 4xx; genérico si es 5xx o red).
- **Archivo:** `src/app/core/facades/certificacion-profesional.facade.ts` (+ spec) — ídem.
