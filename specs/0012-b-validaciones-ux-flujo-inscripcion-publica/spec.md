# Spec 0012-b — Validaciones UX — Flujo de inscripción pública

> **Status:** done
> **Created:** 2026-06-12
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Auditoría de código + análisis de edge cases post-spec-0009/0010

**Persona afectada:** Alumno potencial (usuario público sin autenticación)

**Problema que resuelve:**
El formulario de datos personales del flujo público (`app-public-personal-data`) tiene validaciones
inconsistentes y parciales: el teléfono solo verifica longitud mínima (8 chars), los campos de
nombre aceptan dígitos, las fechas permiten valores imposibles (futuro, año 1800), y ningún input
tiene atributos ARIA que conecten los mensajes de error al campo. El usuario puede llegar al submit
con datos estructuralmente inválidos o recibir feedback confuso. Además, usuarios internacionales
no tienen forma de ingresar un prefijo de país diferente a +56.

**Hipótesis de valor:**
Reducir la tasa de abandono del wizard en el paso de datos personales y los rechazos en la
Edge Function por datos malformados, con un formulario que guíe al usuario de forma proactiva
y sea accesible para lectores de pantalla.

---

## 2. User Stories

- **US1**: Como alumno potencial chileno, quiero un input de teléfono con selector de prefijo
  (+56 por defecto) y validación del formato para saber si mi número es correcto antes de avanzar.
- **US2**: Como alumno potencial extranjero, quiero poder seleccionar el prefijo de mi país
  para que la escuela pueda contactarme por WhatsApp correctamente.
- **US3**: Como alumno potencial, quiero que los campos de nombre rechacen dígitos y símbolos
  inválidos para no cometer errores tipográficos que afecten mi certificado.
- **US4**: Como alumno potencial, quiero que la fecha de nacimiento no me deje ingresar fechas
  futuras o absurdamente antiguas para evitar un bloqueo silencioso.
- **US5**: Como alumno potencial con discapacidad visual, quiero que los mensajes de error
  estén correctamente asociados a sus inputs vía ARIA para navegar con lector de pantalla.
- **US6**: Como alumno potencial, quiero recibir feedback de validación campo a campo
  (al salir del campo, no solo al presionar "Continuar") para corregir errores de forma
  natural y sin frustración.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC es verificable con Playwright o con un test unitario en `core/utils/`.

### Teléfono (Phone field)

- **AC1** — Prefijo selector:
  Given que el usuario llega al paso de datos personales,
  When carga el formulario,
  Then el campo teléfono muestra un selector de prefijo con Chile (+56) preseleccionado
  y un input de dígitos separado.

- **AC2** — Validación móvil chileno:
  Given que el prefijo es +56,
  When el usuario ingresa 9 dígitos comenzando con 9 (ej: 912345678),
  Then el campo muestra feedback verde "Número válido".

- **AC3** — Validación fijo chileno:
  Given que el prefijo es +56,
  When el usuario ingresa 8 dígitos (ej: 22345678),
  Then el campo muestra feedback verde "Número válido".

- **AC4** — Rechazo número corto:
  Given que el prefijo es +56,
  When el usuario ingresa menos de 8 dígitos y sale del campo (blur),
  Then el campo muestra feedback rojo "Número incompleto".

- **AC5** — Prefijo internacional:
  Given que el usuario selecciona un prefijo distinto a +56 (ej: +54 Argentina),
  When ingresa entre 7 y 15 dígitos,
  Then el campo valida como válido (E.164: 7–15 dígitos).
  Lista de prefijos disponibles: 🇨🇱 +56 (default), 🇦🇷 +54, 🇵🇪 +51, 🇧🇴 +591,
  🇨🇴 +57, 🇻🇪 +58, 🇪🇸 +34, 🇺🇸/🇨🇦 +1, y "Otro" (input libre de 1–4 dígitos).

- **AC6** — Solo dígitos en el input:
  Given el campo de dígitos del teléfono,
  When el usuario intenta ingresar letras o símbolos (excepto espacios para formato),
  Then los caracteres son ignorados (keydown prevention o auto-strip).

