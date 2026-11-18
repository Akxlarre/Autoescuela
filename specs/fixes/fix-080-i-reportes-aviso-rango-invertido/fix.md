# Fix: Reportes con rango personalizado "Desde" > "Hasta" no avisa nada
> id: fix-080-i-reportes-aviso-rango-invertido
> refs: fix-073-i (caso H04, decisión de Ignacio 2026-11-17)
> status: done
> closed: 2026-11-17
> created: 2026-11-17
> priority: P2

## Root Cause

`onCustomDateChange()` de `reportes-contables-content` solo emite los filtros si
`desde <= hasta`; en el caso contrario no hace nada y no muestra nada: el reporte se queda con el
rango anterior sin que el usuario sepa por qué.

## ACs Afectados

Ninguno — fix autónomo (decisión H04 de `fix-073-i`):
- AC-1: con "Personalizado" y Desde posterior a Hasta, bajo las fechas aparece "La fecha Desde no
  puede ser posterior a Hasta" y no se recarga el reporte.
- AC-2: al corregir las fechas el aviso desaparece y el reporte se recarga.

## Cambio

- `reportes-contables-content.component.ts`: computed `rangoInvertido` + mensaje bajo las fechas.

## Test de Regresión

- `reportes-contables-content.component.spec.ts` > rango invertido (H04)
- Corrida 2026-11-17: 3 tests nuevos, 14/14 ✓.

## Verificación (2026-11-17, navegador, admin, "Todas las sedes")

- Personalizado, Desde 30/11/2026 y Hasta 01/11/2026 (elegidas en el calendario): aparece "La
  fecha Desde no puede ser posterior a Hasta." en rojo bajo las fechas y el reporte se queda con el
  último rango válido (30/11–30/11). AC-1 ✓. AC-2 cubierto por test.
