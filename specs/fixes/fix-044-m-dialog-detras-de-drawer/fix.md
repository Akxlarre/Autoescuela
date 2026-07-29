# fix-044-m — p-dialog queda detrás del drawer lateral

## Contexto

El dueño reportó que en la vista de Pagos, al tener un drawer abierto
("Registrar Pago") y luego apretar "Generar Reporte", el modal
"Configurar Reporte de Pagos" (`<p-dialog>`) se renderiza DETRÁS del
drawer en vez de encima.

### Causa raíz

`app-shell.component.ts` (línea 178) le pone a `<main>`:

```html
<main style="container-type: inline-size; container-name: layoutmain;">
```

Esto habilita el sistema de "densidad adaptativa por contenedor"
(`LayoutService.tier()`, ver `.claude/rules/visual-system.md` §Patrón
App-like). Pero `container-type` implica CSS Containment
(`contain: layout` como mínimo), y `contain: layout` convierte a ese
elemento en el **containing block de sus descendientes `position: fixed`**
— no solo de los `absolute`.

`<p-dialog>` de PrimeNG, cuando NO se le pasa `appendTo="body"`, renderiza
su `.p-dialog-mask` (`position: fixed`) **in place**, es decir, dentro del
árbol donde se declaró el componente — en este caso, dentro de `<main>`.
Al quedar atrapado por el `contain: layout` de `<main>`, el z-index alto
que PrimeNG le asigna (`ZIndexUtils`, ~1100) solo gana DENTRO de `<main>`;
no puede competir contra `<app-layout-drawer>` (hermano de `<main>`, con
`z-index: 30` explícito), que se pinta por fuera de ese stacking context
atrapado y por lo tanto queda siempre encima.

Este mismo patrón (`<p-dialog>` sin `appendTo="body"`) existe en 3
archivos y los 3 comparten la misma causa raíz:

- `src/app/features/admin/pagos/admin-pagos.component.ts`
- `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
- `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`

## Alcance

Agregar `appendTo="body"` a los 3 `<p-dialog>` listados arriba — el mismo
patrón que ya usa el proyecto para escapar de contenedores con overflow/
containment (`appendTo="body"` en p-select/p-calendar, ver
`assignment.component.scss`). No se toca `app-shell.component.ts` (el
`container-type: inline-size` en `<main>` es necesario para
`LayoutService.tier()` y no debe removerse), ni la lógica de los modales,
ni ningún facade.

## Acceptance Criteria

- AC1: `admin-pagos.component.ts` — el `<p-dialog>` de "Configurar Reporte
  de Pagos" tiene `appendTo="body"`.
- AC2: `secretaria-pagos.component.ts` — el `<p-dialog>` de "Configurar
  Reporte de Pagos" tiene `appendTo="body"`.
- AC3: `ciclos-teoricos-content.component.ts` — el `<p-dialog>` de
  "Incorporar alumno de otro ciclo" tiene `appendTo="body"`.
- AC4: No se modifica `app-shell.component.ts` ni ningún facade;
  `npm run test:ci` sigue en verde.
