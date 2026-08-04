# Fix: Columna "Sede" en Log de Auditoría
> id: fix-096-m-auditoria-columna-sede
> refs: —
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
La vista de auditoría admin (`AdminAuditoriaComponent`) no muestra a qué sede pertenece la
secretaria que generó cada registro del log. Un admin con acceso a ambas sedes no puede
distinguir el origen de cada acción sin cruzar manualmente contra `branch_id`.

## ACs Afectados
Ninguno — fix autónomo (mejora solicitada directamente por el dueño).
- AC-1: Cada fila del log de auditoría muestra el nombre de la sede de la secretaria autora.
- AC-2: La columna "Sede" solo se muestra cuando el admin tiene seleccionado "Todas las
  sedes" en el topbar. Si el admin filtró a una sede específica, la columna se oculta
  (es redundante — todas las filas serían la misma sede).

## Cambio
- **Archivo:** `src/app/core/models/ui/audit-log-row.model.ts` — agrega campo `sedeNombre`.
- **Archivo:** `src/app/core/facades/auditoria.facade.ts` — incluye `branches(name)` en el join
  de `users` y lo mapea a `sedeNombre` en `mapToRow`.
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts` — agrega columna
  "Sede" a la tabla (header, skeleton y fila de datos), condicionada al computed
  `showSedeColumn` (`branchFacade.selectedBranchId() === null`).

## Test de Regresión
- Verificación manual del owner (confirmada en sesión, 2026-08-01): la columna "Sede"
  se ve correctamente con "Todas las sedes" seleccionadas en el topbar.
- Verificación de tipos: `npx tsc -p tsconfig.app.json --noEmit` sin errores en los
  archivos tocados.
- `npx vitest run src/app/core/facades/auditoria.facade.spec.ts` → 4/4 tests verdes.
- Verificación manual del owner (confirmada en sesión, 2026-08-01): al filtrar a una
  sede específica en el topbar, la columna "Sede" se oculta correctamente.
