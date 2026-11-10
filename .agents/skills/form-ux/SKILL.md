---
name: form-ux
description: >
  Layout UX/UI de formularios: responsive grid, anatomía de campos, secciones,
  footers de acción y patrones de feedback visual. Activar cuando se cree o
  modifique un formulario en drawer, modal o página completa. Complementa
  angular-forms (lógica) y design-system (tokens). Define la estructura visual
  canónica de todos los formularios del proyecto.
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep
---

# Form UX — Layout, Responsive y Feedback Visual

> Este skill define la **capa visual** de los formularios. Para la lógica de
> validación usa `angular-forms`. Para tokens de color usa `design-system`.

---

## 1. Contextos de formulario

| Contexto | Ancho máximo | Columnas | Footer |
|---|---|---|---|
| **Drawer** | `max-w-xl` (560px) | 1-col por defecto, 2-col para pares | Fijo al fondo (`shrink-0`) |
| **Modal** | `max-w-lg` (512px) | 1-col siempre | Inline al final del form |
| **Página completa** | `max-w-3xl` (768px) | 2-col en `md:`, 1-col en mobile | Sticky `bottom-0` o inline |
| **Wizard step** | `max-w-2xl` (672px) | 1-col, progreso externo | Sticky con pasos prev/next |

---

## 2. Anatomía de un campo (Field Anatomy)

Cada campo sigue esta estructura vertical **sin excepciones**:

```html
<div class="flex flex-col gap-1.5">
  <!-- 1. Label -->
  <label class="field-label" for="campo-id">
    Nombre del campo <span style="color: var(--state-error)">*</span>
  </label>

  <!-- 2. Input (ver variantes abajo) -->
  <input
    id="campo-id"
    type="text"
    class="field-input"
    [class.field-input--error]="isInvalid('campo')"
    placeholder="Placeholder descriptivo"
    data-llm-description="Descripción semántica para agentes IA"
    aria-required="true"
  />

  <!-- 3. Hint (opcional, siempre visible) -->
  <span class="field-hint">Texto de ayuda contextual sin condicional.</span>

  <!-- 4. Error (condicional, reemplaza hint cuando hay error) -->
  @if (isInvalid('campo')) {
    <span class="field-error" role="alert">
      <app-icon name="circle-alert" [size]="12" />
      Mensaje de error específico y accionable.
    </span>
  }
</div>
```

### CSS de campos (styles locales del componente)

```scss
.field-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  outline: none;
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
  box-sizing: border-box;
}
.field-input:focus {
  border-color: var(--ds-brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
}
.field-input::placeholder {
  color: var(--text-muted);
}
.field-input--error {
  border-color: var(--state-error);
}
.field-input--valid {
  border-color: var(--state-success);
}

.field-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}
.field-error {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--state-error);
}
```

---

## 3. Variantes de input

### Input estándar
```html
<input pInputText type="text" class="field-input" formControlName="nombre" />
```

### Textarea
```html
<textarea
  pTextarea
  formControlName="descripcion"
  rows="4"
  class="field-input resize-none"
  placeholder="Describe..."
></textarea>
```

### Select (PrimeNG)
```html
<p-select
  formControlName="tipo"
  [options]="tipoOptions"
  placeholder="Seleccionar tipo"
  styleClass="w-full"
  [style]="{ height: '40px' }"
  aria-required="true"
  data-llm-description="Selector de tipo"
/>
```

### Date picker (PrimeNG)
```html
<p-datepicker
  formControlName="fecha"
  dateFormat="dd/mm/yy"
  [showIcon]="true"
  [style]="{ width: '100%' }"
  placeholder="dd/mm/aaaa"
/>
```

### Input numérico (PrimeNG)
```html
<p-inputNumber
  formControlName="monto"
  mode="currency"
  currency="CLP"
  locale="es-CL"
  placeholder="0"
  inputStyleClass="w-full field-input"
/>
```

### Input con prefijo (icono o símbolo)
```html
<div class="relative">
  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
  <input type="number" class="field-input pl-7" formControlName="precio" />
</div>
```

---

## 4. Grid responsive

### 1 columna (drawers, modales)
```html
<div class="flex flex-col gap-5">
  <!-- campos apilados -->
</div>
```

### 2 columnas pareadas (datos relacionados)
```html
<div class="grid grid-cols-2 gap-4">
  <div class="flex flex-col gap-1.5">
    <label class="field-label">Año *</label>
    <p-inputNumber formControlName="year" />
  </div>
  <div class="flex flex-col gap-1.5">
    <label class="field-label">KM Actual</label>
    <p-inputNumber formControlName="current_km" />
  </div>
</div>
```

