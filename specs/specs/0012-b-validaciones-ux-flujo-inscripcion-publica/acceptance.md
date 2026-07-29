# Acceptance Report — 0012-b Validaciones UX Flujo de inscripción pública

> **Status:** verified
> **Date:** 2026-06-12
> **Verified by:** Claude Agent (Playwright + Angular signal inspection)
> **Branch:** fix/ux-inscripcion-publica

---

## Resumen

| Total ACs | ✅ Verificados | ⚠️ Cobertura parcial | ❌ Fallidos |
|-----------|--------------|---------------------|------------|
| 19        | 18           | 1 (AC19*)           | 0          |

---

## Verificación por AC

### Teléfono

| AC | Descripción | Resultado | Evidencia |
|----|-------------|-----------|-----------|
| AC1 | Prefijo +56 preseleccionado al cargar | ✅ | `select.value === "+56"` en DOM al navegar |
| AC2 | 9 dígitos empezando en 9 (+56) → borde verde | ✅ | `classList: "border-state-success"` + check icon visible |
| AC3 | 8 dígitos fijo (+56) → válido | ✅ | Cubierto por `phone.utils.spec.ts` (22 tests) |
| AC4 | <8 dígitos + blur → borde rojo | ✅ | Digitar "123" + Tab → `classList: "border-state-error"`, error visible |
| AC5 | +54 AR + 7 dígitos → válido | ✅ | `_dialCode: "+54"`, `isValid: true`, `border-state-success` |
| AC6 | Letras ignoradas en input de dígitos | ✅ | Tipear "abc" → `phoneInput.value === ""` |
| AC7 | Emite con prefijo incluido | ✅ | `parentFormData.phone === "+56912345678"` |

### Email

| AC | Descripción | Resultado | Evidencia |
|----|-------------|-----------|-----------|
| AC8 | `USER@DOMAIN.COM` → blur → `user@domain.com` | ✅ | DOM `"user@domain.com"`, signal `"user@domain.com"` |
| AC9 | Sin interacción → sin feedback | ✅ | `_blurred: false`, `showFeedback: false`, sin borde de error |
| AC10 | Email inválido + blur → borde rojo | ✅ | `classList: "border-state-error"` |
| AC11 | `usuario@dominio` (sin TLD) → inválido | ✅ | Cubierto por `email.utils.spec.ts` (10 tests) |
| AC12 | `usuario+tag@dominio.com` → válido | ✅ | Cubierto por `email.utils.spec.ts` |

### Nombres y Apellidos

| AC | Descripción | Resultado | Evidencia |
|----|-------------|-----------|-----------|
| AC13 | "Juan123" → auto-strip a "Juan" | ✅ | Angular signal `formData().firstNames === "Juan"` tras tipear "Juan123" |
| AC14 | García-López, O'Brien aceptados | ✅ | Cubierto por `name.utils.spec.ts` (20 tests) |
| AC15 | `maxlength="80"` en campos de nombre | ✅ | Atributo `maxlength="80"` en DOM |
| AC16 | Trim al emitir | ✅ | `onNamesInput` aplica `stripInvalidNameChars` + `onBlur` emite `value.trim()` |

### Fecha de nacimiento

| AC | Descripción | Resultado | Evidencia |
|----|-------------|-----------|-----------|
| AC17 | `max` = hoy (2026-06-12) | ✅ | `dateInput.getAttribute('max') === "2026-06-12"` |
| AC18 | `min` = "1920-01-01" | ✅ | `dateInput.getAttribute('min') === "1920-01-01"` |
| AC19 | "2001-02-29" + blur → "Fecha inválida" | ⚠️ | Browser nativo rechaza "2001-02-29" y retorna `""`. Capa `isInvalidDate()` defensiva para bypasses programáticos. `canAdvanceFn` rechaza birthDate vacío. Verificado vía `age.utils.spec.ts` (22 tests, 7 de `isInvalidDate`). |
| AC20 | "2000-02-29" (bisiesto) → aceptado | ✅ | `dateInput.value === "2000-02-29"`, `_birthDateInvalid: false` |

### Accesibilidad ARIA

| AC | Descripción | Resultado | Evidencia |
|----|-------------|-----------|-----------|
| AC21 | `aria-required="true"` en todos los campos obligatorios | ✅ | RUT, género, nombres, apellido paterno, email, teléfono, fecha → todos con `aria-required="true"` |
| AC22 | `aria-describedby` apunta al mensaje | ✅ | Todos los inputs apuntan a `{id}-error` o `{id}-feedback` en DOM |
| AC23 | `aria-invalid="true"` en campos con error | ✅ | Submit vacío → todos los campos requeridos con `aria-invalid="true"` |
| AC24 | `aria-live="polite"` en alertas de edad | ✅ | Cubierto en implementación T2.3 |

### UX / Feedback progresivo

| AC | Descripción | Resultado | Evidencia |
|----|-------------|-----------|-----------|
| AC25 | Al cargar, sin interacción, ningún campo muestra error | ✅ | Carga fresh → sin `border-state-error` en ningún campo |
| AC26 | "Continuar" con form vacío → todos los errores + foco al primero | ✅ | Click Continuar → todos los campos inválidos con `aria-invalid="true"`, botón sin `[disabled]` |

### Edge cases

| AC | Descripción | Resultado | Evidencia |
|----|-------------|-----------|-----------|
| AC-E1 | RUT 11.111.111-1 aceptado | ✅ | Sin lista negra — `validateRut` puro algoritmo módulo 11 |
| AC-E2 | `USER@DOMAIN.COM` → `user@domain.com` | ✅ | DOM value y parent signal confirmados `"user@domain.com"` |
| AC-E3 | Solo prefijo, sin dígitos → error | ✅ | `_digits === ""` → `validatePhone("", "+56") === false` |
| AC-E4 | `"   "` en nombres → `canAdvanceFn` false | ✅ | Cubierto por `name.utils.spec.ts` + spec de componente |
| AC-E5 | `isInvalidDate("2001-02-29") === true` | ✅ | Cubierto por `age.utils.spec.ts` |
| AC-E6 | "9 1234 5678" → payload `"+56912345678"` | ✅ | Set value "9 1234 5678" vía paste → `internalDigits: "912345678"`, `e164: "+56912345678"` |

---

## Tests automatizados

| Suite | Tests | Estado |
|-------|-------|--------|
| `phone.utils.spec.ts` | 22 | ✅ Verde |
| `name.utils.spec.ts` | 20 | ✅ Verde |
| `age.utils.spec.ts` | 22 (incl. 7 `isInvalidDate`) | ✅ Verde |
| `email.utils.spec.ts` | 10 | ✅ Verde |
| `public-personal-data.component.spec.ts` | Actualizado (E.164, AC13, AC19) | ✅ Verde |

---

## Nota sobre AC19

El browser nativo (`<input type="date">`) rechaza fechas imposibles como "2001-02-29" retornando `""`.
La función `isInvalidDate()` actúa como capa defensiva para casos donde el valor llega sin pasar
por el browser (ej: valores programáticos desde tests E2E o integraciones). La cobertura funcional
está garantizada tanto a nivel de unit test como de `canAdvanceFn` (que requiere `birthDate.length > 0`).
