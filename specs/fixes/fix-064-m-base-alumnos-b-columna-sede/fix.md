# Fix: Base de Alumnos B (admin): falta columna "Sede" cuando se ven todas las sedes + el nombre de sede es un placeholder
> id: fix-064-m-base-alumnos-b-columna-sede
> refs: —
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Root Cause
Dos problemas relacionados en la Base de Alumnos B (`/app/admin/alumnos`):

1. `AlumnosListContentComponent` (tabla compartida admin/secretaría) nunca renderiza una columna de sede — cuando el admin tiene "Todas las sedes" seleccionado en el topbar (`BranchFacade.selectedBranchId() === null`), la tabla mezcla alumnos de todas las sedes sin forma de distinguir a cuál pertenece cada uno.
2. El campo `sucursal` de `AlumnoTableRow` (que sí existe en el modelo) se llena en `admin-alumnos.facade.ts:444` con un placeholder (`` `Sucursal ${branch_id}` ``) en vez del nombre real — la query no hace join a `branches`. Aunque se agregue la columna, hoy mostraría "Sucursal 2" en vez de "Conductores Chillán".

## ACs Afectados
- Ninguno — fix autónomo (reportado por el dueño).

## Cambio
- `admin-alumnos.facade.ts` — `RawUser`/query: agregar join `branches(name)` (mismo patrón que `admin-pre-inscritos.facade.ts:455/697`). `mapToAlumnoTableRow()`: `sucursal: u.branches?.name ?? '—'`.
- `alumnos-list-content.component.ts` (shared, dumb) — nuevo input `showSedeColumn = input(false)`. Agregar `<th>` / `<td>` de "Sede" condicionados a ese input (vista desktop `p-table`), ajustar `colspan` del empty-state.
- `admin-alumnos.component.ts` (smart, admin) — pasar `[showSedeColumn]="branchFacade.selectedBranchId() === null"`.
- `secretaria-alumnos.component.ts` — sin cambios (no pasa el input, default `false` — la secretaria está anclada a una sola sede, no necesita la columna).

## Test de Regresión
- `admin-alumnos.facade.spec.ts`:
  - "sucursal (fix-064) mapea desde users.branches.name, no desde branch_id" ✓
  - "sucursal (fix-064) cae a '—' si no hay branches asociado" ✓

13/13 tests verdes en `admin-alumnos.facade.spec.ts`. `tsc --noEmit` sin errores. `alumnos-list-content.component.ts` no tiene `.spec.ts` propio (precedente ya existente en el archivo, cambio de template puramente condicional sobre un input booleano).
