# Fix: La grilla de horarios muestra horas sin instructor seleccionado (desync)
> id: fix-009-b-horario-instructor-desync
> refs: 0009-rediseno-ux-flujo-inscripcion-online-publico (descubierto en auditoría 0011)
> status: done
> created: 2026-06-04
> resolved: 2026-06-04 — placeholder `disabled` (commit 5559d34). Regression test verde: Playwright no puede seleccionar la opción ("option being selected is not enabled"); dropdown y grilla quedan siempre sincronizados.

## Root Cause

En el paso de horario público, si el usuario selecciona un instructor (carga la grilla)
y luego elige la opción placeholder "— Selecciona un instructor —", la grilla **sigue
mostrando las horas** mientras el `<select>` muestra "sin selección". Estado inconsistente:
se pueden ver/elegir horas sin un instructor visible seleccionado.

`public-schedule.component.ts` → `onInstructorChange()`:
```ts
const id = +(event.target as HTMLSelectElement).value;
if (id) { ... this.dataChange.emit({ ...instructorId: id }); }  // value="" → id=0 → NO emite
```
Al elegir el placeholder (`value=""`), `id = +"" = 0` (falsy) → el bloque se salta y **no se
emite ningún cambio**. El Facade conserva `selectedInstructorId` y `scheduleGrid`, así que la
grilla persiste; pero el `<select>` (OnPush, sin nuevo CD) queda mostrando el placeholder.
Además `public-enrollment.component.ts` → `onAssignmentDataChange()` retorna temprano si
`instructorId` es `null` sin limpiar el Facade, por lo que el desync no se podría revertir
ni siquiera emitiendo `null`.

Reproducido con Playwright: dropdown="— Selecciona un instructor —" (value="") + grilla con
13 slots visibles + empty-state ausente.

## ACs Afectados

- **0009 / 0011 §7.6** (grilla de horarios coherente): la grilla solo debe mostrarse cuando
  hay un instructor realmente seleccionado y reflejado en el `<select>`.

## Cambio

- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts`
- **Qué cambia:** marcar la opción placeholder como `disabled` (`<option value="" disabled>`)
  para que no pueda re-seleccionarse una vez elegido un instructor. Estándar de "placeholder"
  de un `<select>`: se muestra como prompt inicial pero no es elegible → elimina el desync en
  el origen sin cambiar la facade. (Para cambiar de instructor el usuario elige otro real.)

## Test de Regresión

- **Manual (Playwright):** horario → elegir instructor (grilla aparece) → abrir el `<select>` e
  intentar elegir "— Selecciona un instructor —" → la opción está deshabilitada / no cambia;
  el dropdown sigue reflejando un instructor real mientras la grilla está visible. Nunca hay
  grilla con dropdown vacío.
