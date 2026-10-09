# Fix: un comunicado programado a más de 200 alumnos nunca termina
> id: fix-361-m-comunicados-de-mas-de-200-no-terminan
> refs: ASG-i-057 · 0041-b · 0042-b · 0043-b
> status: done
> closed: 2026-10-08
> created: 2026-10-08

## Root Cause
[Heredado de ASG-i-057, confirmado leyendo el código el 2026-10-08]: el cron
`dispatch-scheduled-announcements` procesa como máximo 8 lotes de 25 (200) por corrida y
**siempre empieza con `offset = 0`**. Los ya enviados se saltan pero igual consumen lote. Si no
termina, queda en `enviando`; el rescate de huérfanos lo vuelve a `programado` a los 30 min y la
corrida siguiente recorre otra vez los mismos 200: del 201 en adelante nunca reciben
(`index.ts:159-181`).

Encontrado al confirmar:
- `email_ok_count`/`email_failed_count` se graban con lo contado en la última corrida, no el total.
- Cada reinicio desde 0 re-materializa el segmento (no duplica por el upsert, pero puede sumar
  destinatarios nuevos a mitad del envío).

Relacionados (🟠, mismo track):
- El envío inmediato lo hace el navegador por lotes y la fila queda `enviado` al crearse: si se
  cierra la pestaña queda a medias (`announcements.facade.ts:299-310,380`).
- Los comunicados llegan a alumnos archivados (`_shared/announcement-send.ts:144-164`).
- Nota de la ASG: el email no debe llevar links al portal (hoy no lleva ninguno — verificar).

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **Migración** `20261008120000_fix361_announcements_dispatch_heartbeat.sql`: columna
  `announcements.dispatch_heartbeat_at` (último lote avanzado). La aplica Matías.
- `_shared/announcement-progress.ts` (nuevo, puro): `isRecipientPending`, `summarizeRecipients`,
  `isDispatchOrphaned` (huérfano = sin lote en 30 min; sin latido cae a `scheduled_for`/`created_at`)
  y `releasedHeartbeat`.
- `_shared/announcement-send.ts`: `sendPendingBatch` (pide los que faltan, no una posición),
  `ensureRecipients` (materializa solo si no hay filas), `touchDispatchHeartbeat` en cada lote,
  `finalizeAnnouncement` (cierra con los conteos de `announcement_recipients`; si quedan pendientes
  no cierra). La materialización excluye `students.status = 'archived'`.
- `dispatch-scheduled-announcements`: rescate por latido (cubre también inmediatos), toma
  `programado` con `scheduled_for` NULL (inmediato rescatado), usa `sendPendingBatch` y
  `finalizeAnnouncement`; si la corrida no termina, suelta el latido para que la siguiente (15 min)
  lo retome sin esperar 30.
- `send-announcement`: acción `finalize: true`.
- `announcements.facade.ts`: el inmediato nace `enviando` con latido; al terminar pide `finalize` al
  servidor (no escribe conteos); si quedan pendientes avisa con un toast de advertencia. El preview
  de destinatarios también excluye archivados.
- Decisión: el envío inmediato sigue avanzándolo el navegador (necesita la barra de progreso y una
  Edge Function no alcanza a enviar cientos de correos en una llamada); el servidor lo termina si la
  pestaña se cierra o un lote falla.
- El correo del comunicado no lleva links al portal (verificado en `buildEmailHtml`).

## Test de Regresión
- Deno: `supabase/functions/_shared/announcement-progress.test.ts` (9 casos: resumen del comunicado
  entero con 250 destinatarios, pendientes, huérfano por latido, soltado por el cron).
- Vitest: `announcements.facade.spec.ts` (44): inmediato nace `enviando` con latido, cierre por el
  servidor, aviso si quedan pendientes, segmento vacío se cierra, preview sin archivados.
- Después de aplicar la migración y desplegar: probar el dispatcher con `dryRun: true` sobre un
  comunicado a >200 alumnos y confirmar que termina en dos corridas.

## Progreso
- [x] Bug confirmado leyendo el código.
- [x] Paginación por pendientes + conteos totales.
- [x] Excluir archivados.
- [x] Envío inmediato recuperable por el servidor.
- [x] Test de regresión (Deno 9/9, Vitest 44/44, `tsc` y `deno check` sin errores).
- [x] Matías aplicó la migración y desplegó `send-announcement` + `dispatch-scheduled-announcements`
  (2026-10-08).
- [x] Prueba con `dryRun` contra la BD de desarrollo (comunicado 29, 212 destinatarios): 1ª corrida
  `enviando` con 200 procesados / 12 pendientes y latido soltado; 2ª corrida `enviado`, 0
  pendientes, `email_ok_count` 212 = `recipients_total`. Comunicado de prueba borrado después.
