# Hotfix: eliminar botón "Exportar Archivo" muerto en Ex-Alumnos B

## Problema
Confirmado: el botón "Exportar Archivo" del hero en Ex-Alumnos B (admin y secretaria)
no hace nada funcional. `handleHeroAction()` solo ejecuta `console.log(...)` para
`actionId === 'exportar'`, sin llamar a ningún facade/servicio de exportación.

- `admin-ex-alumnos.component.ts:340-344` (acción) y `:426-430` (handler)
- `secretaria-ex-alumnos.component.ts:346` (acción) y `:443-448` (handler)

## Fix
Eliminar la acción `exportar` de `heroActions` y el método `handleHeroAction()`
(y su binding `(actionClick)`) en ambos componentes, ya que tras remover la única
acción sin `route` que dependía de él, queda sin uso.

## AC
- El botón "Exportar Archivo" ya no aparece en Ex-Alumnos B (admin ni secretaria).
- "Ver Alumnos Activos" (con `route`) sigue funcionando igual.

## Cierre
- Eliminada la acción `exportar` de `heroActions` y el handler `handleHeroAction()` (junto con el binding `(actionClick)`) en `admin-ex-alumnos.component.ts` y `secretaria-ex-alumnos.component.ts`.
- "Ver Alumnos Activos" queda como única acción del hero, sin cambios (usa `route`, no depende del handler eliminado).
- `tsc --noEmit` limpio.
