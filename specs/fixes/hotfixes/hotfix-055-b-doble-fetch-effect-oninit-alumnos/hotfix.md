# Hotfix: Doble fetch en Base de Alumnos y Pre-inscritos: effect() + ngOnInit() ambos llaman facade.initialize()
> id: hotfix-055-b-doble-fetch-effect-oninit-alumnos
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Problema

En `AdminAlumnosComponent` y `AdminPreInscritosComponent`, el `effect()` del constructor (que
sigue el patrón obligatorio de `facades.md` para recargar al cambiar de sede) y `ngOnInit()`
llaman **ambos** a `facade.initialize()`. Como el flag `_initialized` del Facade solo se marca
`true` después de que el primer `await fetchXxxData()` resuelve, las dos llamadas se disparan
antes de que ninguna termine y ambas ven `_initialized === false` — la query completa (con sus
joins) sale duplicada por la red en cada carga de página. Confirmado empíricamente con la
Resource Timing API del navegador: `/rest/v1/students` aparece dos veces, 28ms de diferencia,
contra producción.

## Cambios

- **Archivo:** `src/app/features/admin/alumnos/admin-alumnos.component.ts` — quitar la llamada a
  `this.facade.initialize()` de `ngOnInit()` (línea 76); el `effect()` del constructor ya cubre
  la carga inicial (se ejecuta una vez al crear el componente, antes de que exista sede
  seleccionada previa que trackear). `ngOnInit()` conserva el registro de
  `destroyRef.onDestroy(...)`.
- **Archivo:** `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscritos.component.ts` —
  mismo cambio: quitar `void this.facade.initialize()` de `ngOnInit()` (línea 93), conservando
  `this.branchFacade.setProfessionalOnly(true)`.