### 2 columnas responsive (página completa)
```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
  <div class="flex flex-col gap-1.5">...</div>
  <div class="flex flex-col gap-1.5">...</div>
  <!-- campo full-width: ocupa ambas columnas -->
  <div class="flex flex-col gap-1.5 md:col-span-2">...</div>
</div>
```

### 3 columnas (tablas de datos/precios)
```html
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <div class="flex flex-col gap-1.5">...</div>
  <div class="flex flex-col gap-1.5">...</div>
  <div class="flex flex-col gap-1.5">...</div>
</div>
```

---

## 5. Secciones con título (Section Headers)

Para formularios con más de 4-5 campos, agrupar con secciones:

```html
<!-- Sección con separador -->
<h3 class="section-title">Información Personal</h3>
<div class="flex flex-col gap-4 mb-6">
  <!-- campos de la sección -->
</div>

<h3 class="section-title">Información de Licencia</h3>
<div class="flex flex-col gap-4 mb-6">
  <!-- campos de la sección -->
</div>
```

```scss
.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}
```

---

## 6. Estructura de Drawer con formulario

```html
<div class="flex-1 flex flex-col min-h-0 bg-surface">
  <form [formGroup]="form" class="flex-1 flex flex-col min-h-0" (ngSubmit)="onSubmit()">

    <!-- ── Body scrolleable ── -->
    <div class="flex-1 overflow-y-auto px-6 py-8">
      <div class="flex flex-col gap-6 max-w-xl mx-auto">

        <!-- Info banner (opcional) -->
        <div class="flex items-start gap-3 rounded-lg p-3"
             style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent);
                    border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);">
          <app-icon name="info" [size]="16" color="var(--ds-brand)" />
          <p class="text-xs leading-relaxed" style="color: var(--ds-brand)">
            Texto informativo del contexto del formulario.
          </p>
        </div>

        <!-- Sección 1 -->
        <h3 class="section-title">Datos principales</h3>
        <div class="flex flex-col gap-4 mb-2">
          <div class="flex flex-col gap-1.5">
            <label class="field-label" for="nombre">Nombre *</label>
            <input id="nombre" type="text" class="field-input"
                   [class.field-input--error]="isInvalid('nombre')"
                   formControlName="nombre" placeholder="Ej: Juan" />
            @if (isInvalid('nombre')) {
              <span class="field-error" role="alert">
                <app-icon name="circle-alert" [size]="12" />
                El nombre es obligatorio (mínimo 2 caracteres).
              </span>
            }
          </div>

          <!-- Par de campos -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Año *</label>
              <p-inputNumber formControlName="year" [useGrouping]="false" placeholder="2024"
                             inputStyleClass="w-full field-input" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="field-label">KM Actual</label>
              <p-inputNumber formControlName="km" placeholder="0"
                             inputStyleClass="w-full field-input" />
            </div>
          </div>
        </div>

        <!-- Error global del formulario -->
        @if (errorMsg()) {
          <p-message severity="error" [text]="errorMsg()!" class="w-full" />
        }

      </div>
    </div>

    <!-- ── Footer fijo ── -->
    <div class="shrink-0 px-6 py-4 border-t bg-surface flex items-center justify-end gap-3"
         style="border-color: var(--border-subtle);">
      <button type="button" class="btn-secondary" (click)="onCancel()">
        Cancelar
      </button>
      <button type="submit" class="btn-primary h-11 px-8 flex items-center gap-2"
              [disabled]="form.invalid || isSaving()">
        @if (isSaving()) {
          <app-icon name="loader-2" [size]="16" class="animate-spin" />
          Guardando...
        } @else {
          <app-icon name="check" [size]="16" />
          Guardar
        }
      </button>
    </div>

  </form>
</div>
```

---

## 7. Estructura de formulario en página completa

