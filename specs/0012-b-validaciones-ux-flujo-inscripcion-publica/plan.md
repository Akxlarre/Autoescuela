# Plan 0012-b — Validaciones UX — Flujo de inscripción pública

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-06-12

---

## 1. Resumen ejecutivo

Se extienden las validaciones de `app-public-personal-data` en 4 ejes:
(1) selector de prefijo internacional + E.164 para teléfono vía nuevo Dumb component `app-phone-input`;
(2) validación de nombres sin dígitos vía `name.utils.ts`;
(3) cotas de fecha de nacimiento + detección de fechas imposibles vía `isInvalidDate()` en `age.utils.ts`;
(4) patrón dirty-state por campo + dirty-all-on-submit (WCAG 3.3.1) + atributos ARIA en todos los campos obligatorios.

Cero cambios en BD, Facade, ni Edge Function. Orden: utils puras con TDD primero → componentes después.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/phone.utils.ts` | Util (Functional Core) | `validatePhone(digits, dialCode)`, `normalizePhone()` → E.164, constante `DIAL_CODES[]` |
| `src/app/core/utils/phone.utils.spec.ts` | Test Vitest | AC2–AC7, AC-E3, AC-E6 — cobertura completa de validación y normalización |
| `src/app/core/utils/name.utils.ts` | Util (Functional Core) | `validateName(name)` (regex sin dígitos), `stripInvalidNameChars(raw)` (auto-strip) |
| `src/app/core/utils/name.utils.spec.ts` | Test Vitest | AC13–AC16, AC-E4 — nombres válidos e inválidos |
| `src/app/core/utils/email.utils.spec.ts` | Test Vitest | AC8, AC11, AC12, AC-E2 — normalizeEmail + validateEmail edge cases |
| `src/app/shared/components/phone-input/phone-input.component.ts` | Dumb Component | `<select>` nativo de prefijo + input dígitos + feedback verde/rojo + ARIA |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/utils/age.utils.ts` | Agregar `isInvalidDate(dateStr: string): boolean` | AC19, AC20, AC-E5 |
| `src/app/core/utils/age.utils.spec.ts` | Agregar suite `isInvalidDate()` (5 casos) | TDD obligatorio para nuevas funciones |
| `src/app/core/utils/email.utils.ts` | Agregar `normalizeEmail(email: string): string` (trim + toLowerCase) | AC8, AC-E2 |
| `src/app/shared/components/email-input/email-input.component.ts` | `_blurred = signal(false)` reemplaza `isDirty`; agregar input `forceDirty`; llamar `normalizeEmail` en blur | AC8–AC10, ARIA AC21–AC23 |
| `src/app/shared/components/email-input/email-input.component.html` | Agregar `aria-required`, `aria-invalid`, `aria-describedby`, id único en mensaje de error | AC21–AC23 |
| `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` | Ver §5 — refactor completo | AC1–AC26 |
| `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.spec.ts` | Actualizar casos de `canAdvanceFn` para teléfono E.164 | Regresión |

### Archivos a ELIMINAR

*(Ninguno)*

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos

- `<app-icon name="circle-alert" />` y `<app-icon name="check-circle" />` — ambos ya registrados en `app.config.ts` → feedback del phone-input sin tocar app.config
- `<app-email-input>` — se extiende con ARIA + blur-dirty + `normalizeEmail`; no se crea un componente nuevo
- `<app-public-context-banner>` — sin cambios
- `ChevronDown` — ya registrado; el `<select>` nativo usa el chevron del browser, no hace falta ícono Lucide adicional

### Facades/Services que reutilizamos sin cambios

- `validateRut()` / `formatRut()` — `core/utils/rut.utils.ts`
- `validateEmail()` — `core/utils/email.utils.ts` — solo se agrega `normalizeEmail()`
- `getAgeStatus()` / `calcAge()` — `core/utils/age.utils.ts` — solo se agrega `isInvalidDate()`

### Sin cambios en `app.config.ts`

