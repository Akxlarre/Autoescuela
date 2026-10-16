# fix-223-b — Notificación de vencimiento de documentos de vehículo

- **Autor:** b
- **Origen:** ASG-i-032 (testing Flota), sospecha S9 + decisión 4 del owner (2026-10-12).
- **Estado:** abierto

## Bug

`notify_vehicle_document_expiry()` (cron diario 06:00 UTC):

1. Arma el mensaje con el valor crudo de `vehicle_documents.type`: llega "soap del vehículo
   ZZ4103…" o "technical_inspection del vehículo…" en vez de "SOAP" / "Revisión Técnica".
2. El día del vencimiento dice "Documento vencido — … venció hoy.". Decisión 4: un documento que
   vence hoy **sigue vigente hoy** (vence desde mañana), igual que lo muestra la app
   (`resolveDocStatus`). El aviso debe decir "vence hoy".
3. Solo avisa al instructor asignado y a los admins. Desde spec 0051-b la secretaria gestiona la
   flota de su sede y no se entera.

## Criterios (ACs afectados)

- **N1** — El mensaje usa la etiqueta en español del tipo (SOAP, Revisión Técnica, Permiso de
  Circulación, Seguro), la misma de `VEHICLE_DOC_TYPES`. Un tipo desconocido se muestra tal cual.
- **N2** — Documento que vence hoy → asunto "Documento vence hoy", mensaje
  "<Tipo> del vehículo <PATENTE> vence hoy.".
- **N3** — Documento que vence en `advance_days` → asunto "Documento por vencer", mensaje
  "<Tipo> del vehículo <PATENTE> vence en N días." (sin cambios de lógica).
- **N4** — Destinatarios: instructor con asignación activa + admins activos (como antes) + las
  secretarias activas de la sede del vehículo; si el vehículo es "Ambas", las secretarias activas
  de todas las sedes. Sin duplicados.
- **N5** — Documentos que no vencen hoy ni en `advance_days` no generan nada.

## Cambio

Migración `20261013130000_fix223_notificacion_vencimiento_documento.sql`:
`vehicle_document_type_label(text)` (IMMUTABLE) + `CREATE OR REPLACE` de
`notify_vehicle_document_expiry()` (copia de la vigente en producción + N1–N4).

Test: `supabase/tests/flota/fix-223-b-notificacion-vencimiento.sql` (sub-bloque que aborta, sin
efectos).

## Verificación

- [ ] Test en BEGIN…ROLLBACK con la migración antes de aplicar.
- [ ] Migración aplicada en producción (requiere aprobación del owner) + test en verde.
