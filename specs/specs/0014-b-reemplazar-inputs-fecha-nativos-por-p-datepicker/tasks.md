# Tasks 0014-b — Reemplazar inputs de fecha nativos por p-datepicker del Design System

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-06-12

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Utils y helper

- [ ] **T1.1** — Agregar `isoToDate()` en `src/app/core/utils/date.utils.ts`
  - **AC ref:** AC2
  - **DoD:**
    - [ ] Firma: `isoToDate(iso: string): Date | null`
    - [ ] Retorna `null` si `iso` es vacío o inválido
    - [ ] Usa `T12:00:00` local igual que `toISODate()` para evitar offset UTC
    - [ ] Exportada del módulo

- [ ] **T1.2** — Tests para `isoToDate()` en `src/app/core/utils/date.utils.spec.ts`
  - **AC ref:** AC2
  - **DoD:**
    - [ ] Caso: string válida `'2000-03-15'` → `Date` con día/mes/año correcto
    - [ ] Caso: string vacía `''` → `null`
    - [ ] Caso: string inválida `'no-es-fecha'` → `null`
    - [ ] Round-trip: `toISODate(isoToDate('2000-03-15')!)` === `'2000-03-15'`
    - [ ] `npm run test:ci` PASA

---

## Fase 2 — Componente app-date-input

- [ ] **T2.1** — Crear `src/app/shared/components/date-input/date-input.component.ts`
  - **AC ref:** AC1, AC2, AC3, AC5
  - **DoD:**
    - [ ] `OnPush`, standalone
    - [ ] Inputs: `value` (string ISO, req), `label` (string, ''), `id` (string, 'date'), `required` (boolean, false), `min` (string, ''), `max` (string, ''), `placeholder` (string, 'dd/mm/aaaa')
    - [ ] Output: `valueChange` (string ISO `'YYYY-MM-DD'`)
    - [ ] Internamente: convierte `value()` → `Date` con `isoToDate()` para el `p-datepicker`
    - [ ] `onDateChange(date: Date | Date[] | null)`: usa `toISODate()` y emite ISO
    - [ ] `DatePickerModule` importado (de `primeng/datepicker`)
    - [ ] `FormsModule` importado (para `[(ngModel)]` interno)
    - [ ] `dateFormat="dd/mm/yy"`, `[showIcon]="true"`, `styleClass="w-full"`
    - [ ] `data-llm-description` en el trigger del datepicker
    - [ ] Modo oscuro funciona vía tokens DS (no colores hardcodeados)
    - [ ] Documentado en `indices/COMPONENTS.md`

- [ ] **T2.2** — Tests de round-trip en `date-input.component.spec.ts`
  - **AC ref:** AC2, AC-E1
  - **DoD:**
    - [ ] Test: valor ISO pre-cargado `'1990-06-15'` → `p-datepicker` muestra la fecha correcta
    - [ ] Test: seleccionar fecha → `valueChange` emite string ISO correcta
    - [ ] Test: valor vacío `''` → `p-datepicker` sin fecha seleccionada
    - [ ] `npm run test:ci` PASA

---

## Fase 3 — Batch replace (Grupo A: Shared)

- [ ] **T3.1** — `public-personal-data.component.ts` — fecha de nacimiento
  - **AC ref:** AC1, AC4
  - **DoD:**
    - [ ] `<input type="date">` reemplazado por `<app-date-input>`
    - [ ] `DateInputComponent` importado en `imports[]`
    - [ ] Bindings: `[value]="formData().birthDate"`, `(valueChange)="patch('birthDate', $event)"`, `(blur)` migrado a `markDirty` si aplica
    - [ ] La validación de edad (`getAgeStatus()`) sigue recibiendo string ISO — verificado
    - [ ] `ng build` parcial limpio

- [ ] **T3.2** — `asistencia-clase-b-content.component.ts` — filtros de fecha ×2
  - **AC ref:** AC1, AC-E2
  - **DoD:**
    - [ ] Ambas instancias reemplazadas
    - [ ] Bindings de rango respetan `[min]`/`[max]` si existían
    - [ ] `ng build` parcial limpio

