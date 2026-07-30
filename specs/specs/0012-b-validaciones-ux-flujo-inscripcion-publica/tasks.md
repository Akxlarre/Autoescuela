# Tasks 0012-b — Validaciones UX — Flujo de inscripción pública

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

## Fase 1 — Functional Core (utils, TDD)

> Las utils son puras (sin Angular). Escribir el `.spec.ts` PRIMERO, luego implementar, luego `npm run test:ci`.

- [x] **T1.1** — `phone.utils.spec.ts` + `phone.utils.ts`
  - **AC ref:** AC2, AC3, AC4, AC5, AC6, AC7, AC-E3, AC-E6
  - **DoD:**
    - [ ] `src/app/core/utils/phone.utils.spec.ts` creado con las suites antes del `.ts`
    - [ ] Constante `DIAL_CODES: DialCode[]` — 9 prefijos: CL +56, AR +54, PE +51, BO +591, CO +57, VE +58, ES +34, US +1, Otro (input libre 1–4 dígitos)
    - [ ] `validatePhone(digits: string, dialCode: string): boolean`
      - +56 con 9 dígitos que empiece en 9 → `true` (móvil)
      - +56 con 8 dígitos → `true` (fijo)
      - +56 con 7 dígitos → `false`
      - prefijo no-CL con 7–15 dígitos → `true` (E.164)
      - dígitos vacíos → `false` (AC-E3)
    - [ ] `normalizePhone(digits: string, dialCode: string): string` → E.164 sin espacios
      - `'+56', '9 1234 5678'` → `'+56912345678'` (AC-E6)
      - `'+56', '912345678'` → `'+56912345678'` (AC7)
    - [ ] `npm run test:ci` — suite de phone.utils en verde

- [x] **T1.2** — `name.utils.spec.ts` + `name.utils.ts`
  - **AC ref:** AC13, AC14, AC15, AC16, AC-E4
  - **DoD:**
    - [ ] `src/app/core/utils/name.utils.spec.ts` creado primero
    - [ ] `validateName(name: string): boolean`
      - `'García-López'` → `true` (tildes, guiones)
      - `"O'Brien"` → `true` (apóstrofe)
      - `'María José'` → `true` (espacio interno)
      - `'Juan123'` → `false` (contiene dígito)
      - `'   '` → `false` (solo espacios → trim → vacío, AC-E4)
      - `'Ab'` → `true` (mínimo 2 chars válidos)
    - [ ] `stripInvalidNameChars(raw: string): string`
      - `'Ju4n'` → `'Jun'` (elimina dígitos)
      - `'Ana!'` → `'Ana'` (elimina símbolos fuera del set permitido)
      - Charset permitido: letras Unicode (incluye tildes), espacios, guiones, apóstrofes
    - [ ] `npm run test:ci` — suite de name.utils en verde

- [x] **T1.3** — Extender `age.utils.ts` con `isInvalidDate()` + tests
  - **AC ref:** AC19, AC20, AC-E5
  - **DoD:**
    - [ ] Suite `isInvalidDate()` agregada en `age.utils.spec.ts` ANTES de implementar
    - [ ] `isInvalidDate(dateStr: string): boolean`
      - `'2001-02-29'` → `true` (no es año bisiesto, AC-E5)
      - `'2000-02-29'` → `false` (año bisiesto válido, AC20)
      - `'2024-06-12'` → `false`
      - `''` → `false` (string vacío no es "fecha inválida", es "fecha ausente")
      - `'abc'` → `false` (fecha malformada — `calcAge` ya retorna null; no es "imposible")
    - [ ] Exportada desde `age.utils.ts`
    - [ ] `npm run test:ci` — todos los tests de age.utils en verde

