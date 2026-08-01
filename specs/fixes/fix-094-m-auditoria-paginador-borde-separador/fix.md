# Fix: Borde separador del paginador de Auditoría no coincide con el de Base Alumnos B
> id: fix-094-m-auditoria-paginador-borde-separador
> refs: fix-093-m-auditoria-unificar-card-paginacion
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
En fix-093 el wrapper de `<p-paginator>` en `AdminAuditoriaComponent` quedó con
`border-t border-border-default`, mientras que las filas de la tabla usan
`.audit-row-border` (`border-bottom: 1px solid var(--border-subtle)`). Son dos tokens
distintos (`--border-default` vs `--border-subtle`), por lo que la línea separadora antes
del paginador se ve visualmente distinta a las líneas entre filas — el owner lo detectó
comparando con Base Alumnos B, donde la línea sobre el paginador es la misma que separa
cada alumno.

## ACs Afectados
Ninguno — fix autónomo de consistencia visual (feedback directo del owner sobre fix-093).

## Cambio
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts`
- **Qué cambia:** El wrapper del `<p-paginator>` pasa de `border-t border-border-default`
  a `border-t border-border-subtle`, para usar el mismo token que `.audit-row-border`
  (línea separadora entre filas de la tabla).

## Test de Regresión
- Verificación visual manual (por el owner, ya que Playwright MCP no está disponible en
  esta sesión): la línea sobre el paginador de Auditoría debe verse igual a las líneas
  entre filas de la tabla, igual que en Base Alumnos B.
