# fix-021-m — Incorporar alumno: panel inline → modal

## Contexto

En la pestaña "Ciclos Teóricos" de Asistencia B, el botón **Incorporar** (sección
"Alumnos del ciclo") abre un panel de "Incorporar alumno de otro ciclo" **inline**,
debajo del roster existente, dentro de una card con `flex-col` y sin scroll
propio garantizado hacia la nueva sección. El resultado (ver captura del dueño):
el panel se renderiza fuera del viewport visible sin ningún indicio de que algo
se abrió — el usuario aprieta el botón y no pasa nada visible en pantalla.

## Problema

`CiclosTeoricosContentComponent` (`src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`):
- El signal `addPanelOpen` controla un bloque `@if` que se renderiza al final de
  la card "Alumnos del ciclo" (líneas ~357-396), después de la lista de roster.
- No hay auto-scroll ni foco hacia el panel recién abierto.
- No hay overlay/backdrop que comunique "se abrió algo nuevo".

## Fix

Reemplazar el panel inline por un modal (`p-dialog` de PrimeNG, patrón ya usado
en `secretaria-pagos.component.ts` / `admin-pagos.component.ts`):
- `[visible]="addPanelOpen()"` / `(visibleChange)="addPanelOpen.set($event)"`.
- `[modal]="true"` para overlay + foco atrapado — comunica inmediatamente que
  se abrió algo.
- Mismo contenido (lista de `addableStudents()`, botón "Agregar", botón "Cerrar"
  reemplazado por el cierre nativo del dialog).
- Sin cambios de Facade/Smart component — el input/output (`requestAddable`,
  `addStudent`) se mantiene igual.

## Acceptance Criteria

- [x] Al apretar "Incorporar", se abre un modal centrado con overlay (no un
      panel inline al final de la lista).
- [x] El modal muestra la lista de alumnos de otros ciclos y el botón "Agregar".
- [x] Cerrar el modal (X, click fuera, o botón "Cerrar") deja el estado igual
      que antes (`addPanelOpen` en `false`).
- [x] `requestAddable.emit()` sigue disparándose al abrir, igual que antes.
- [x] No se rompe ningún test existente de `ciclos-teoricos-content` (no había
      `.spec.ts` previo para este dumb component; `npx tsc --noEmit` y
      `npm run lint:arch` no muestran errores nuevos atribuibles a este cambio).
      `npm run test:ci` corrido: 1080 passed / 1 failed — el único fallo es
      `auth.facade.spec.ts > whenReady should resolve after getUser() completes`
      (timeout preexistente, no relacionado a este archivo ni tocado por este fix).
