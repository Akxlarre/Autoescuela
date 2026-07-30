# Plan 0014-b — Reemplazar inputs de fecha nativos por p-datepicker del Design System

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-06-12

---

## 1. Resumen ejecutivo

Crear el componente Dumb `app-date-input` que encapsula `p-datepicker` y expone una API de string ISO (`'YYYY-MM-DD'`), idéntica al patrón de `app-email-input`. Agregar el helper inverso `isoToDate()` en `date.utils.ts` (el helper `toISODate()` ya existe). Luego hacer batch-replace en los 16 archivos que usan `<input type="date">`, sustituyendo cada instancia por `<app-date-input>`.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/shared/components/date-input/date-input.component.ts` | Dumb Component | Wrapper sobre `p-datepicker` con API de string ISO |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/utils/date.utils.ts` | Agregar `isoToDate(iso: string): Date \| null` | Helper inverso de `toISODate()`, usado internamente por `app-date-input` |
| `src/app/features/tareas/task-create-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha de vencimiento de tarea |
| `src/app/shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha de venta |
| `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts` | `type="date"` → `<app-date-input>` ×2 | 2 instancias — rango desde/hasta de filtros |
| `src/app/shared/components/registrar-gasto-fijo-drawer/registrar-gasto-fijo-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha del gasto fijo |
| `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha de nacimiento alumno (AC4: validación de edad sin cambios) |
| `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts` | `type="date"` → `<app-date-input>` ×2 | 2 instancias — filtros de fecha en grilla asistencia |
| `src/app/features/admin/auditoria/admin-auditoria.component.ts` | `type="date"` → `<app-date-input>` ×2 | 2 instancias — rango de fechas en filtro de auditoría |
| `src/app/features/admin/asistencia/agendar-teoria-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha de clase teórica |
| `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts` | `type="date"` → `<app-date-input>` ×2 | 2 instancias — fecha de nacimiento + vencimiento licencia |
| `src/app/features/admin/alumno-detalle/inasistencia-drawer/admin-inasistencia-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha de inasistencia |
| `src/app/features/admin/profesional-asistencia/admin-sesion-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha de sesión profesional |
| `src/app/features/admin/contabilidad-cursos/admin-curso-singular-inscribir-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha de nacimiento alumno |
| `src/app/features/admin/pagos/registrar-pago-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha del pago |
| `src/app/features/admin/contabilidad-cursos/admin-curso-singular-crear-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha inicio del curso |
| `src/app/features/admin/contabilidad-anticipos/registrar-anticipo-drawer.component.ts` | `type="date"` → `<app-date-input>` | 1 instancia — fecha del anticipo |
| `src/app/features/admin/flota/maintenance-form-drawer/maintenance-form-drawer.component.ts` | `type="date"` → `<app-date-input>` (remover `DatePickerModule` duplicado si aplica) | 1 instancia — fecha de mantenimiento |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-email-input` → modelo arquitectónico exacto a seguir (Dumb, `input()` + `output()`, helper interno, OnPush)
- `p-datepicker` (`DatePickerModule`) — ya importado en 3 archivos; `app-date-input` lo centraliza

### Facades/Services existentes que extendemos
- `date.utils.ts` — agregar `isoToDate()`. Ya tiene `toISODate()` que es el inverso.

### Componentes/Facades que NO existen y debemos crear
- `app-date-input` — no existe ningún wrapper sobre `p-datepicker` con API ISO. Los 3 archivos que ya usan `p-datepicker` directamente tienen lógica de conversión inline dispersa; el wrapper la centraliza.

---

## 4. Modelo de datos

**N/A** — sin cambios de BD.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Consumidor (Smart o Dumb)
  ├─ <app-date-input
  │     [value]="myIsoString"          ← string 'YYYY-MM-DD'
  │     (valueChange)="onDate($event)" ← emite string 'YYYY-MM-DD'
  │     label="Fecha" required />
  │
  └─ DateInputComponent (Dumb)
        ├─ isoToDate(value())          ← convierte al Date que p-datepicker espera
        ├─ <p-datepicker [(ngModel)]>  ← maneja el Date internamente
        └─ onDateChange(Date)
              └─ toISODate(date)       ← convierte de vuelta a ISO
              └─ valueChange.emit(iso) ← el consumidor solo ve strings
```

