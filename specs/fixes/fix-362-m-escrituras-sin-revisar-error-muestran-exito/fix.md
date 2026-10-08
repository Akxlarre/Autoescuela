# Fix: escrituras a Supabase que no revisan el error y muestran éxito igual
> id: fix-362-m-escrituras-sin-revisar-error-muestran-exito
> refs: ASG-i-055
> status: in_progress
> created: 2026-10-08

## Root Cause
[Heredado de ASG-i-055, a confirmar]: supabase-js no lanza excepción cuando una escritura falla:
devuelve `{ error }`. En ~13 grupos de llamadas ese `error` no se revisa y la UI muestra un toast
de éxito aunque la RLS o la red lo hayan rechazado. Ejemplos: KM del vehículo al cerrar una clase
con un vehículo de otra sede (`asistencia-clase-b.facade.ts:449-455`), cancelar un comunicado que
no se canceló (`announcements.facade.ts:479-491`).

Inventario: `specs/testing-piloto/037-transversal-multisede-shell.md` §1.7. Los números de línea
son del 2026-09-29 y hay ~100 fixes posteriores: se re-verifica cada ocurrencia contra el código
actual antes de tocarla.

Fuera de alcance:
- Cuadratura (`cuadratura.facade.ts`) → `ASG-i-048`, sigue pendiente.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
<!-- Se completa al implementar. -->

## Test de Regresión
<!-- Se completa al implementar. -->
