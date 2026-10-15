# Fix: los eventos de "Actividad Reciente" no se abren con el teclado
> id: fix-421-m-actividad-reciente-sin-teclado
> refs: fix-395-m-testing-dashboards (casos P06, P07, P08) · fix-414-m
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

En el drawer "Actividad Reciente" los eventos que llevan a la ficha del alumno o a Pagos solo se
abren con el mouse: con Tab no se llega a ellos y un lector de pantalla no los anuncia como
botones. Tampoco tienen `data-llm-action`.

## Root Cause

Cada evento es un `<li>` con `(click)`, sin `role`, `tabindex` ni manejo de Enter/Espacio. Es el
mismo patrón que `fix-414-m` corrigió en "Clases Actuales".

## Fix

Los eventos clicables llevan `role="button"`, `tabindex="0"`, un `aria-label` que dice a dónde
llevan, `data-llm-action="open-activity-target"` y abren con Enter y Espacio. Los que no llevan a
ningún lado (borrados, alumno eliminado) quedan sin rol ni foco.

## Acceptance Criteria

- [x] AC1 — Un evento clicable es un botón enfocable que dice a dónde lleva.
- [x] AC2 — Enter y Espacio sobre él navegan igual que el clic.
- [x] AC3 — Un evento no clicable no recibe foco ni rol de botón.

## Regression Test

- `recent-activity-drawer.component.spec.ts` → `fix-421-m`

## Verificación (2026-10-14)

- Unit: `recent-activity-drawer.component.spec.ts` (nuevo), 3 tests. Sin el cambio fallan 2 de 3.
  `tsc` sin errores.
- Navegador, secretaria de la sede 1: con Tab se llega al evento "Alumno actualizado" (foco
  visible), que se anuncia como "Alumno actualizado: abrir la ficha del alumno"; Enter cierra el
  drawer y abre `/app/secretaria/alumnos/2824`. Consola sin errores ni advertencias. El evento se
  generó con la sesión de la secretaria cambiando y restaurando `has_notarial_auth` del alumno
  2824 (queda como estaba).
