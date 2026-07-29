# Fix: Matrícula pública — overlay bloquea foto carnet, landing sin sede, retry roto, storage huérfano
> id: fix-069-b-matricula-publica-varios
> refs: ASG-b-012
> status: in_progress
> created: 2026-07-29

## Root Cause
[Heredado de ASG-b-012, a confirmar]: 4 hallazgos del wizard público de matrícula (`/inscripcion`), todos en el mismo módulo:
- **H-020**: en el paso de subir foto carnet, un `<div aria-hidden="true">` decorativo intercepta el click real, impidiendo abrir el selector de archivos en esa posición (confirmado con 9 reintentos de Playwright, no es artefacto de automatización).
- **H-019**: `/inscripcion` sin parámetro de sede muestra links `href="#"` que no navegan a ningún lado — un prospecto que llega directo a esta URL queda en un callejón sin salida.
- **H-033**: tras un pago Webpay rechazado, el botón "Intentar con otra tarjeta" arma el link de retry sin el parámetro `sede`, y el borrador local ya se limpió al enviar la matrícula (antes de que Webpay confirme) — el alumno pierde ~10 minutos de trabajo (datos, 12 clases, foto, firma) y cae en la misma pantalla muerta de H-019.
- **H-034**: consecuencia de lo anterior — las fotos carnet subidas en intentos abandonados/rechazados quedan huérfanas en Storage para siempre, sin job de limpieza.

Alcance sugerido (de la Asignación):
- H-020: revisar z-index/pointer-events del ícono decorativo sobre la zona de upload.
- H-019 + H-033: agregar `sede`/`branchId` al `[queryParams]` del link de retry en `public-enrollment-retorno.component.ts:372-374`; mover `this.clearDraft()` en `public-enrollment.facade.ts` (línea ~1102) del envío inicial al callback de éxito real de Webpay, no antes.
- H-034: job periódico (cron SQL o Edge Function) que borre archivos de `public-uploads/carnet/` sin `student_documents` asociado tras N días — o mover el upload a después de la confirmación de pago.

## ACs Afectados
Ninguno — fix autónomo. Hallazgos de auditoría: H-019, H-020, H-033, H-034 (ver `indices/FLOWS-QA-AUDIT.md`).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `ruta/al/archivo.ts`
- **Qué cambia:** descripción en una línea

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `ruta/archivo.spec.ts > nombre del test` ✓
