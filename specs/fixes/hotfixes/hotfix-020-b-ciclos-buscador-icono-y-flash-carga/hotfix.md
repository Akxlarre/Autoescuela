# Hotfix: Ciclos Teóricos — ícono de búsqueda pegado + flash de empty state al abrir
> id: hotfix-020-b-ciclos-buscador-icono-y-flash-carga
> status: done
> closed: 2026-07-17
> created: 2026-07-17

## Problema
QA visual sobre el trabajo de fix-051/052 (aún sin commitear), 2 issues en
`ciclos-teoricos-content.component.ts`:
1. El ícono de búsqueda queda pegado al texto en ambos inputs (roster y modal
   "Incorporar"). Causa: la clase `.field-input` se define en los `styles` propios
   del componente (boost de especificidad por ViewEncapsulation) con `padding: 8px
   12px` shorthand, que le gana al utility Tailwind `pl-8` aplicado en el mismo
   elemento — el padding-left real queda en 12px, no en los 32px que pide `pl-8`.
2. Al abrir el modal "Incorporar alumno" por primera vez, `addableStudents()`
   arranca vacío (aún no resolvió `requestAddable.emit()` → `loadAddableStudents()`
   del Facade), así que se muestra el empty state "No hay alumnos..." un instante,
   y al llegar los datos el modal se redimensiona de golpe. Falta un estado de
   carga explícito mientras se resuelve el fetch.

## Cambios
- **Archivo:** `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`
  - Agregar una clase scoped `.field-input--icon { padding-left: 2.25rem; }` en el
    mismo bloque `styles` (misma especificidad, declarada después de `.field-input`
    → gana en cascada), y usarla en vez de `pl-8` en ambos inputs de búsqueda.
  - Exponer `isLoadingAddable` como `input(false)` en el componente y mostrarlo
    (skeleton) en el body del modal mientras es `true`, en vez de evaluar
    `addableStudents().length === 0` de entrada.
- **Archivo:** `src/app/core/facades/ciclos-teoricos.facade.ts`
  - Agregar signal privado `_isLoadingAddable` + getter público `isLoadingAddable`,
    set a `true` al inicio de `loadAddableStudents()` y `false` en el `finally`.
- **Archivo(s) Smart consumidores** (donde se use `<app-ciclos-teoricos-content>`):
  bindear `[isLoadingAddable]="facade.isLoadingAddable()"`.
