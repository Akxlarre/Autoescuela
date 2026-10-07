# Hotfix: El drawer global no se cierra con Escape ni al cambiar de pantalla
> id: hotfix-061-b-drawer-escape-y-navegacion
> refs: ASG-i-037 (sospecha S9, casos F03/F04/Y05 del checklist 037; confirmada en fix-190-b)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Problema
El drawer global (`LayoutDrawerComponent` + `LayoutDrawerService`) no escucha Escape ni los cambios
de ruta, y no se anuncia como diálogo. Si se abre "Nueva Matrícula" en Alumnos y se va a Agenda por
el menú, el drawer queda abierto sobre otra pantalla.

## Cambios
- **Archivo:** `src/app/core/utils/drawer-navigation.utils.ts` (+ spec) — `isRouteChange(actual,
  siguiente)`: compara solo el path (ignora query string y fragmento).
- **Archivo:** `src/app/layout/layout-drawer.component.ts`:
  - **Escape** → `requestClose()` (respeta la pregunta de "¿descartar cambios?" de fix-310-m). No
    actúa si el evento ya lo atendió otro control (`defaultPrevented`: selects y datepickers de
    PrimeNG con la lista abierta) ni con el modal de confirmación abierto.
  - **Navegación** → al empezar una navegación (`NavigationStart`) a otro path, `close()`. En
    `NavigationStart` y no en `NavigationEnd`: una página que abre un drawer al cargar no lo ve
    cerrarse. Cambios solo de query (`?tab=`) no lo cierran.
  - Panel con `role="dialog"` y `aria-label` = título.

## Verificación
- `vitest` del util; `ng build`, `lint:arch`, `test:ci`; E2E con Escape y navegación.
- Resultado: `drawer-navigation.utils.spec.ts` 3/3; E2E nuevo `e2e/drawer-global.spec.ts` 3/3 contra
  el build de producción (Escape cierra y el panel se anuncia como diálogo "Ajustes del Sistema";
  navegar por el menú cierra; con la lista de un `p-select` abierta, el primer Escape cierra solo la
  lista y el segundo el drawer). `test:ci` 3365/3365, `ng build` OK, `lint:arch` 0 errores.
