# Fix: Matrícula pública — overlay bloquea foto carnet, landing sin sede, retry roto, storage huérfano
> id: fix-069-b-matricula-publica-varios
> refs: ASG-b-012
> status: done
> closed: 2026-07-29
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

## Investigación (Playwright + código, previa a implementar)

- **H-033**: causa raíz confirmada en código — `initiatePayment()` (facade, entonces línea 941)
  llamaba `clearDraft()` antes del redirect a Webpay, no después de la confirmación. El link
  de retry en `public-enrollment-retorno.component.ts:372-374` armaba `{ resume: true }` sin
  `branchId`, cayendo en el callejón sin salida de H-019 aunque hubiera borrador.
- **H-019**: causa raíz confirmada (`public-enrollment.component.ts:543`, `url: '#'` — TODO
  pendiente de config real). **Bloqueado**: `branches` no tiene columna de URL en el esquema
  (`indices/DATABASE.md`); requiere que el negocio entregue las URLs reales de las landings
  Astro de cada sede. No se implementó — fuera del alcance de este fix sin esa info.
- **H-020**: reproducido con Playwright (`elementFromPoint` + click real sobre el
  `<div aria-hidden="true">`) y **no se reprodujo el bloqueo** — el `<input>` se abrió
  correctamente. No se tocó código para este hallazgo; ver sección "Hallazgos adicionales".
- **H-034**: confirmado como gap de diseño — no existe job de limpieza de
  `public-uploads/carnet/`. No se implementó (requiere decidir cron SQL vs mover upload
  post-pago) — fuera del alcance de este fix.

## Cambio
- **Archivo:** `src/app/core/facades/public-enrollment.facade.ts`
  **Qué cambia:** `initiatePayment()` ya no llama `clearDraft()` (solo `savePendingPaymentRef()`);
  `confirmPayment()` llama `clearDraft()` únicamente en el path de éxito real, después de
  `clearPendingPaymentRef()`.
- **Archivo:** `src/app/features/public-enrollment/retorno/public-enrollment-retorno.component.ts`
  **Qué cambia:** nuevo `computed retryQueryParams()` que arma `{ resume: true, branchId }`
  desde el `branchId` ya leído de `pec_pending` (sessionStorage); el link de retry usa
  `[queryParams]="retryQueryParams()"` en vez del `{ resume: true }` hardcodeado.

## Verificación end-to-end (Playwright, datos reales — no sintéticos)

Flujo completo real: formulario (Ana Torres Rojas, RUT 19.222.333-4) → 12 clases reales →
foto real subida → firma real (PointerEvents en canvas) → **pago real en Transbank sandbox**
→ "Anular compra y volver" (cancelación real) → retorno a `/inscripcion/retorno` con
`TBK_TOKEN` real → link de retry `= /inscripcion?resume=true&branchId=1` → wizard resume
correctamente en el paso "Contrato" con nombre, curso, 12 clases y foto intactos.

**Hallazgo adicional (fuera de alcance, no corregido en este fix):** el draft persistido
(`saveDraft()`) no incluye `contractSignatureBase64` — al reanudar, el alumno debe re-marcar
el checkbox y volver a firmar el contrato (los demás datos sí sobreviven). Confirmado tanto
en código como en vivo. Candidato a un fix propio si se decide corregirlo.

## Test de Regresión
- `src/app/core/facades/public-enrollment.facade.spec.ts > initiatePayment / confirmPayment draft lifecycle (fix-069, H-033) > no borra el draft local al iniciar el pago, aunque la Edge Function responda éxito` ✓
- `src/app/core/facades/public-enrollment.facade.spec.ts > initiatePayment / confirmPayment draft lifecycle (fix-069, H-033) > borra el draft local recién cuando confirmPayment confirma el pago exitosamente` ✓
- `src/app/core/facades/public-enrollment.facade.spec.ts > initiatePayment / confirmPayment draft lifecycle (fix-069, H-033) > NO borra el draft si el banco rechaza el pago (para poder reintentar sin perder el trabajo)` ✓
- Suite completa: `npm run test:ci` → 1521 passed, 0 failed (2026-07-29)
- Verificación visual/E2E real con Playwright (ver sección arriba) ✓
