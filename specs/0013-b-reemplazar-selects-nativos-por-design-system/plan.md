# Plan 0013-b — Reemplazar selects nativos por componentes del Design System

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-06-12
> **Talla:** Spec-S

---

## 1. Resumen ejecutivo

Reemplazar 7 instancias de `<select>` HTML nativo con `p-select` de PrimeNG (lista dinámica/estática) o un segmented control inline (género, 3 opciones). Todos los cambios son puramente de capa de presentación — no hay lógica de negocio nueva. Una migración SQL trivial actualiza el COMMENT de las columnas `gender` para documentar el valor `'X'`.

---

## ⚠️ Discrepancia vs spec

La spec original listaba 6 instancias e incluía "Tipo de Fondo" en `admin-configuracion-web` como nativo. **Hallazgo real tras leer el código:**

- **"Tipo de Fondo"** → ya usa `.media-type-pills` (botones custom). **NO es `<select>` nativo.** Fuera de scope.
- **"Curso del Catálogo Operacional"** (`formControlName="course_id"`, línea ~1182) → **SÍ es `<select>` nativo** que la spec no listó.

Total corregido: **7 instancias** en 5 archivos. Se incluyen todas.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260612120000_users_gender_comment.sql` | Migration | COMMENT update en columnas `gender CHAR(1)` de `users` y `professional_pre_registrations` para documentar el valor `'X'` |

### Archivos a MODIFICAR

| Path | Cambio | AC cubierto |
|------|--------|-------------|
| `src/app/features/admin/contabilidad-anticipos/registrar-anticipo-drawer.component.ts` | Reemplazar `<select>` Instructor y Motivo → `p-select`. Agregar `SelectModule`. Agregar `MOTIVO_OPTIONS`. | AC1, AC2 |
| `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.ts` | Reemplazar `<select>` Vehículo → `p-select`. Agregar `FormsModule`. Refactorizar `onVehicleChange(Event)` → `onVehicleSelectChange(number)`. | AC3 |
| `src/app/features/admin/contabilidad-cursos/admin-curso-singular-inscribir-drawer.component.ts` | Reemplazar `<select [(ngModel)]="form().gender">` → segmented control 3 botones (M/F/X). Agregar `GENDER_OPTIONS`. | AC5 |
| `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` | Reemplazar `<select>` Género → segmented control 3 botones (M/F/X). Agregar `GENDER_OPTIONS`. | AC4, AC-E2 |
| `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts` | Reemplazar `<select formControlName="theme">` y `<select formControlName="course_id">` → `p-select`. Agregar `SelectModule`. Agregar `TEMA_OPTIONS`. | AC6 |

### Archivos a ELIMINAR

_(ninguno)_

---

## 3. Reutilización (Discovery)

### Módulos existentes que reutilizamos

- `SelectModule` de `primeng/select` — ya usado en `agenda-schedule-drawer`, `task-create-drawer`, `admin-secretarias` y 7+ más. Patrón establecido:
  ```html
  <p-select
    formControlName="campo"
    [options]="array"
    optionLabel="label"
    optionValue="value"
    styleClass="w-full"
    placeholder="Seleccionar..."
  />
  ```
- Tokens DS: `var(--ds-brand)`, `var(--border-default)`, `var(--bg-surface)`, `var(--text-secondary)` — documentados en `indices/STYLES.md`, funcionan en claro/oscuro.
- `.media-type-pills` en `admin-configuracion-web` como referencia visual del segmented control (mismo concepto de botones agrupados con borde compartido).

### Componentes/Facades que NO se crean

- **No** se crea `app-gender-segmented` — 2 instancias no justifican extracción (spec §4 confirmado).
- **No** se toca ningún Facade — cambio puramente de presentación.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260612120000_users_gender_comment.sql
COMMENT ON COLUMN users.gender
  IS 'Genero del usuario. Valores: M=Masculino, F=Femenino, X=Prefiero no especificar (ley REC Chile 2022). CHAR(1).';

COMMENT ON COLUMN professional_pre_registrations.gender
  IS 'Genero del pre-inscrito. Valores: M=Masculino, F=Femenino, X=Prefiero no especificar. CHAR(1).';
```

> No requiere ALTER TABLE. El tipo `CHAR(1)` ya admite `'X'`.

### RLS

No aplica — esta migración solo actualiza metadatos (COMMENT), sin cambios de permisos ni estructura.

### Modelos UI/DTO

- `Gender = 'M' | 'F' | 'X' | ''` en `core/models/ui/enrollment-personal-data.model.ts` — **ya aplicado**.
- Verificar que `SingularPersonalDataForm.gender` en `core/models/ui/cursos-singulares.model.ts` acepte `'X'` (actualizar si usa un tipo local diferente).

---

## 5. Arquitectura del feature

### Flujo por componente

```
registrar-anticipo-drawer (Smart)
  ├─ p-select [instructorId] → facade.instructores() Signal existente
  └─ p-select [reason]       → MOTIVO_OPTIONS constante local

admin-iniciar-clase-drawer (Smart)
  └─ p-select [ngModel]="selectedVehicleId()"
       (ngModelChange)="onVehicleSelectChange($event)"
       → facade.vehiclesPorSede() Signal existente

admin-curso-singular-inscribir-drawer (Smart)
  └─ segmented-gender → patchForm('gender', value)

public-personal-data (Dumb)
  └─ segmented-gender → patch('gender', value); markDirty('gender')

admin-configuracion-web (Smart)
  ├─ p-select [theme]     → TEMA_OPTIONS constante local, [disabled]="true"
  └─ p-select [course_id] → coursesFacade.availableCourses() Signal existente
```

### Segmented control — diseño HTML canónico