### Capas tocadas

- **Dumb nuevo**: `src/app/shared/components/date-input/date-input.component.ts`
- **Utils**: `src/app/core/utils/date.utils.ts` — agregar `isoToDate()`
- **16 consumidores**: swaps mecánicos de template (Smart + Dumb mezclados)
- **Facade**: ninguno
- **BD**: ninguna

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush en el nuevo componente; solo `input()` / `output()` (sin `@Input`)
- [ ] `facades.md` — no aplica (sin Facade nuevo)
- [ ] `models.md` — no aplica (sin modelos nuevos)
- [x] `visual-system.md` — `p-datepicker` con `styleClass` consistente; sin colores hardcodeados en el wrapper
- [ ] `swr-pattern.md` — no aplica
- [ ] `notifications.md` — no aplica
- [x] `testing-tdd.md` — `.spec.ts` para `isoToDate()` (función pura en utils) + spec del componente (lógica de conversión)
- [x] `ai-readability.md` — `data-llm-description` en el input interno del wrapper

---

## 7. Plan de testing

- **Tests unitarios (obligatorios):**
  - `date.utils.spec.ts` — casos para `isoToDate()`: string válida, string vacía, string inválida, fecha límite (1920-01-01, hoy)
  - `date-input.component.spec.ts` — conversión `value ISO → Date interno → emite ISO` (round-trip)
- **QA manual (golden path):**
  - Abrir cada drawer afectado, seleccionar fecha, verificar que el valor se guarda correctamente
  - Verificar modo oscuro en `p-datepicker` (calendario)
  - Verificar que validación de edad en flujo público sigue funcionando (AC4)
- **Regresión:** `ng build` limpio post-implementación

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `p-datepicker` entrega `Date` con timezone offset — `toISODate()` debe usar hora local, no UTC | Alta | `toISODate()` ya usa `getFullYear/getMonth/getDate` (local) — verificar |
| Formularios ReactiveForm con `formControlName` en fecha — `p-datepicker` no implementa `ControlValueAccessor` directamente | Media | Usar `[(ngModel)]` + conversión en el wrapper; no mezclar con `formControlName` directo |
| Los 3 archivos con `p-datepicker` directo (`admin-pagos`, `instructores`) ya tienen su propia lógica de conversión — posible divergencia | Baja | Revisar esos 3 archivos; si la lógica es la misma, migrarlos también a `app-date-input` (out of scope de esta spec si son casos especiales) |
| `maintenance-form-drawer` tiene `DatePickerModule` importado + `type="date"` — puede ser que el `p-datepicker` existente sea para otro campo | Media | Leer el archivo antes de modificar para no romper el campo que ya usa `p-datepicker` |

---

## 9. Orden de implementación

1. **Utils** — `isoToDate()` en `date.utils.ts` + tests
2. **Componente** — `app-date-input` + tests (round-trip conversion)
3. **Batch replace** — los 16 archivos en grupos por módulo:
   - Grupo A (Shared): `public-personal-data`, `asistencia-clase-b-content`, `reportes-contables-content`, `registrar-gasto-fijo-drawer`, `registrar-venta-drawer`
   - Grupo B (Admin features): `registrar-anticipo`, `agendar-teoria`, `inasistencia`, `registrar-pago`, `curso-singular-crear`, `curso-singular-inscribir`, `sesion-profesional`, `pre-inscrito`
   - Grupo C (Otros): `task-create-drawer`, `admin-auditoria`, `maintenance-form-drawer`
4. **Validación** — `ng build` + `npm run test:ci` + Playwright QA
5. **Cierre** — `indices/COMPONENTS.md`, `ROADMAP.md`, `.active`

---

## 10. Estimación

**Talla L** — estimado 1.5–2 días.
- 0.5 día: utils + componente + tests
- 1 día: batch replace en 16 archivos
- 0.5 día: QA + cierre

---

## Changelog

- 2026-06-12 — plan inicial