```html
<div class="max-w-3xl mx-auto px-4 py-8">
  <form [formGroup]="form" (ngSubmit)="onSubmit()">

    <!-- Card contenedor -->
    <div class="card flex flex-col gap-8">

      <!-- Sección 1 -->
      <div>
        <h3 class="section-title">Información General</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <!-- campos -->
        </div>
      </div>

      <!-- Sección 2 -->
      <div>
        <h3 class="section-title">Detalles</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <!-- campos -->
        </div>
      </div>

    </div>

    <!-- Footer inline al final -->
    <div class="flex items-center justify-end gap-3 mt-6 pt-4"
         style="border-top: 1px solid var(--border-subtle)">
      <button type="button" class="btn-secondary" (click)="onCancel()">
        Cancelar
      </button>
      <button type="submit" class="btn-primary flex items-center gap-2"
              [disabled]="form.invalid || isSaving()">
        @if (isSaving()) {
          <app-icon name="loader-2" [size]="16" class="animate-spin" />
        }
        Guardar Cambios
      </button>
    </div>

  </form>
</div>
```

---

## 8. Footer de acciones — Patrones

### Drawer con layout flex proporcional (1/3 + 2/3)
```html
<div class="flex items-center gap-3 pt-4" style="border-top: 1px solid var(--border-subtle)">
  <button class="btn-secondary flex-1" (click)="onCancel()">Cancelar</button>
  <button class="btn-primary flex-[2]" [disabled]="saving()">Guardar</button>
</div>
```

### Drawer con botones de ancho fijo
```html
<div class="flex items-center justify-end gap-3 p-5 border-t bg-surface shrink-0"
     style="border-color: var(--border-subtle)">
  <button class="btn-secondary h-11 px-6" (click)="onCancel()">Cancelar</button>
  <button class="btn-primary h-11 px-8 flex items-center gap-2" [disabled]="saving()">
    @if (saving()) {
      <app-icon name="loader-2" [size]="16" class="animate-spin" />
    }
    Crear Vehículo
  </button>
</div>
```

### Solo un botón de cierre (drawers de solo lectura)
```html
<div class="shrink-0 p-6 border-t bg-surface flex items-center justify-end"
     style="border-color: var(--border-subtle)">
  <button class="btn-primary h-11 px-8" (click)="onClose()">Cerrar</button>
</div>
```

### Wizard con prev/next
```html
<div class="flex items-center justify-between gap-3 pt-4"
     style="border-top: 1px solid var(--border-subtle)">
  <button class="btn-secondary flex items-center gap-2"
          [disabled]="isFirstStep()" (click)="prevStep()">
    <app-icon name="arrow-left" [size]="16" />
    Anterior
  </button>
  <button class="btn-primary flex items-center gap-2"
          [disabled]="!stepValid() || saving()" (click)="nextStep()">
    @if (isLastStep()) { Finalizar } @else { Siguiente }
    @if (!isLastStep()) { <app-icon name="arrow-right" [size]="16" /> }
  </button>
</div>
```

---

## 9. Estados de feedback visual

### Éxito inline
```html
@if (saveSuccess()) {
  <div class="flex items-center gap-2 p-3 rounded-lg"
       style="background: color-mix(in srgb, var(--state-success) 8%, transparent);
              border: 1px solid color-mix(in srgb, var(--state-success) 20%, transparent);">
    <app-icon name="check-circle" [size]="16" color="var(--state-success)" />
    <span class="text-sm" style="color: var(--state-success)">Guardado correctamente.</span>
  </div>
}
```

### Error global
```html
@if (saveError()) {
  <div class="flex items-center gap-2 p-3 rounded-lg"
       style="background: color-mix(in srgb, var(--state-error) 8%, transparent);
              border: 1px solid color-mix(in srgb, var(--state-error) 20%, transparent);">
    <app-icon name="alert-circle" [size]="16" color="var(--state-error)" />
    <span class="text-sm" style="color: var(--state-error)">{{ saveError() }}</span>
  </div>
}
```

### Preview de estado (badge inline)
```html
<span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
      [class.badge-success]="status === 'valid'"
      [class.badge-warning]="status === 'expiring_soon'"
      [class.badge-error]="status === 'expired'">
  {{ statusLabel }}
</span>
```

```scss
.badge-success {
  background: color-mix(in srgb, var(--state-success) 12%, transparent);
  color: var(--state-success);
}
.badge-warning {
  background: color-mix(in srgb, var(--state-warning) 12%, transparent);
  color: var(--state-warning);
}
.badge-error {
  background: color-mix(in srgb, var(--state-error) 12%, transparent);
  color: var(--state-error);
}
```

---

## 10. Campos especiales

