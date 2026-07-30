# Spec 0014-b — Reemplazar inputs de fecha nativos por p-datepicker del Design System

> **Status:** approved
> **Created:** 2026-06-12
> **Owner:** Akxlarre
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Auditoría UX sesión 2026-06-12 — continuación de spec 0013 (selects nativos).

**Persona afectada:** Secretaria, Admin, Instructor, Alumno (flujo público).

**Problema que resuelve:**
18 instancias de `<input type="date">` nativo coexisten con `p-datepicker` de PrimeNG (usado en 3 archivos). El date picker nativo renderiza el widget del sistema operativo — aspecto cuadrado, tipografía del OS, sin tokens de color ni bordes del DS — rompiendo la consistencia visual exactamente como los `<select>` nativos de la spec 0013. El problema se nota especialmente en formularios con múltiples campos custom (p-select, app-phone-input, app-email-input) donde el date input nativo destaca negativamente.

**Hipótesis de valor:**
Reemplazar los 18 inputs nativos por `p-datepicker` unifica la experiencia con el patrón ya establecido, elimina la "app incompleta" y garantiza consistencia cross-browser/cross-OS.

---

## 2. User Stories

- **US1**: Como secretaria registrando un anticipo, quiero que el selector de fecha tenga el mismo estilo que el resto del formulario.
- **US2**: Como admin creando/editando un instructor, quiero seleccionar la fecha de nacimiento o vencimiento de licencia con un picker moderno.
- **US3**: Como admin en contabilidad, quiero que los filtros de rango de fecha tengan el mismo aspecto que los demás controles.
- **US4**: Como alumno en el flujo público, quiero seleccionar mi fecha de nacimiento con un picker consistente con el resto del formulario.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given cualquier formulario del sistema, When el campo tiene `type="date"`, Then debe ser reemplazado por `p-datepicker` con `dateFormat="dd/mm/yy"` y `styleClass` consistente con los demás campos.
- **AC2**: Given un `p-datepicker` conectado a un `FormControl` de string ISO, When el usuario selecciona una fecha, Then el valor guardado en el control es `'YYYY-MM-DD'` (no un objeto `Date`).
- **AC3**: Given un `p-datepicker`, When se abre el calendario, Then el estilo (fondo, bordes, hover) usa tokens del DS (`var(--ds-brand)`, `var(--bg-surface)`, etc.) — sin colores hardcodeados.
- **AC4**: Given el flujo público de inscripción, When el alumno selecciona su fecha de nacimiento, Then la validación de edad sigue funcionando igual que antes.
- **AC5**: Given cualquier formulario con `p-datepicker`, When se activa el modo oscuro, Then el calendario se ve correctamente con los tokens dark.

### Edge cases obligatorios

- **AC-E1**: Given un campo de fecha con valor existente (edición), When se abre el formulario, Then `p-datepicker` muestra la fecha pre-cargada correctamente.
- **AC-E2**: Given un rango de fechas (filtros de reportes), When se selecciona fecha inicio y fin, Then el rango queda correctamente representado.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.

- ❌ Time picker (solo fecha, sin hora)
- ❌ Rediseño del calendario de la Agenda (tiene su propio componente de grilla)
- ❌ Cambios a la lógica de validación de fechas (`age.utils.ts`, etc.)
- ❌ Internacionalización de meses/días (queda en español del locale PrimeNG actual)

---

## 5. Dependencias

### Specs previas
- 0013 (done) — establece el patrón `p-select`; `p-datepicker` sigue el mismo approach

### Capacidades del proyecto que se asumen existentes
- `DatePickerModule` de `primeng/datepicker` ya importado en 3 componentes
- Locale `es` de PrimeNG ya configurado en `app.config.ts`

### Capacidades nuevas requeridas
- Componente `app-date-input` en `shared/components/date-input/` — wrapper sobre `p-datepicker` que expone interface de string ISO (misma API que `app-email-input`)
- Helpers `dateToIso(date: Date | null): string` y `isoToDate(iso: string): Date | null` en `core/utils/date.utils.ts`

---

## 6. Datos y modelo (preliminar)

- Sin cambios en BD
- Sin modelos UI nuevos — solo cambios de template y helpers de conversión

---

## 7. UX y flujos (preliminar)

- 18 archivos afectados (ver inventario en `plan.md`)
- Nuevo componente `app-date-input` (Dumb, `shared/`) que encapsula `p-datepicker`
- API pública: `value` (string ISO `'YYYY-MM-DD'`), `label`, `id`, `required`, `min`, `max`, `placeholder`. Output: `valueChange` (string ISO)
- Cada uno de los 18 archivos reemplaza `<input type="date">` por `<app-date-input>`
- La conversión `Date ↔ ISO` ocurre dentro del wrapper, invisible al consumidor

---

## 8. Métricas de éxito post-launch

- 0 instancias de `<input type="date">` en `src/app/` (verificable con `grep`)
- `ng build` limpio
- Playwright: 0 errores consola en los formularios afectados

---

## 9. Notas / decisiones abiertas

- [x] **Wrapper reutilizable `app-date-input`** — crear `shared/components/date-input/` con `p-datepicker` encapsulado. Inputs: `value` (string ISO), `label`, `id`, `required`, `min`, `max`, `placeholder`. Output: `valueChange` (string ISO). Mismo patrón que `app-email-input`.
- [x] **Flujo público incluido** — reemplazar `type="date"` en `public-personal-data`. La lógica de `getAgeStatus()` en `age.utils.ts` recibe un string ISO `'YYYY-MM-DD'`; el wrapper se encarga de la conversión `Date ↔ ISO` internamente, sin tocar `age.utils.ts`.

---

## Changelog

- 2026-06-12 — draft inicial por Akxlarre
