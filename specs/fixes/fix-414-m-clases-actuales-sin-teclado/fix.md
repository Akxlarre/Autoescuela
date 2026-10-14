# Fix: las clases de "Clases Actuales" solo se pueden abrir con el mouse
> id: fix-414-m-clases-actuales-sin-teclado
> refs: fix-395-m-testing-dashboards (caso S05) · ai-readability.md
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard de secretaria y drawer "Agenda de Hoy": con Tab se llega a los accesos rápidos y a las
alertas, pero el foco salta las clases. No hay forma de iniciar, finalizar ni ver una clase sin
mouse, y un lector de pantalla no las anuncia como algo accionable.

## Root Cause

En `LiveClassesPanelComponent` cada clase es un `<li (click)>`: sin `tabindex`, sin rol, sin
manejo de teclado y sin atributo `data-llm-action`. Es la acción principal del panel.

## Fix

Cada fila es enfocable y accionable con Enter o Espacio, se anuncia como botón con un nombre que
dice qué hace ("Iniciar la clase de …", "Finalizar la clase de …", "Ver el detalle de la clase de
…"), muestra el foco y lleva `data-llm-action`.

## Acceptance Criteria

- [x] AC1 — Con Tab el foco llega a cada clase y se ve.
- [x] AC2 — Enter y Espacio hacen lo mismo que el clic.
- [x] AC3 — El nombre accesible dice la acción según el estado de la clase.

## Regression Test

- `live-classes-panel.component.spec.ts` → `acción de cada fila (fix-414-m)`
- `e2e/dashboards.spec.ts` → `S05`

## Verificación (2026-10-13)

- Unit: `live-classes-panel.component.spec.ts` 25/25, 3 tests nuevos (nombre e identificador de la
  acción según el estado). `tsc` sin errores.
- E2E `e2e/dashboards.spec.ts` → `S05`, en verde: la fila de una clase sembrada hoy tiene
  `role="button"`, `aria-label` "Iniciar la clase de …" y `data-llm-action="start-live-class"`;
  recibe el foco y con Enter abre "Iniciar Clase Práctica" con ese alumno. El caso
  "K04 · … · N01" (clic con mouse, también dentro de "Agenda de Hoy") sigue en verde.
