# fix-225-b — El aviso de vencimiento se duplica si la función corre dos veces el mismo día

- **Autor:** b
- **Origen:** ASG-i-032 (checklist 032, J08) + decisión del owner (2026-10-16): evitar el duplicado.
- **Estado:** cerrado (2026-10-16)

## Bug

`notify_vehicle_document_expiry()` no recuerda qué avisó: si corre dos veces el mismo día (un
reintento del cron, o alguien que la ejecuta a mano para probar), cada destinatario recibe el
mismo aviso dos veces.

## Criterios

- **D1** — Una segunda corrida el mismo día (Chile) no inserta avisos que ese destinatario ya
  recibió hoy para el mismo vehículo con el mismo texto.
- **D2** — Un aviso distinto (otro documento, otro vehículo, otro destinatario) sí se inserta.
- **D3** — Al día siguiente vuelve a avisar normalmente (el "por vencer" a N días es otro texto;
  el "vence hoy" es de otro día).
- **D4** — N1–N5 de fix-223-b siguen igual.

## Cambio

Migración `20261016120000_fix225_aviso_vencimiento_sin_duplicados.sql`: `CREATE OR REPLACE` de
`notify_vehicle_document_expiry()` (copia de la de fix-223-b) con un `NOT EXISTS` por
destinatario + `reference_type` + `reference_id` + mensaje + `created_at >= chile_day_start(hoy)`.

Test: `supabase/tests/flota/fix-225-b-aviso-sin-duplicados.sql` (sub-bloque que aborta).

## Verificación

- [x] Test en BEGIN…ROLLBACK con la migración, y el de fix-223-b sigue en verde.
- [x] Migración aplicada en producción (requiere aprobación del owner) + tests en verde.
