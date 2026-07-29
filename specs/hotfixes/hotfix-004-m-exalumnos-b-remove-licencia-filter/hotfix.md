# hotfix-004-m — Eliminar filtro de licencia en Ex-Alumnos B

## Problema
En la vista "Ex-Alumnos B" (Registro Histórico), existe un selector de
"Licencia" para filtrar la lista. Es redundante: la lista siempre muestra
`egresadosClaseBList()`, es decir, únicamente egresados de Clase B. El filtro
no tiene efecto útil real (la fuente de datos ya está pre-filtrada) y confunde
al usuario.

## Cambio
`admin-ex-alumnos.component.ts`:
- Eliminar el `p-select` de licencia del header de "Registro Histórico".
- Eliminar `filtroLicencia` (signal), `licenciaSelectOptions` (computed),
  `availableLicencias` (computed) y su uso en `filteredEgresados()` /
  `clearFilters()`.
- De paso, agregar `appendTo="body"` al `p-select` de año restante (mismo
  patrón de fix de overlays clippeados aplicado en otras vistas del proyecto).

## Acceptance Criteria
- [x] La vista Ex-Alumnos B ya no muestra el selector de "Licencia".
- [x] No quedan referencias muertas a `filtroLicencia`/`licenciaSelectOptions`/`availableLicencias`.
- [x] El filtro por año sigue funcionando y su overlay no se recorta.