- [x] **T1.4** — `email.utils.spec.ts` + `normalizeEmail()` en `email.utils.ts`
  - **AC ref:** AC8, AC11, AC12, AC-E2
  - **DoD:**
    - [ ] `src/app/core/utils/email.utils.spec.ts` creado (no existe actualmente)
    - [ ] Tests para `validateEmail()` existente (AC11, AC12) incluidos en la nueva suite
    - [ ] `normalizeEmail(email: string): string` → `email.trim().toLowerCase()`
      - `'USER@DOMAIN.COM'` → `'user@domain.com'` (AC-E2)
      - `'  HI@X.CL  '` → `'hi@x.cl'` (trim + lower)
    - [ ] Exportada desde `email.utils.ts`
    - [ ] `npm run test:ci` — suite de email.utils en verde

---

## Fase 2 — Capa UI

- [x] **T2.1** — Crear `app-phone-input` component
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC-E3, AC-E6
  - **DoD:**
    - [ ] Path: `src/app/shared/components/phone-input/phone-input.component.ts`
    - [ ] Standalone, `OnPush`, solo `input()` / `output()` (sin inyección de Facades)
    - [ ] Inputs: `value = input<string>('')`, `id = input<string>('phone')`, `label = input<string>('Teléfono / WhatsApp')`, `required = input<boolean>(false)`, `forceDirty = input<boolean>(false)`
    - [ ] Output: `valueChange = output<string>()` — emite E.164 en cada cambio válido
    - [ ] Signals internos: `_dialCode = signal('+56')`, `_digits = signal('')`, `_blurred = signal(false)`
    - [ ] `isValid = computed(() => validatePhone(_digits(), _dialCode()))` ← phone.utils
    - [ ] `e164Value = computed(() => normalizePhone(_digits(), _dialCode()))` ← phone.utils
    - [ ] `showFeedback = computed(() => _blurred() || forceDirty())`
    - [ ] `<select>` nativo con `DIAL_CODES` (bandera emoji + dial code). CL +56 preseleccionado.
    - [ ] `<input type="text">` solo dígitos: keydown prevention de letras/símbolos (AC6)
    - [ ] Placeholder contextual: CL → `'9 1234 5678'`; US → `'(555) 123-4567'`; resto → `'0000 0000'`
    - [ ] Feedback verde/rojo + mensaje bajo el input (mismo patrón visual que RUT)
    - [ ] ARIA: `aria-required`, `aria-invalid`, `aria-describedby` → id del mensaje de error
    - [ ] `data-llm-description="Student phone number with dial code prefix for WhatsApp contact"` en el input de dígitos
    - [ ] Tokens de color: `var(--state-error)`, `var(--state-success)`, sin hex hardcodeados
    - [ ] `<app-icon name="circle-alert" />` y `<app-icon name="check-circle" />` para feedback

- [x] **T2.2** — Extender `app-email-input` (ARIA + blur-dirty + normalizeEmail)
  - **AC ref:** AC8, AC9, AC10, AC21, AC22, AC23
  - **DoD:**
    - [ ] `_blurred = signal(false)` reemplaza la lógica `isDirty = computed(() => value().length > 0)` (AC9 — sin interacción, sin feedback)
    - [ ] `(blur)` handler en el `<input>` → `_blurred.set(true)` + emitir `normalizeEmail(value())` (AC8)
    - [ ] Input `forceDirty = input<boolean>(false)` agregado
    - [ ] `showFeedback = computed(() => _blurred() || forceDirty())`
    - [ ] Template actualizado: `@if (showFeedback() && !isValid())` / `@if (showFeedback() && isValid())`
    - [ ] ARIA en `email-input.component.html`:
      - `[attr.aria-required]="required()"` en el `<input>`
      - `[attr.aria-invalid]="showFeedback() && !isValid()"` en el `<input>`
      - `[attr.aria-describedby]="id() + '-feedback'"` en el `<input>`
      - `[id]="id() + '-feedback'"` en el `<p>` de feedback (error o éxito)
    - [ ] Verificar que otros consumidores de `<app-email-input>` no se rompen (grep + `ng build` limpio)

