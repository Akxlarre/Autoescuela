# Fix: Historial de cuadraturas con "Todas las sedes" esconde un cierre cuando las dos sedes cierran el mismo día
> id: fix-078-i-historial-todas-las-sedes
> refs: fix-073-i (caso F16 · sospecha S14; F17 · S13) · ASG-i-029
> status: done
> closed: 2026-11-16
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

- `src/app/core/utils/historial-cuadraturas.utils.spec.ts` (`groupCierresByFecha`, la agrupación
  que usa el `computed` del calendario): dos cierres con la misma fecha y distinta sede → ambos en
  la fecha, ordenados por sede ✓.
- `src/app/core/facades/historial-cuadraturas.facade.spec.ts`: `sedeNombre` desde el join,
  `exportarCierre()` con la sede del cierre ("Todas" = null → `branch_id: 1`), `mostrarSede` ✓.
- Corrida 2026-11-15: 2 archivos, 27/27 ✓. `npm run lint:arch`: 0 errores.

## Verificación (2026-11-15, navegador, admin con "Todas las sedes", noviembre 2026)

- 10-11: "Autoescuela Chillán − $500" y "Conductores Chillán Cuadrado" en la misma celda (antes
  solo el segundo). 12-11: los dos "Sin arqueo". AC-1 ✓
- Clic en el de la sede 1 → el detalle dice "10/11/2026 · Autoescuela Chillán". AC-2 ✓
- AC-3 cubierto por el test del Facade. Consola sin errores.

## Progreso

- [x] AC-1, AC-2, AC-3 (código + tests + navegador)
- [x] AC-4: Ignacio decidió (2026-11-15) que la secretaria ve el historial de **su** sede.
  Migración `supabase/migrations/20261116120000_fix078i_secretaria_historial_cuadraturas.sql`
  (`select_cash_closings` sin la ventana de 3 días; `select_cuadratura_adjustments` con los
  ajustes de cierres de su sede), aplicada por Ignacio el 2026-11-16. Verificado con las
  policies en `pg_policies` y logueando con supabase-js: `secretaria@test.com` ve 10 cierres
  (sede 1, desde marzo; 2 de agosto, antes 0) y 3 ajustes; `secretaria2@test.com` ve 12 (sede 2)
  y 1 ajuste. Ninguna ve cierres de la otra sede. Las dos ven 4 cierres de abril con
  `branch_id` NULL: `branch_visible(NULL)` es true por diseño (datos anteriores a multi-sede);
  no lo cambia este fix.
