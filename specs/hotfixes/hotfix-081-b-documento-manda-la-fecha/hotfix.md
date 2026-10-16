# Hotfix: el estado de un documento de vehículo lo decide su fecha
> id: hotfix-081-b-documento-manda-la-fecha
> refs: ASG-i-032 (checklist 032, I07; decisión del owner 2026-10-16)
> status: closed
> created: 2026-10-16

## Problema
`resolveDocStatus` devolvía "vencido" si `vehicle_documents.status = 'expired'`, aunque la fecha
de vencimiento fuera futura (p. ej. un documento renovado cuyo estado guardado quedó viejo). El
dashboard, en cambio, cuenta por fecha. Decisión: manda la fecha.

## Cambios
- **Archivo:** `src/app/core/utils/vehicle-document-status.utils.ts` (+ spec) — con fecha, el estado
  sale de la fecha; el estado guardado solo cuenta cuando no hay fecha.

## Verificación
- [x] vitest del util y de los facades que lo usan (Flota, Agenda).
