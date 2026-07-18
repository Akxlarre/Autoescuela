# fix-023-m — Botón "Agregar" del modal Incorporar alumno sin estado de carga

## Contexto

El dueño probó el modal "Incorporar alumno de otro ciclo" (post fix-022) y
señaló que al apretar "Agregar" no hay ningún feedback visual de que la acción
está en curso — el botón solo se deshabilita globalmente (`isSaving()`) pero
no cambia de texto/ícono, a diferencia de los botones de envío de Zoom
("Enviando..." con spinner) que ya siguen este patrón en el mismo componente.

## Causa raíz

`CiclosTeoricosContentComponent` (`ciclos-teoricos-content.component.ts`) no
tiene ningún estado local que identifique **qué** alumno del modal está
siendo agregado. El botón "Agregar" (línea ~382-389) solo usa
`[disabled]="isSaving()"`, un flag global compartido con guardar clase y
mover alumno, sin texto/ícono de carga por fila. El componente ya resuelve
este mismo problema para el envío de Zoom vía `sendingClassId` + el efecto
que lo limpia cuando `isSaving()` transiciona de `true` a `false`
(`ciclos-teoricos-content.component.ts:436-451`) — el fix es replicar ese
patrón para "Agregar".

## Cambio

### `shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`

- Nuevo signal local `addingEnrollmentId = signal<number | null>(null)`.
- Nuevo método `onAddStudent(enrollmentId: number)`: setea
  `addingEnrollmentId` y emite `addStudent.emit(enrollmentId)`.
- Extender el `effect()` existente (que ya trackea `isSaving()` para el envío
  de Zoom) para también limpiar `addingEnrollmentId` cuando `isSaving()`
  transiciona de `true` a `false`.
- Botón "Agregar": si `addingEnrollmentId() === a.enrollmentId`, mostrar
  spinner (`app-icon name="loader-circle" class="animate-spin"`) + texto
  "Agregando..."; si no, "Agregar" como hoy. Se mantiene
  `[disabled]="isSaving()"`.

Cambio acotado a un solo archivo (dumb component), sin tocar el Facade ni el
Smart Component — `moveStudentToCycle` ya expone `isSaving()` correctamente.

## Acceptance Criteria

- [x] Al apretar "Agregar" en una fila del modal, ese botón (y solo ese)
      muestra spinner + "Agregando..." mientras `isSaving()` es `true`.
- [x] Al terminar la operación (`isSaving()` vuelve a `false`),
      `addingEnrollmentId` se limpia y el botón vuelve a "Agregar".
- [x] `npm run test:ci` (facade + tsc) sigue en verde, sin regresiones en
      `ciclos-teoricos.facade.spec.ts`. No hay `.spec.ts` propio del dumb
      component (pre-existente, no agregado por este fix) — no se pudo
      verificar visualmente en navegador real (Playwright MCP no disponible
      en esta máquina).