- **AC7** — Valor emitido incluye prefijo:
  Given un teléfono válido (+56, 912345678),
  When el componente emite `dataChange`,
  Then `data.phone` contiene el número completo con prefijo: "+56912345678"
  (o "+56 9 1234 5678" — con espacios de formato estándar chileno).

### Email

- **AC8** — Normalización a minúsculas:
  Given que el usuario ingresa `USUARIO@DOMINIO.CL`,
  When el componente emite el valor (blur o submit),
  Then `data.email` es `usuario@dominio.cl`.

- **AC9** — Feedback post-blur:
  Given que el campo email está vacío y el usuario no ha interactuado,
  When no ha tocado el campo,
  Then NO se muestra feedback de error (evitar mostrar error antes de interacción).

- **AC10** — Feedback en blur:
  Given que el usuario ingresa un email inválido (ej: "noesunemail"),
  When sale del campo (blur),
  Then el campo muestra borde rojo y mensaje "Correo inválido".

- **AC11** — Regex: dominio sin TLD bloqueado:
  Given el email `usuario@dominio` (sin TLD),
  Then `validateEmail()` retorna `false`.

- **AC12** — Email con plus sign aceptado:
  Given el email `usuario+tag@dominio.com`,
  Then `validateEmail()` retorna `true`.

### Nombres y Apellidos

- **AC13** — Sin dígitos en nombres:
  Given que el usuario ingresa "Juan123" en el campo Nombres,
  When escribe el último carácter,
  Then los dígitos son auto-strippeados O el campo muestra feedback rojo
  "El nombre solo puede contener letras".

- **AC14** — Caracteres especiales permitidos:
  Given nombres como "García-López", "María José" o "O'Brien",
  Then son aceptados sin error.

- **AC15** — Longitud máxima:
  Given que el usuario intenta ingresar más de 80 caracteres en un campo de nombre,
  Then el input no acepta más caracteres (`maxlength="80"`).

- **AC16** — Trim al emitir:
  Given que el usuario ingresa "  Juan  " con espacios en los extremos,
  When se emite `dataChange`,
  Then `data.firstNames` es `"Juan"` (sin espacios perimetrales).

### Fecha de nacimiento

- **AC17** — No permite fechas futuras:
  Given el input de fecha de nacimiento,
  Then el atributo `max` es igual a la fecha de hoy (YYYY-MM-DD)
  y el navegador/validación impide seleccionar una fecha futura.

- **AC18** — No permite fechas absurdamente antiguas:
  Given el input de fecha de nacimiento,
  Then el atributo `min` es `"1920-01-01"`.

- **AC19** — Fecha imposible:
  Given que el usuario ingresa manualmente `2001-02-29` (no es año bisiesto),
  When sale del campo (blur),
  Then se muestra el mensaje "Fecha inválida" y el campo tiene borde rojo.

- **AC20** — Fecha de año bisiesto válida:
  Given `2000-02-29` (año bisiesto),
  Then es aceptada sin error.

### Accesibilidad (ARIA)

- **AC21** — `aria-required`:
  Given todos los campos obligatorios del formulario (RUT, Género, Nombres, Apellido paterno,
  Email, Teléfono, Fecha nacimiento),
  Then cada input tiene `aria-required="true"`.

- **AC22** — `aria-describedby`:
  Given un campo con mensaje de validación visible (error o éxito),
  Then el input tiene `aria-describedby` apuntando al `id` del mensaje.

- **AC23** — `aria-invalid`:
  Given un campo que muestra estado de error,
  Then el input tiene `aria-invalid="true"`;
  en estado válido o sin interacción, `aria-invalid="false"`.

- **AC24** — `aria-live` en alertas de edad:
  Given las alertas de edad (under-17, requires-authorization, under-20-professional),
  Then tienen `aria-live="polite"` para que el lector de pantalla las anuncie al cambiar.
  *(Nota: el bloque `requires-authorization` ya tiene `aria-live="polite"` — verificar los otros dos.)*

### UX / Feedback progresivo

- **AC25** — Dirty-state por campo:
  Given que el usuario aún no ha interactuado con un campo,
  Then ese campo NO muestra ningún estado de error.
  Given que el usuario interactuó con un campo (blur) y dejó un valor inválido,
  Then el campo muestra feedback de error inmediatamente.