```html
<div
  class="flex rounded-xl overflow-hidden"
  [style.border]="'1.5px solid var(--border-default)'"
  role="radiogroup"
>
  @for (opt of genderOptions; track opt.value) {
    <button
      type="button"
      class="flex-1 py-2.5 text-sm text-center cursor-pointer transition-all"
      [style.background]="formData().gender === opt.value
        ? 'color-mix(in srgb, var(--ds-brand) 10%, transparent)'
        : 'var(--bg-surface)'"
      [style.color]="formData().gender === opt.value
        ? 'var(--ds-brand)' : 'var(--text-secondary)'"
      [style.font-weight]="formData().gender === opt.value ? '600' : '400'"
      [style.border-right]="!$last ? '1px solid var(--border-default)' : 'none'"
      (click)="patch('gender', opt.value); markDirty('gender')"
      [attr.aria-pressed]="formData().gender === opt.value"
      [attr.data-llm-action]="'select-gender-' + opt.value"
    >{{ opt.label }}</button>
  }
</div>
```

### Constante `GENDER_OPTIONS` (en cada archivo afectado)

```typescript
const GENDER_OPTIONS = [
  { value: 'M' as const, label: 'Masculino' },
  { value: 'F' as const, label: 'Femenino' },
  { value: 'X' as const, label: 'Prefiero no especificar' },
];
```

### Refactor `admin-iniciar-clase-drawer` — handler del p-select

```typescript
// Refactorizar: antes recibía Event, ahora recibe el valor directamente
protected onVehicleSelectChange(id: number): void {
  this.selectedVehicleId.set(id);
  const vehicle = this.facade.vehiclesPorSede().find((v) => v.id === id);
  if (vehicle?.currentKm != null) {
    this.form.patchValue({ kmStart: vehicle.currentKm });
  }
}
```

```html
<p-select
  [ngModel]="selectedVehicleId()"
  (ngModelChange)="onVehicleSelectChange($event)"
  [options]="facade.vehiclesPorSede()"
  optionValue="id"
  styleClass="w-full"
  data-llm-description="Selector de vehículo para la clase práctica"
>
  <ng-template pOption let-v>{{ v.plate }}{{ v.brand ? ' · ' + v.brand : '' }}{{ v.model ? ' ' + v.model : '' }}</ng-template>
  <ng-template pSelectedItem let-v>{{ v ? v.plate + (v.brand ? ' · ' + v.brand : '') + (v.model ? ' ' + v.model : '') : '' }}</ng-template>
</p-select>
```

> Se usa `ng-template pOption/pSelectedItem` en lugar de `optionLabel` para replicar el formato `plate · brand model` del `<select>` original.

---

## 6. Restricciones aplicables

Reglas aplicadas: `architecture.md` (OnPush, templates modernos), `visual-system.md` (tokens DS sin hardcodear), `ai-readability.md` (`data-llm-*` en controles interactivos).

---

## 7. Plan de testing

- **Tests unitarios:** No se requieren nuevos `.spec.ts` — ningún componente agrega `computed()` ni lógica de negocio nueva.
- **Build check:** `ng build` verifica tipado y compilación sin errores.
- **QA visual (`/verify` Playwright):**
  - `registrar-anticipo-drawer`: abrir, verificar p-select Instructor (dinámico) y Motivo (estático) con overrides DS.
  - `admin-iniciar-clase-drawer`: seleccionar vehículo, verificar que km se pre-rellena automáticamente.
  - `admin-curso-singular-inscribir-drawer`: clic en cada opción M/F/X, verificar estado activo brand.
  - `public-personal-data`: ídem + AC-E2 (sin selección = CTA "Continuar" bloqueado).
  - `admin-configuracion-web`: tab General → Tema Visual deshabilitado; tab Cursos → course_id dinámico.
  - Dark mode: toggle → todos los controles respetan tokens `[data-mode='dark']`.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `p-select` con `[ngModel]` coexistiendo con `ReactiveFormModule` en `admin-iniciar-clase-drawer` | Baja | Ambos coexisten bien en Angular. Solo asegurar que el p-select del vehículo NO use `formControlName` (usa `[ngModel]` standalone) |
| Tema Visual en `admin-configuracion-web` tiene `cursor-not-allowed` — el `p-select` debe replicar estado disabled | Media | Agregar `[disabled]="true"` al p-select de theme + clase `opacity-80` via `styleClass` |
| Formato del label de vehículo (`plate · brand model`) no admite `optionLabel` simple | Media | Usar `ng-template pOption + pSelectedItem` para el formato compuesto |
| `SingularPersonalDataForm.gender` puede ser `'M' \| 'F'` sin incluir `'X'` | Baja | Verificar `cursos-singulares.model.ts` en T4; actualizar tipo si necesario |
| Valor `'X'` en BD: si una fila tiene `gender='X'` y el DB rechaza por constraint | Baja | `CHAR(1)` no tiene CHECK constraint según la spec §6 — verificar con `\d users` si existe |

---

## 9. Orden de implementación

1. Migración SQL — COMMENT update en columnas `gender`
2. `registrar-anticipo-drawer` — 2 p-selects (más simple, pure ReactiveForm)
3. `admin-configuracion-web` — 2 p-selects (theme disabled + course_id dinámico)
4. `admin-iniciar-clase-drawer` — 1 p-select con ngModel + refactor handler
5. `admin-curso-singular-inscribir-drawer` — segmented control género; verificar tipo en cursos-singulares.model.ts
6. `public-personal-data` — segmented control género + dirty-state en click handlers
7. `ng build` + `/verify` Playwright — golden path + dark mode

---

## 10. Estimación

**Spec-S** — ~2–3 horas de implementación.

---

## Changelog

- 2026-06-12 — plan inicial
