# Fix: Unificar card de filtros/tabla en Log de Auditoría y usar paginador PrimeNG consistente
> id: fix-093-m-auditoria-unificar-card-paginacion
> refs: —
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
`AdminAuditoriaComponent` (Log de Auditoría) renderiza los filtros y la tabla como dos
`.bento-banner card` separadas, inconsistente con el patrón del resto de la app (ej.
`alumnos-list-content.component.ts` / "Base Alumnos B", `pre-inscritos-content.component.ts`),
donde toolbar de filtros + tabla viven en una sola card. Además, la paginación de auditoría
es un componente hand-rolled (`.page-btn`, `visiblePages()`) en vez de reusar `<p-paginator>`
de PrimeNG, que es el paginador canónico ya usado en Base Alumnos B y Pre-inscritos.

## ACs Afectados
Ninguno — fix autónomo de consistencia visual, no corrige un AC de spec previa.

## Cambio
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts`
- **Qué cambia:** Fusiona la card de filtros y la card de tabla en una sola `.bento-banner card
  card-accent`; reemplaza la paginación custom (`visiblePages()`, `goToPage()`, `.page-btn`) por
  `<p-paginator>` de PrimeNG (`PaginatorModule`), con el mismo `currentPageReportTemplate` que
  usa Base Alumnos B.

## Test de Regresión
- Verificación visual manual (`/verify`): una sola card contiene filtros + tabla + paginador;
  el paginador usa los mismos íconos/botones que Base Alumnos B.
- **Nota:** Playwright MCP no estaba disponible en esta sesión → NO se ejecutó `/verify` en
  navegador real. Se validó `npm run lint:arch` (exit 0, sin hallazgos nuevos) y `tsc --noEmit`
  (sin errores). **Pendiente: verificación visual real por el usuario antes de dar por bueno.**