- **AC26** — Submit siempre habilitado + errores explícitos al intentar avanzar:
  Given que el usuario presiona "Continuar" con uno o más campos inválidos,
  Then TODOS los campos con error muestran su mensaje inline simultáneamente
  (dirty-all-on-submit) y el foco se mueve al primer campo con error.
  El botón "Continuar" está **siempre habilitado** (no `[disabled]`).
  *Convención: Stripe, Airbnb, Google Forms — CTA habilitado + errores explícitos
  es más accesible que un botón misteriosamente bloqueado (WCAG 3.3.1).*

---

### Edge cases obligatorios

- **AC-E1** — RUT 11.111.111-1:
  Given el RUT "11.111.111-1" (matemáticamente válido),
  Then es aceptado sin lista negra.

- **AC-E2** — Email `USER@DOMAIN.COM` normalizado:
  Given `USER@DOMAIN.COM`,
  When se emite el valor,
  Then `data.email === "user@domain.com"`.

- **AC-E3** — Teléfono con solo el prefijo:
  Given que el usuario solo ha seleccionado el prefijo sin ingresar dígitos,
  Then el campo muestra error "Ingresa tu número".

- **AC-E4** — Nombre con solo espacios:
  Given `"   "` en el campo Nombres,
  When se evalúa `canAdvanceFn`,
  Then retorna `false` (el trim reduce a vacío, length < 2).

- **AC-E5** — Fecha 29/02 en año no bisiesto:
  Given `"2001-02-29"`,
  Then `isInvalidDate("2001-02-29")` retorna `true`.

- **AC-E6** — Teléfono con espacios extra como "9 1234 5678":
  Given "+56 9 1234 5678" (con espacios de formato),
  When se normaliza para el payload de la Edge Function,
  Then se emite "+56912345678" (sin espacios internos).

---

## 4. Out of scope

- ❌ Validación de pasaporte / DNI extranjero como alternativa al RUT chileno
- ❌ Integración con APIs de verificación de email en tiempo real (ej: ZeroBounce, Hunter.io)
- ❌ Verificación del número de teléfono por OTP/SMS
- ❌ Selector con más de ~15 prefijos internacionales (solo los más comunes de Latinoamérica + España)
- ❌ Cambio del campo `gender` a opciones no binarias (requiere migración de BD y cambio de enum)
- ❌ Validación de dirección con API de geocodificación (el campo es libre y opcional)
- ❌ Detección de emails temporales/disposables
- ❌ Cambios en la Edge Function `public-enrollment` (solo afecta la UI/validaciones client-side)
- ❌ Pasos del wizard distintos a `personal-data` (psych-test, schedule, etc. son out of scope)

---

## 5. Dependencias

### Specs previas
- `0009-rediseno-ux-flujo-inscripcion-online-publico` — base del wizard (debe estar `done`) ✅
- `0010-hardening-seguridad-flujo-inscripcion-publico` — honeypot y sanitización (debe estar `done`) ✅
- `fix-001-public-personal-data-validaciones` — fixes anteriores en este mismo componente ✅

### Capacidades del proyecto que se asumen existentes
- `validateRut()` / `formatRut()` en `core/utils/rut.utils.ts` ✅
- `validateEmail()` en `core/utils/email.utils.ts` ✅
- `getAgeStatus()` / `calcAge()` en `core/utils/age.utils.ts` ✅
- `canAdvanceFn()` exportada desde `public-personal-data.component.ts` ✅
- `app-email-input` — componente de email reutilizable ✅
- `app-async-btn` — botón con loading state (si se necesita) ✅

### Capacidades nuevas requeridas
- Nueva util `validatePhone(digits: string, dialCode: string): boolean` en `core/utils/phone.utils.ts`
- Nueva util `normalizePhone(digits: string, dialCode: string): string` — emite E.164 sin espacios
- Nueva util `isInvalidDate(dateStr: string): boolean` en `core/utils/age.utils.ts` (extiende el módulo existente)
- Nueva util `validateName(name: string): boolean` en `core/utils/name.utils.ts`
- Nuevo componente `app-phone-input` en `shared/components/phone-input/` (Dumb, standalone)
  — **Scope: solo flujo público en esta spec**; el flujo admin lo adopta en una spec posterior.
  — No usa CVA (ControlValueAccessor) para mantener la consistencia con los otros campos del wizard
    que usan el patrón `input()` + `output()` signal.
