# Fix: Separador del paginador de Auditoría se ve doble/distinto vs Base Alumnos B
> id: fix-095-m-auditoria-paginador-doble-borde
> refs: fix-093-m-auditoria-unificar-card-paginacion, fix-094-m-auditoria-paginador-borde-separador
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
En fix-094 se igualó el token de color del borde (`border-border-subtle`), pero el owner
sigue viendo una barra distinta a la de Base Alumnos B. La causa real es que hay **dos
bordes apilados**: el `border-bottom` de la última fila (`.audit-row-border`, ya presente
en cada fila) MÁS el `border-t` que se agregó al wrapper del `<p-paginator>`. Entre dos
filas cualesquiera solo hay UNA línea (el bottom-border de la fila superior); antes del
paginador había DOS líneas adyacentes, lo que se percibe como una barra más gruesa/distinta
aunque use el mismo color. `<p-paginator>` standalone de PrimeNG no trae borde propio
(confirmado: no hay regla `border` en `@primeng/themes/aura/paginator`), así que en Base
Alumnos B (que usa `p-table [paginator]="true"`, sin wrapper propio) la única línea visible
antes de la paginación es, igual que aquí, la de la última fila — por eso ese wrapper extra
sobra.

## ACs Afectados
Ninguno — fix autónomo de consistencia visual (feedback directo del owner sobre fix-093/094).

## Cambio
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts`
- **Qué cambia:** Se elimina la clase `border-t border-border-subtle` del `<div>` que envuelve
  `<p-paginator>`. La línea separadora la sigue aportando `.audit-row-border` de la última fila,
  igual que entre cualquier par de filas — sin borde duplicado.

## Test de Regresión
- Verificación visual manual (por el owner): la línea sobre el paginador de Auditoría debe
  ser una sola línea, indistinguible de las líneas entre filas, igual que en Base Alumnos B.
