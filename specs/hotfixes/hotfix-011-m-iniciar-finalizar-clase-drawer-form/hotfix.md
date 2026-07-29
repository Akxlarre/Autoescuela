# hotfix-011-m — Migrar Iniciar/Finalizar Clase a app-drawer-form

## Problema
En el rollout de `app-drawer-form` a los ~40 drawers del proyecto (fix-025/026),
`admin-iniciar-clase-drawer.component.ts` y
`admin-finalizar-clase-drawer.component.ts` quedaron explícitamente fuera a
pedido del usuario. Ahora pide incorporarlos también para que compartan el
mismo shell (scroll, footer fijo, ancho de columna) que el resto de los
drawers.

## Cambio
En ambos componentes:
1. Envolver el contenido en `<app-drawer-form>` (import de
   `DrawerFormComponent`).
2. Mover los botones de acción (Cancelar / Comenzar Clase / Cerrar Clase)
   al slot `[drawer-form-footer]` vía `ngProjectAs`, siguiendo el patrón ya
   usado en `registrar-pago-drawer.component.ts` (footer con botones que
   llaman al handler directamente, sin depender de `type="submit"` nativo).
3. Sin cambios de lógica de negocio, validaciones ni llamadas al facade.

## Acceptance Criteria
- [x] `admin-iniciar-clase-drawer.component.ts` usa `app-drawer-form` con
      Cancelar/Comenzar Clase en el footer fijo.
- [x] `admin-finalizar-clase-drawer.component.ts` usa `app-drawer-form` con
      Cancelar/Cerrar Clase en el footer fijo.
- [x] El comportamiento (iniciar clase, finalizar clase) no cambia.