- [x] **T2.3** — Refactor `public-personal-data`: nombres + fecha + ARIA + dirty-state
  - **AC ref:** AC13, AC14, AC15, AC16, AC17, AC18, AC19, AC21, AC22, AC23, AC24, AC25, AC-E4, AC-E5
  - **DoD:**
    - [ ] `_dirtyFields = signal<Record<string, boolean>>({})` agregado
    - [ ] `markDirty(field: string)` helper → `_dirtyFields.update(m => ({ ...m, [field]: true }))`
    - [ ] `isDirty(field: string)` helper → `computed(() => !!_dirtyFields()[field] || _allDirty())`
      - *Nota: `_allDirty` se agrega en T2.4*
    - [ ] **Nombres/Apellidos:**
      - `onNamesInput(field, raw)` → `stripInvalidNameChars(raw)` → emitir si cambia (AC13)
      - `maxlength="80"` en `firstNames` y `paternalLastName` (AC15)
      - `(blur)` → `markDirty(field)`
      - Feedback rojo bajo el campo si `isDirty(field) && !validateName(value)` (AC13)
      - ARIA: `[attr.aria-required]="true"`, `[attr.aria-invalid]="isDirty('firstNames') && !nameValid()"`, `[attr.aria-describedby]="'pub-names-error'"`
      - `<p id="pub-names-error" ...>` cuando hay error
    - [ ] **Apellido materno** (opcional): no aplica validación de nombres; `maxlength="80"` igual
    - [ ] **Fecha de nacimiento:**
      - `min="1920-01-01"` hardcodeado (AC18)
      - `[attr.max]="today"` donde `today` es `computed()` que retorna la fecha actual en YYYY-MM-DD (AC17)
      - `_birthDateInvalid = signal(false)` + `(blur)` → `isInvalidDate(birthDate)` → set signal (AC19)
      - Feedback rojo "Fecha inválida" cuando `isDirty('birthDate') && _birthDateInvalid()` (AC19)
      - ARIA: `aria-required="true"`, `[attr.aria-invalid]="isDirty('birthDate') && _birthDateInvalid()"`, `aria-describedby="pub-birth-error"`
    - [ ] **Alertas de edad:** agregar `aria-live="polite"` a los bloques `under-17` y `under-20-professional` (AC24 — `requires-authorization` ya lo tiene)
    - [ ] **RUT:** agregar `aria-required="true"`, `[attr.aria-invalid]="rutDirty() && !rutValid()"`, `aria-describedby="pub-rut-error"` + `(blur)` → `markDirty('rut')` en el `<input>` de RUT
    - [ ] **Género:** agregar `aria-required="true"` en el `<select>` de género

- [x] **T2.4** — Refactor `public-personal-data`: reemplazar phone + canAdvanceFn + CTA siempre habilitado
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC26, AC-E3, AC-E6
  - **DoD:**
    - [ ] `_allDirty = signal(false)` agregado
    - [ ] `PhoneInputComponent` importado en `imports[]`
    - [ ] `<input type="tel">` reemplazado por `<app-phone-input [value]="formData().phone" [forceDirty]="_allDirty()" (valueChange)="patch('phone', $event)" />`
    - [ ] `canAdvanceFn()` actualizada:
      - Phone: `validatePhone(extractDigits(data.phone), extractDialCode(data.phone))` — o bien el facade recibe el E.164 completo y `validatePhone` acepta E.164 directamente
      - Names: `validateName(data.firstNames.trim())` y `validateName(data.paternalLastName.trim())` (AC-E4)
      - Date: `!isInvalidDate(data.birthDate)` Y `data.birthDate >= '1920-01-01'` Y `data.birthDate <= today`
    - [ ] `onNext()`:
      ```
      if (!canAdvance()) {
        _allDirty.set(true);
        // marcar todos los campos como dirty
        markDirty('rut'); markDirty('gender'); markDirty('firstNames'); ...
        focusFirstError(); // focus al primer campo con [aria-invalid="true"]
        return;
      }
      next.emit();
      ```
    - [ ] Botón "Continuar": **sin** `[disabled]="!canAdvance()"` (AC26 — siempre habilitado)
    - [ ] `focusFirstError()`: busca el primer `[aria-invalid="true"]` en el formulario y llama `.focus()`
    - [ ] `data-llm-action="submit-personal-data"` se mantiene en el botón
    - [ ] `app-email-input` recibe `[forceDirty]="_allDirty()"` (para dirty-all-on-submit)
    - [ ] Trim al emitir nombres: `patch('firstNames', value.trim())` en el emit final (AC16)
    - [ ] `public-personal-data.component.spec.ts` actualizado:
      - `canAdvanceFn` test con phone E.164 válido (`'+56912345678'`) en lugar de string de 8+ chars
      - Test nuevo: `canAdvanceFn` falla con nombre con dígitos
      - Test nuevo: `canAdvanceFn` falla con fecha imposible

