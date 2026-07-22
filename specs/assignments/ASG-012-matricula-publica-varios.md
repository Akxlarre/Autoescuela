# Asignación ASG-012 — Matrícula pública: overlay, landing sin sede, retry roto, storage huérfano

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

4 hallazgos del wizard público de matrícula (`/inscripcion`), todos en el mismo módulo:
- **H-020**: en el paso de subir foto carnet, un `<div aria-hidden="true">` decorativo intercepta el click real, impidiendo abrir el selector de archivos en esa posición (confirmado con 9 reintentos de Playwright, no es artefacto de automatización).
- **H-019**: `/inscripcion` sin parámetro de sede muestra links `href="#"` que no navegan a ningún lado — un prospecto que llega directo a esta URL queda en un callejón sin salida.
- **H-033**: tras un pago Webpay rechazado, el botón "Intentar con otra tarjeta" arma el link de retry sin el parámetro `sede`, y el borrador local ya se limpió al enviar la matrícula (antes de que Webpay confirme) — el alumno pierde ~10 minutos de trabajo (datos, 12 clases, foto, firma) y cae en la misma pantalla muerta de H-019.
- **H-034**: consecuencia de lo anterior — las fotos carnet subidas en intentos abandonados/rechazados quedan huérfanas en Storage para siempre, sin job de limpieza.

## Alcance sugerido

- H-020: revisar z-index/pointer-events del ícono decorativo sobre la zona de upload.
- H-019 + H-033: agregar `sede`/`branchId` al `[queryParams]` del link de retry en `public-enrollment-retorno.component.ts:372-374`; mover `this.clearDraft()` en `public-enrollment.facade.ts` (línea ~1102) del envío inicial al callback de éxito real de Webpay, no antes.
- H-034: job periódico (cron SQL o Edge Function) que borre archivos de `public-uploads/carnet/` sin `student_documents` asociado tras N días — o mover el upload a después de la confirmación de pago.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgos H-019, H-020, H-033, H-034 (causas raíz ya confirmadas en código para H-033).

## Notas para quien la reclame

- H-033 es el más grave de los 4 (alumno pierde su trabajo justo cuando más necesita reintentar) — priorizarlo si hay que dividir el trabajo.
- H-020 se pudo confirmar que el `<input>` funciona (se disparó el click programáticamente) — el problema es puramente visual/de hit-test, no de lógica.