### RUT chileno (con formateo en tiempo real)
```html
<input
  type="text"
  class="field-input font-mono"
  [class.field-input--error]="rut().length > 0 && !rutValido()"
  [class.field-input--valid]="rutValido()"
  maxlength="12"
  placeholder="12.345.678-9"
  [ngModel]="rut()"
  (input)="onRutInput($event)"
  data-llm-description="RUT chileno, formato 12.345.678-9"
/>
@if (rut().length > 0 && !rutValido()) {
  <span class="field-error">
    <app-icon name="circle-alert" [size]="12" />
    RUT inválido. Verifica el dígito verificador.
  </span>
} @else if (rutValido()) {
  <span class="flex items-center gap-1 text-xs" style="color: var(--state-success)">
    <app-icon name="check-circle" [size]="12" />
    RUT válido
  </span>
}
```

### Toggle activo/inactivo (estado de cuenta)
```html
<div class="flex items-center gap-3">
  <button class="estado-btn" [class.estado-btn--active]="activo()"
          (click)="activo.set(true)">
    <app-icon name="check-circle" [size]="14" />
    Activo
  </button>
  <button class="estado-btn" [class.estado-btn--inactive]="!activo()"
          (click)="activo.set(false)">
    <app-icon name="circle" [size]="14" />
    Inactivo
  </button>
</div>
```

```scss
.estado-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast);
}
.estado-btn--active {
  border-color: var(--state-success);
  background: color-mix(in srgb, var(--state-success) 10%, transparent);
  color: var(--state-success);
}
.estado-btn--inactive {
  border-color: var(--border-strong);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
```

### Chips multi-select (especialidades/categorías)
```html
<div class="grid grid-cols-2 gap-2">
  @for (opt of options; track opt.value) {
    <button type="button"
            class="spec-chip"
            [class.spec-chip--active]="isSelected(opt.value)"
            (click)="toggleOption(opt.value)">
      <span class="spec-badge" [style.background]="opt.color">{{ opt.code }}</span>
      <span class="text-sm">{{ opt.label }}</span>
    </button>
  }
</div>
```

```scss
.spec-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast);
  text-align: left;
}
.spec-chip:hover { border-color: var(--ds-brand); }
.spec-chip--active {
  border-color: var(--ds-brand);
  background: color-mix(in srgb, var(--ds-brand) 6%, transparent);
  color: var(--text-primary);
}
.spec-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: white;
}
```

---

## 11. Reglas de UX obligatorias

### Accesibilidad
- Todo `<input>` tiene `id` único y `<label for="id">` explícito
- Campos requeridos con `aria-required="true"` y asterisco `*` visible
- Errores con `role="alert"` para screen readers
- Botón submit deshabilitado con `[disabled]` cuando `form.invalid || saving()`

### Semántica AI (`data-llm-*`)
- Todo input crítico: `data-llm-description="descripción en inglés"`
- Botones de mutación: `data-llm-action="accion-kebab-case"`
- Formularios: `data-llm-form="nombre-del-formulario"`

### Placeholders
- Siempre descriptivos: `"Ej: Juan Carlos"`, `"Ej: 45.000"`, no `"Ingrese aquí"`
- En selects: `"Seleccionar [concepto]"` — nunca `"Seleccione..."`

### Mensajes de error
- Específicos y accionables: `"Ingresa el nombre (mínimo 2 caracteres)"` ✅
- No genéricos: `"Campo inválido"` ❌
- Mostrar solo cuando el campo fue tocado (`touched`) o el form fue submitido

### Layout de botones
- **Primario a la derecha** siempre (convención universal)
- **Nunca más de 2 botones** en un footer de drawer/modal
- En mobile: botones a full-width con `w-full` o `flex-1`

---

## 12. Checklist antes de entregar un formulario

- [ ] Cada campo tiene `label`, `id` coincidente y `placeholder` descriptivo
- [ ] Errores solo aparecen post-`touched` o post-submit
- [ ] Mensaje de error específico con ícono `<app-icon>`
- [ ] Botón submit deshabilitado cuando `form.invalid || saving()`
- [ ] Spinner en botón durante `saving()` con `animate-spin`
- [ ] Footer con `btn-primary` + `btn-secondary` (utilities globales)
- [ ] `data-llm-action` en botones de mutación
- [ ] `data-llm-description` en inputs críticos
- [ ] Responsive: 1-col en mobile, 2-col en pares cuando el espacio lo permite
- [ ] Secciones agrupadas si hay más de 5 campos
- [ ] Sin colores hardcodeados — solo tokens `var(--...)`
- [ ] Sin `@Input()` ni `@Output()` — usar `input()` y `output()`
- [ ] `ChangeDetectionStrategy.OnPush`
