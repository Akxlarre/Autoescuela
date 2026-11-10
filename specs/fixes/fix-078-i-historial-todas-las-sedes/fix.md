# Fix: Historial de cuadraturas con "Todas las sedes" esconde un cierre cuando las dos sedes cierran el mismo día
> id: fix-078-i-historial-todas-las-sedes
> refs: fix-073-i (caso F16 · sospecha S14; F17 · S13) · ASG-i-029
> status: in_progress
> created: 2026-11-10
> priority: P1

## Root Cause

`historial-cuadraturas-content` arma el calendario con
`new Map(this.cierres().map((c) => [c.fecha, c]))`: una fecha, un cierre. Con "Todas las sedes",
si las dos sedes cerraron el mismo día, el segundo pisa al primero. Confirmado en `fix-073-i`
(2026-11-10): se vio solo el cierre de la sede 2 (cuadrado) y no el de la sede 1 (−$500). El
detalle tampoco dice de qué sede es el cierre, y exportarlo usa la sede del selector, no la del
cierre.

## Pregunta abierta (bloquea solo AC-4)

**S13:** la secretaria solo ve los cierres de los últimos 3 días (policy `select_cash_closings`,
`chile_today() - 2`); en agosto el admin ve 2 cierres de la sede 1 y la secretaria ninguno.
¿Debe ver el historial completo de su sede, y los ajustes? — pendiente de Ignacio.

## ACs Afectados

- AC-1: admin con "Todas las sedes" ve los dos cierres de un mismo día, cada uno con su sede.
- AC-2: el detalle de un cierre dice de qué sede es.
- AC-3: exportar un cierre desde el detalle usa la sede del cierre, no la del selector.
- AC-4 (si Ignacio decide que sí): la secretaria ve todos los cierres de su sede y sus ajustes.

## Cambio

- **Archivos:** `historial-cuadraturas-content.component.ts` (calendario por fecha → lista por
  fecha), `historial-cuadraturas.facade.ts` (exporte con la sede del cierre),
  `detalle-cuadratura-modal` (sede visible). AC-4: migración de la policy.

## Test de Regresión

- Test del `computed` del calendario: dos cierres con la misma fecha y distinta sede → ambos en la celda.