- `EnrollmentPersonalData.phone` ya es `string` — el formato emitido pasa a ser E.164: `"+56912345678"`

---

## 6. Datos y modelo (preliminar)

- **Tablas afectadas:** Ninguna — validaciones 100% client-side + normalización antes del payload
- **Modelos UI modificados:**
  - `EnrollmentPersonalData.phone` ya es `string` — el formato emitido cambia a `"+56XXXXXXXXX"` (con prefijo integrado)
- **Edge Function `public-enrollment`:** No requiere cambios (recibe `phone` como string, ya existente)
- **Tests afectados:** `canAdvanceFn` tests (actualizar casos de teléfono), nuevas suites para las utils nuevas

---

## 7. UX y flujos (preliminar)

**Pantalla afectada:** `/inscripcion` → paso `personal-data` → `app-public-personal-data`

**Componente nuevo `app-phone-input`:**
```
[ 🇨🇱 +56 ▼ ]  [ 9 1234 5678           ]
                 └─ solo dígitos, placeholder contextual según país
```
- Selector de prefijo: `<select>` nativo (no p-select — consistencia con otros campos del wizard)
  con bandera emoji + dial code. CL +56 preseleccionado.
- Lista: CL +56, AR +54, PE +51, BO +591, CO +57, VE +58, ES +34, US/CA +1, Otro (libre)
- Placeholder contextual: "+56 → '9 1234 5678'"; "+1 → '(555) 123-4567'"; resto → '0000 0000'
- Feedback: borde verde/rojo + mensaje bajo el input (mismo patrón que RUT)

**Feedback progresivo — convención blur-on-interact + dirty-all-on-submit:**
- Estado inicial: sin feedback (neutral — ningún campo muestra error al cargar)
- Al escribir: RUT y teléfono muestran feedback inline en tiempo real (ya establecido para RUT)
- Al salir del campo (blur): el campo muestra su estado definitivo (válido/inválido)
- Al presionar "Continuar": todos los campos con error muestran mensaje + foco va al primero
- Botón "Continuar": **siempre habilitado** (ya no `[disabled]`)

**Atributos ARIA objetivo:**
```html
<input
  id="pub-names"
  aria-required="true"
  aria-invalid="true|false"
  aria-describedby="pub-names-error"
/>
<p id="pub-names-error" role="alert">...</p>
```

---

## 8. Métricas de éxito post-launch

- Reducción de errores `INVALID_PHONE` / `INVALID_EMAIL` en logs de la Edge Function
- Reducción del % de abandonos en el paso `personal-data` (comparar con baseline)
- 0 reportes de "no sé qué está mal en el formulario" en feedback de usuarios

---

## 9. Notas / decisiones

- [x] **AC26 — CTA siempre habilitado + dirty-all-on-submit.**
  Convención Stripe/Google/Airbnb (WCAG 3.3.1). El botón "Continuar" no usa `[disabled]`.
  Al presionar con campos inválidos: muestra todos los errores + foco al primero.

- [x] **Prefijos internacionales: CL, AR, PE, BO, CO, VE, ES, US/CA + "Otro".**
  Lista corta enfocada en Latinoamérica + España + norteamérica. Cubre ~95% de los casos reales.

- [x] **`app-phone-input` scope: solo flujo público en esta spec.**
  Componente Dumb compartido en `shared/components/phone-input/` — el flujo admin lo adopta
  en una spec posterior sin trabajo extra aquí.

- [ ] **[VERIFICACIÓN PREVIA AL PLAN]** Revisar `specs/fix-001-public-personal-data-validaciones/`
  para confirmar qué ya se implementó y no duplicar trabajo.

---

## Changelog

- 2026-06-12 — draft inicial por Akxlarre (generado con investigación de código por agente)