Todos los íconos Lucide necesarios ya están registrados.

### Componente nuevo — justificación

- **`app-phone-input`**: no existe en el proyecto (verificado en `indices/COMPONENTS.md`). El campo actual es `<input type="tel">` plano. El selector de prefijo requiere estado interno (`_dialCode`, `_digits`) y lógica de validación dependiente del dial code. No hay base reutilizable.

---

## 4. Modelo de datos

**N/A** — cero cambios en BD ni migraciones.

`EnrollmentPersonalData.phone: string` ya existe. El formato emitido cambia de texto libre a E.164 (`"+56912345678"`). La Edge Function `public-enrollment` recibe `phone` como string sin cambios del lado servidor.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Usuario (paso personal-data del wizard público)
  → PublicPersonalDataComponent (Dumb, shared/)
      │
      ├── _dirtyFields: WritableSignal<Record<FieldKey, boolean>>
      │     → false inicial; true en (blur) o al onNext() con errores
      │
      ├── _allDirty: WritableSignal<boolean>
      │     → se activa en onNext() cuando !canAdvance()
      │
      ├── canAdvance = computed → canAdvanceFn(data, courseType)
      │     ├── validateRut()
      │     ├── validateEmail()
      │     ├── validatePhone(digits, dialCode)   ← NUEVO
      │     ├── validateName(firstNames)           ← NUEVO
      │     ├── validateName(paternalLastName)     ← NUEVO
      │     ├── !isInvalidDate(birthDate)          ← NUEVO
      │     ├── date bounds (>= 1920, <= today)    ← NUEVO
      │     └── ageStatus checks (existente)
      │
      ├── onNext():
      │     si canAdvance() → next.emit()
      │     sino           → _allDirty.set(true) + focusFirstError()
      │
      ├── <app-phone-input> (NUEVO — reemplaza <input type="tel">)
      │     inputs:  value (E.164), id, label, required, forceDirty
      │     outputs: valueChange (E.164)
      │     state:   _dialCode signal, _digits signal, _blurred signal
      │     logic:   validatePhone / normalizePhone ← phone.utils [FC]
      │     ARIA:    aria-required, aria-invalid, aria-describedby
      │
      ├── <app-email-input> (extendido)
      │     input  nuevo: forceDirty = input<boolean>(false)
      │     state  nuevo: _blurred = signal(false)
      │     lógica nueva: normalizeEmail en (blur) → emite lowercase
      │     ARIA:         aria-required, aria-invalid, aria-describedby
      │
      ├── campos nombres/apellidos
      │     (input):  stripInvalidNameChars() auto-strip ← name.utils [FC]
      │     (blur):   marcar _dirtyFields
      │     ARIA:     aria-required, aria-invalid, aria-describedby
      │
      └── campo fecha de nacimiento
            attrs:  min="1920-01-01", [attr.max]="today"
            (blur): marcar dirty + _birthDateInvalid según isInvalidDate()
            ARIA:   aria-required, aria-invalid, aria-describedby

Functional Core (core/utils/ — sin Angular, testeable sin DI):
  phone.utils:  validatePhone(digits, dialCode) → bool
                normalizePhone(digits, dialCode) → E.164 string
                DIAL_CODES: DialCode[]
  name.utils:   validateName(name) → bool
                stripInvalidNameChars(raw) → string
  age.utils:    + isInvalidDate(dateStr) → bool
  email.utils:  + normalizeEmail(email) → string
