# hotfix-005-m — Polish filtros Ex-Alumnos B

## Problema
En el header de "Registro Histórico" (Ex-Alumnos B):
1. El selector de año (`w-32`) es muy angosto: solo se alcanza a leer "Todos los"
   en vez de "Todos los años".
2. El botón de icono "Limpiar Filtros" no tiene `cursor: pointer`, por lo que
   no da feedback visual de que es clickeable.

## Cambio
`admin-ex-alumnos.component.ts`:
- Ampliar `styleClass` del `p-select` de año de `w-32` a `w-40`.
- Agregar `cursor-pointer` a las clases del botón "Limpiar Filtros".

## Acceptance Criteria
- [x] El selector de año muestra el texto completo de la opción seleccionada.
- [x] El botón de limpiar filtros muestra cursor pointer al hacer hover.