---

## Fase 3 — Validación

- [x] **T3.1** — `npm run lint:arch` limpio
  - **DoD:**
    - [ ] Cero errores de arquitectura (colores hardcodeados, imports prohibidos, etc.)
    - [ ] Si hay warnings, resolverlos antes de continuar

- [x] **T3.2** — `npm run test:ci` verde completo
  - **DoD:**
    - [ ] Todas las suites pasan: `phone.utils`, `name.utils`, `email.utils`, `age.utils`, `public-personal-data`
    - [ ] Zero tests en rojo o skipped sin justificación

- [ ] **T3.3** — QA manual (golden path + edge cases)
  - **AC ref:** todos
  - **DoD (evidencia en `acceptance.md`):**
    - [ ] AC1: prefijo +56 preseleccionado al cargar el paso
    - [ ] AC2/AC3: número chileno válido → borde verde
    - [ ] AC4: "123" + blur → borde rojo "Número incompleto"
    - [ ] AC5: cambiar a +54 (AR) + 7 dígitos → válido
    - [ ] AC6: tipear letras en input de dígitos → ignoradas
    - [ ] AC8: email con mayúsculas → al salir del campo queda en minúsculas
    - [ ] AC9: email sin tocar → sin feedback
    - [ ] AC10: email inválido + blur → borde rojo
    - [ ] AC13: tipear "Juan123" → auto-strip, queda "Juan"
    - [ ] AC17/AC18: `<input type="date">` tiene `max=hoy` y `min=1920-01-01` en DevTools
    - [ ] AC19: ingresar "2001-02-29" + blur → "Fecha inválida"
    - [ ] AC20: "2000-02-29" → sin error (bisiesto válido)
    - [ ] AC21: inspeccionar DOM — todos los campos obligatorios tienen `aria-required="true"`
    - [ ] AC22/AC23: campo con error → `aria-invalid="true"` + `aria-describedby` apunta al mensaje
    - [ ] AC25: al cargar el formulario, sin tocar nada — ningún campo muestra error
    - [ ] AC26: presionar "Continuar" con formulario vacío → todos los campos muestran error + foco al primero
    - [ ] AC-E2: ingresar `USER@DOMAIN.COM` → al hacer blur queda `user@domain.com`
    - [ ] AC-E6: `+56 9 1234 5678` (con espacios) → payload emite `+56912345678`

---

## Fase 4 — Cierre

- [ ] **T4.1** — Actualizar índices
  - **DoD:**
    - [ ] `indices/COMPONENTS.md` — agregar `app-phone-input` (Átomo, path, inputs/outputs, estado ✅)
    - [ ] `indices/SERVICES.md` — agregar `phone.utils`, `name.utils` a la tabla de Pure Utilities
    - [ ] `indices/SERVICES.md` — actualizar `email.utils` con `normalizeEmail()` y `age.utils` con `isInvalidDate()`

- [ ] **T4.2** — Marcar spec como `done`
  - **DoD:**
    - [ ] `spec.md` → `Status: done`
    - [ ] `ROADMAP.md` → mover 0012-b de "En progreso" a "Done" con fecha y nota de verificación

- [ ] **T4.3** — Limpiar `specs/.active`
  - **DoD:**
    - [ ] `/spec-activate --clear` ejecutado
    - [ ] `specs/.active` queda vacío (sin ID activo)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