```

### Capas tocadas

- **Dumb (`shared/`)**: `PublicPersonalDataComponent` (refactor), `EmailInputComponent` (extensión), `PhoneInputComponent` (nuevo)
- **Functional Core (`core/utils/`)**: `phone.utils`, `name.utils`, extensiones en `age.utils` y `email.utils`
- **Facade / BD / Edge Function**: Sin cambios

### Patrón `forceDirty`

`app-phone-input` y `app-email-input` aceptan `forceDirty = input<boolean>(false)`.
`showFeedback = computed(() => _blurred() || forceDirty())`.
El padre pasa `[forceDirty]="_allDirty()"` a ambos hijos cuando el usuario intenta avanzar con errores.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Dumb components con `input()`/`output()`, OnPush, signals locales para dirty-state; Functional Core en `core/utils/`
- [x] `visual-system.md` — Tokens semánticos (`var(--state-error)`, `var(--state-success)`), sin hex hardcodeados, `<app-icon>` para íconos de feedback
- [x] `models.md` — `EnrollmentPersonalData` en `core/models/ui/` — no duplicar interfaz
- [x] `testing-tdd.md` — utils puras OBLIGAN `.spec.ts`; `app-phone-input` tiene `computed()` con lógica → spec obligatorio; TDD previo a implementación
- [x] `ai-readability.md` — `data-llm-description` en `<input>` de dígitos de `app-phone-input`; botón "Continuar" mantiene `data-llm-action="submit-personal-data"`

- [ ] `facades.md` — No aplica (sin facade nuevo)
- [ ] `swr-pattern.md` — No aplica (sin caching)
- [ ] `notifications.md` — No aplica (sin toasts)

---

## 7. Plan de testing

### Unitarios — Functional Core (TDD: escribir spec ANTES de implementar)

| Archivo | Casos mínimos |
|---------|---------------|
| `phone.utils.spec.ts` | `validatePhone('+56','912345678')→true` (móvil 9d), `('+56','22345678')→true` (fijo 8d), `('+56','1234567')→false` (AC4 corto), `('+54','1234567')→true` (E.164 AC5), `('+56','')→false` (AC-E3), `normalizePhone('+56','9 1234 5678')→'+56912345678'` (AC-E6), `normalizePhone('+56','912345678')→'+56912345678'` (AC7) |
| `name.utils.spec.ts` | `validateName('García-López')→true` (AC14), `validateName("O'Brien")→true`, `validateName('Juan123')→false` (AC13), `validateName('   ')→false` (AC-E4), `validateName('Ab')→true` (min 2), `stripInvalidNameChars('Ju4n')→'Jun'` |
| `email.utils.spec.ts` | `normalizeEmail('USER@DOMAIN.COM')→'user@domain.com'` (AC-E2), `normalizeEmail('  HI@X.CL  ')→'hi@x.cl'`, `validateEmail('user+tag@d.com')→true` (AC12), `validateEmail('usuario@dominio')→false` (AC11) |
| `age.utils.spec.ts` (extender) | `isInvalidDate('2001-02-29')→true` (AC-E5), `isInvalidDate('2000-02-29')→false` (AC20 bisiesto), `isInvalidDate('2024-06-12')→false`, `isInvalidDate('')→false`, `isInvalidDate('abc')→false` |

### Regresión

| Archivo | Actualización |
|---------|--------------|
| `public-personal-data.component.spec.ts` | Reemplazar mock de phone `length >= 8` por valor E.164 válido `'+56912345678'` |

### QA manual / Playwright (golden path + edge cases clave)

| AC | Escenario |
|----|-----------|
| AC1 | Prefijo +56 preseleccionado al cargar |
| AC4 | "123" + blur → borde rojo "Número incompleto" |
| AC6 | Tipear "abc" en dígitos → ignorados |
| AC9 | Email sin interacción → sin feedback |
| AC13 | Tipear "Juan123" → auto-strip, queda "Juan" |
| AC17/18 | `<input type="date">` tiene `max=hoy` y `min=1920-01-01` |
| AC19 | Ingresar "2001-02-29" + blur → "Fecha inválida" |
| AC25 | Campo no tocado no muestra error |
| AC26 | "Continuar" con campos vacíos → todos los errores visibles + foco al primero |

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `app-email-input` tiene otros consumidores (flujo admin). Cambiar `isDirty` a blur-based altera la UX | Media | Grep de `<app-email-input>` antes de modificar; `forceDirty` tiene default `false` → no es breaking |
| Tests existentes en `public-personal-data.component.spec.ts` fallan con el cambio de teléfono | Alta (certeza) | Actualizar spec en la misma tarea que se modifica `canAdvanceFn` |
| Auto-strip de dígitos en nombres puede sorprender en copy-paste | Baja | Solo `firstNames` y `paternalLastName`; campos opcionales no se tocan |
| `normalizeEmail` en blur podría causar race condition con `(ngModelChange)` | Baja | Emit en `(blur)` es posterior al `(ngModelChange)`; Angular procesa en orden DOM |

---

## 9. Orden de implementación

> **Regla TDD**: escribe `.spec.ts` ANTES del `.ts` para cada util.

1. **Functional Core — utils (TDD)**
   - [ ] `phone.utils.spec.ts` → `phone.utils.ts` → `npm run test:ci` verde
   - [ ] `name.utils.spec.ts` → `name.utils.ts` → `npm run test:ci` verde
   - [ ] Extender `age.utils.spec.ts` con `isInvalidDate` → extender `age.utils.ts` → test verde
   - [ ] Crear `email.utils.spec.ts` con `normalizeEmail` → extender `email.utils.ts` → test verde

2. **`app-phone-input` component**
   - [ ] `<select>` nativo + `DIAL_CODES` + `<input type="text">` dígitos (keydown prevention)
   - [ ] Signals: `_dialCode`, `_digits`, `_blurred`; computeds: `isValid`, `e164Value`, `showFeedback`
   - [ ] Emitir `e164Value()` en `valueChange` en cada cambio
   - [ ] ARIA + `data-llm-description`
   - [ ] Placeholder contextual según país (AC spec §7)

3. **Extender `app-email-input`**
   - [ ] `_blurred = signal(false)` + `(blur)` handler + `showFeedback = computed(() => _blurred() || forceDirty())`
   - [ ] Input `forceDirty = input<boolean>(false)`
   - [ ] Llamar `normalizeEmail()` en blur → emitir lowercase
   - [ ] ARIA en template HTML (aria-required, aria-invalid, aria-describedby + id en mensaje)

4. **Refactor `public-personal-data.component.ts`**
   - [ ] Importar `PhoneInputComponent`, utils nuevas
   - [ ] `_dirtyFields` + `_allDirty` signals
   - [ ] `_birthDateInvalid = signal(false)` + handler (blur) con `isInvalidDate()`
   - [ ] Reemplazar `<input type="tel">` por `<app-phone-input>`
   - [ ] Auto-strip en nombres: `onNamesInput()` con `stripInvalidNameChars()`
   - [ ] Fecha: `min="1920-01-01"` + `[attr.max]="today"` + (blur) handler
   - [ ] ARIA en todos los campos obligatorios
   - [ ] Actualizar `canAdvanceFn`: phone usa `validatePhone`, names usan `validateName`, date usa `isInvalidDate` + bounds
   - [ ] `onNext()`: `_allDirty.set(true)` + `focusFirstError()` si `!canAdvance()`
   - [ ] Quitar `[disabled]="!canAdvance()"` del botón "Continuar"
   - [ ] `aria-live="polite"` en alertas `under-17` y `under-20-professional` (AC24 — `requires-authorization` ya lo tiene)

5. **Actualizar `public-personal-data.component.spec.ts`**
   - [ ] Mock de phone → valor E.164 válido

6. **Validación final**
   - [ ] `npm run lint:arch`
   - [ ] `npm run test:ci`
   - [ ] `/verify` — golden path AC26

---

## 10. Estimación

**M** — ~10 horas.
- Paso 1 (utils TDD): ~3.5h
- Paso 2 (phone-input): ~2.5h
- Paso 3 (email-input ARIA): ~1h
- Paso 4 (personal-data refactor): ~2h
- Paso 5+6 (regresión + validación): ~1h

---

## Changelog

- 2026-06-12 — plan inicial (auto-clasificado M: 12 archivos, 0 facade, 0 migración, 0 dominio nuevo)
