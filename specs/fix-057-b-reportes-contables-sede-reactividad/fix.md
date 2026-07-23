# Fix: Reportes Contables no refresca al cambiar de sede
> id: fix-057-b-reportes-contables-sede-reactividad
> refs: ASG-009 (hallazgo colateral encontrado al verificar fix-056 con Playwright)
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
`admin-contabilidad-reportes.component.ts` y `secretaria-contabilidad-reportes.component.ts`
(Smart Components de Reportes Contables) llaman `facade.initialize()` **una sola vez** en
`ngOnInit()`, sin ningún `effect()` que trackee `BranchFacade.selectedBranchId()`. Al cambiar
de sede desde el selector (`app-branch-selector`, visible para admin y para secretaria con
grant `canAccessBothBranches` — `topbar.component.ts:247-253`), el signal de sede cambia pero
la página nunca vuelve a pedir datos: se queda con los números de la sede/alcance con que cargó
por primera vez. Confirmado en vivo con Playwright: tras cambiar de "Todas las sedes" a
"Conductores Chillán", el reporte seguía mostrando "Ambas escuelas" y el ingreso de la otra sede.

Todas las demás páginas de Finanzas ya tienen el patrón correcto (`facades.md` sección 7):
`admin-contabilidad-cuadratura.component.ts:47-52` y `admin-pagos.component.ts:902-903` sí
usan `effect(() => { branchFacade.selectedBranchId(); facade.initialize(); })`. Reportes
Contables es la única página de este grupo que no lo implementó.

## ACs Afectados
Ninguno — fix autónomo (bug real de reactividad, hallado durante verificación visual de
fix-056, no capturado como hallazgo propio en `indices/FLOWS-QA-AUDIT.md`).

## Cambio
- **Archivo 1:** `src/app/features/admin/contabilidad-reportes/admin-contabilidad-reportes.component.ts`
  — inyectar `BranchFacade` y agregar el mismo `effect()` de `admin-contabilidad-cuadratura.component.ts`.
- **Archivo 2:** `src/app/features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component.ts`
  — idéntico, porque una secretaria con grant `canAccessBothBranches` también ve y usa el
  selector de sede (`topbar.component.ts:253`).
- `ReportesContablesFacade.initialize()` ya tiene guard SWR (`_initialized`) y no requiere
  cambios: la primera llamada carga con skeleton, las siguientes (incl. por cambio de sede)
  refrescan en silencio vía `fetchReporte()`.

## Nota de coordinación
`ASG-028` (asignada a Ignacio, sin reclamar) declara
`secretaria-contabilidad-reportes.component.ts` como archivo involucrado para H-014 (texto
"solo visible para admin" mal mostrado a secretaría) — cambio de texto/RBAC, no relacionado
con este `effect()`. Sin solape de líneas esperado, pero queda documentado por si coincide
en el tiempo.

## Test de Regresión
- Verificación visual con Playwright (no hay specs de componentes Smart en este proyecto —
  ver memoria `project_no_angular_component_tests`), confirmada en las 3 combinaciones:
  - "Todas las sedes" → `Clase B (A. Chillán)`, $180.000
  - "Conductores Chillán" (sede sin el pago) → $0, 0 operaciones, sin categorías
  - "Autoescuela Chillán" (sede con el pago) → $180.000, `Clase B`
  - Antes del fix, las 3 quedaban pegadas en "Ambas escuelas" / $180.000 sin importar la
    sede elegida.
- Consola sin errores/warnings en las 3 vistas.
- `npm run test:ci` → 1414/1414 verde. `npm run lint:arch` → exit 0 (0 errores nuevos).
