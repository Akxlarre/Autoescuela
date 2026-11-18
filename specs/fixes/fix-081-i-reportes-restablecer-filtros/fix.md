# Fix: Reportes no tiene cómo volver los filtros a su estado inicial
> id: fix-081-i-reportes-restablecer-filtros
> refs: fix-073-i (caso H22, decisión de Ignacio 2026-11-17)
> status: done
> closed: 2026-11-17
> created: 2026-11-17
> priority: P2

## Root Cause

Los filtros de Reportes (período general y ventana de Evolución) viven en
`ReportesContablesFacade` (singleton) y ya se conservan al salir y volver, que es lo que Ignacio
decidió. Falta lo otro que pidió: un botón para volver al estado inicial sin tener que elegir
"Mes actual" y "Últimos 6 meses" a mano. La sede no se toca: es el selector global del admin.

## ACs Afectados

Ninguno — fix autónomo (decisión H22 de `fix-073-i`):
- AC-1: con un período distinto de "Mes actual" o una ventana de Evolución distinta de la por
  defecto, aparece "Restablecer filtros"; con los valores iniciales no aparece.
- AC-2: el botón vuelve a "Mes actual" y "Últimos 6 meses" y recarga solo lo que cambió.
- AC-3: los filtros se conservan al salir de Reportes y volver (comportamiento actual, verificado).

## Cambio

- `reportes-contables-content.component.ts`: computed `filtrosModificados`, método
  `restablecerFiltros()` (emite por los outputs existentes) y el botón.

## Test de Regresión

- `reportes-contables-content.component.spec.ts` > restablecer filtros (H22)
- Corrida 2026-11-17: 4 tests nuevos, 18/18 ✓. `npm run lint:arch`: 0 errores.

## Verificación (2026-11-17, navegador, admin)

- "Mes actual": sin botón. Elegir "Mes anterior" → aparece "Restablecer filtros". AC-1 ✓
- Salir a Caja Diaria y volver por el menú (sin recargar): sigue "Mes anterior" (01/10–31/10) y el
  botón. AC-3 ✓. Con una recarga completa del navegador vuelve a "Mes actual" (el Facade se
  reinicia): es lo esperado para "mientras dure la sesión" de la app abierta.
- Clic en "Restablecer filtros" → "Mes actual" (01/11–30/11) y el botón desaparece. AC-2 ✓
- 1440 px: el botón queda al lado del selector; angosto: ocupa el ancho bajo el selector.
