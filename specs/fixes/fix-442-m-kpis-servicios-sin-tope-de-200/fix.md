# Fix: Los KPIs de Servicios especiales se congelan pasada la venta 200
> id: fix-442-m-kpis-servicios-sin-tope-de-200
> refs: fix-429-m-testing-servicios-especiales (S7, casos B07, I09)
> status: in_progress
> created: 2026-10-15

## Root Cause

`ServiciosEspecialesFacade.kpis` se calcula en el navegador sobre la lista de ventas, y esa lista
se pide con `.limit(200)`. Pasada la venta 200 de una sede, "Ventas Totales" y "Recaudación Total"
dejan de subir sin ningún aviso, y el Historial no muestra (ni deja exportar) nada más viejo.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: los 4 KPIs (y "N cobradas") salen de la BD sobre todas las ventas de la sede visible, sin
  tope; respetan la RLS de quien consulta.
- AC-2: "del mes" es el mes en hora de Chile (`chile_today()`).
- AC-3: el Historial carga hasta 1000 ventas (el tope por consulta de PostgREST); si llega al tope,
  avisa que muestra solo las 1000 más recientes.
- AC-4: si la consulta de KPIs falla, la carga muestra el aviso de error (`fix-435-m`), no ceros.

## Cambio

- `supabase/migrations/20261015170000_fix442_servicios_especiales_kpis.sql` — función
  `servicios_especiales_kpis(p_branch_id)` (`SECURITY INVOKER`).
- `core/facades/servicios-especiales.facade.ts` — KPIs desde la función; lista con tope 1000;
  `historialTruncado`.
- `historial-ventas-drawer` — aviso cuando la lista llegó al tope.

## Test de Regresión

- `servicios-especiales.facade.spec.ts > KPIs — calculados en la BD, sin el tope de la lista (fix-442-m)`.
- `supabase/tests/servicios/fix-442-m-servicios-especiales-kpis.sql` (transacción revertida).
- Migración pendiente de aplicar (la aplica Matías).
