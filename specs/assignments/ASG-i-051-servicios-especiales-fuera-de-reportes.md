# Asignación ASG-i-051 — Ventas de servicios especiales fuera de Reportes y Dashboard; efectivo registrado como tarjeta

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29).

1. Reportes Contables, el reporte financiero PDF y el KPI de ingresos del Dashboard leen solo
   `payments` (+ cursos singulares); `special_service_sales` nunca se consulta. Solo la Caja
   Diaria suma las ventas → Caja y Reportes no cuadran por el monto de los servicios vendidos
   (`reportes-contables.facade.ts:348-353`).
2. En la Caja, el monto de la venta se suma como tarjeta aunque se haya pagado en efectivo →
   descuadra el arqueo físico (`cuadratura.facade.ts:114,789`).
3. (🟠) La venta se guarda con fecha UTC: después de ~21:00 cae al día siguiente y no sale en la
   Caja de hoy (`registrar-venta-drawer.component.ts:249`).

## Alcance sugerido

- **Paso 1, confirmar**: registrar una venta de prueba en efectivo y comparar Caja, Reportes y
  Dashboard del mismo período.
- Sumar `special_service_sales` en Reportes, en la edge function del reporte financiero y en el
  KPI del Dashboard (y en el dashboard ejecutivo si aplica).
- Respetar el medio de pago de la venta en la Caja.
- (3) se puede resolver aquí o en `ASG-i-054` (fechas UTC).

## Referencias

- `specs/testing-piloto/031-servicios-especiales.md` S2 y 🟠 relacionadas · `029-contabilidad.md`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/reportes-contables.facade.ts`, `cuadratura.facade.ts`, `dashboard*.facade.ts`
- Edge function del reporte financiero

## Notas para quien la reclame

- Solapa con `ASG-i-048` (mismo `cuadratura.facade.ts`).