- [ ] **T3.3** — `reportes-contables-content.component.ts` — rango desde/hasta ×2
  - **AC ref:** AC1, AC-E2
  - **DoD:**
    - [ ] Ambas instancias reemplazadas
    - [ ] Semántica de rango (fecha-desde y fecha-hasta) correcta
    - [ ] `ng build` parcial limpio

- [ ] **T3.4** — `registrar-gasto-fijo-drawer.component.ts` y `registrar-venta-drawer.component.ts`
  - **AC ref:** AC1
  - **DoD:**
    - [ ] `type="date"` reemplazado en ambos archivos
    - [ ] `ng build` parcial limpio

---

## Fase 4 — Batch replace (Grupo B: Admin features)

- [ ] **T4.1** — Drawers de contabilidad: `registrar-anticipo-drawer.component.ts`, `admin-curso-singular-crear-drawer.component.ts`, `admin-curso-singular-inscribir-drawer.component.ts`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [ ] 3 archivos modificados
    - [ ] Fechas pre-cargadas se muestran correctamente (AC-E1)
    - [ ] `ng build` parcial limpio

- [ ] **T4.2** — Drawers de asistencia: `agendar-teoria-drawer.component.ts`, `admin-inasistencia-drawer.component.ts`, `admin-sesion-drawer.component.ts`, `registrar-pago-drawer.component.ts`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [ ] 4 archivos modificados
    - [ ] `ng build` parcial limpio

- [ ] **T4.3** — `admin-pre-inscrito-drawer.component.ts` — fecha nacimiento + vencimiento licencia ×2
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [ ] Ambas instancias reemplazadas (distintos campos: birthDate y licenseExpiry)
    - [ ] `[min]`/`[max]` preservados si existían
    - [ ] `ng build` parcial limpio

---

## Fase 5 — Batch replace (Grupo C: Otros)

- [ ] **T5.1** — `task-create-drawer.component.ts` — fecha de vencimiento
  - **AC ref:** AC1
  - **DoD:**
    - [ ] `type="date"` reemplazado
    - [ ] `ng build` parcial limpio

- [ ] **T5.2** — `admin-auditoria.component.ts` — rango de fechas ×2
  - **AC ref:** AC1, AC-E2
  - **DoD:**
    - [ ] Ambas instancias reemplazadas
    - [ ] `ng build` parcial limpio

- [ ] **T5.3** — `maintenance-form-drawer.component.ts` — ⚠️ leer antes de modificar
  - **AC ref:** AC1
  - **DoD:**
    - [ ] Archivo leído — identificado si el `DatePickerModule` existente es para el mismo campo o uno diferente
    - [ ] Solo el campo `type="date"` migrado (sin romper el `p-datepicker` que ya existía)
    - [ ] `ng build` parcial limpio

---

## Fase 6 — Validación

- [ ] **T6.1** — `ng build` completo limpio
  - **DoD:**
    - [ ] 0 errores TypeScript
    - [ ] 0 warnings de compilación nuevos

- [ ] **T6.2** — `npm run test:ci` verde
  - **DoD:**
    - [ ] `date.utils.spec.ts` — todos los tests de `isoToDate` pasan
    - [ ] `date-input.component.spec.ts` — round-trip tests pasan
    - [ ] 0 regresiones en otros tests

- [ ] **T6.3** — QA Playwright: golden path + dark mode
  - **AC ref:** AC3, AC4, AC5, AC-E1, AC-E2
  - **DoD:**
    - [ ] `p-datepicker` abre y cierra correctamente en al menos 3 formularios distintos
    - [ ] Modo oscuro: calendario se ve con tokens DS (sin cajas blancas hardcodeadas)
    - [ ] Flujo público: fecha de nacimiento → validación de edad funciona igual
    - [ ] Formulario con valor pre-cargado (edición) muestra la fecha correctamente
    - [ ] 0 errores en consola

---

## Fase 7 — Cierre

- [ ] **T7.1** — Actualizar `indices/COMPONENTS.md` con `app-date-input`
- [ ] **T7.2** — Marcar spec 0014-b como `done` en `specs/ROADMAP.md`
- [ ] **T7.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
