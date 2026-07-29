# Fix: El flujo público de horario no enforce "máximo una clase por día"
> id: fix-008-b-publico-horario-max-una-por-dia
> refs: 0009-rediseno-ux-flujo-inscripcion-online-publico (descubierto durante auditoría 0011)
> status: done
> created: 2026-06-04
> resolved: 2026-06-04 — enforce same-day en `onSlotToggle` (público) + JSDoc de `maxPerDay` corregido. Test manual Playwright verde: 2.º slot mismo día NO se agrega (contador 1/12), deseleccionar sigue funcionando (0/12). Validado en vivo por HMR.

## Root Cause

El paso de horario del flujo público (`/inscripcion`) muestra el subtítulo
**"Máximo una por día"** (`public-schedule.component.ts` L29), pero la selección
de slots **no aplica esa regla**: `onSlotToggle()` (L319) solo agrega/quita el slot
sin chequear cuántos slots ya hay seleccionados ese día. La facade
(`PublicEnrollmentFacade.toggleSlot` / `setSelectedSlots`) tampoco limita por día.
Resultado: el alumno puede seleccionar varias clases el mismo día, contradiciendo el
texto y la regla de negocio.

(El flujo privado de secretaría sí enforce el límite vía `assignment.component.selectSlot`,
con `maxPerDay=3` — decisión confirmada de mantener 3 allí; este fix NO toca ese valor.)

## ACs Afectados

- **0009** (paso horario público): la UI promete "máximo una por día" → debe cumplirse.
- Ninguno roto del lado privado (su límite ya funciona).

## Cambio

- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts`
- **Qué cambia:** en `onSlotToggle()`, al agregar un slot, bloquear si ya hay otro slot
  seleccionado en la misma fecha (`slot.date`). Deseleccionar siempre permitido. Mismo
  patrón de bloqueo silencioso que el flujo privado.
- **Doc (secundario):** `src/app/shared/components/matricula-steps/assignment/assignment.component.ts`
  — corregir el JSDoc de `maxPerDay` ("2 para admin/secretaria" → realidad: 3 para secretaría,
  1 default para público/alumno), para que no induzca a error futuro.

## Test de Regresión

- **Manual (Playwright):** `/inscripcion?branchId=1` → Clase B → datos personales → pago total →
  Horario → seleccionar instructor → elegir un slot el viernes → intentar elegir un 2.º slot
  el mismo viernes → **no se agrega** (queda 1 seleccionado ese día). Slots de otros días sí.
