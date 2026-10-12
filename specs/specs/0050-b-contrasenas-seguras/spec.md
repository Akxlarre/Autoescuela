# Spec 0050-b — Contraseñas seguras: una sola regla, visible mientras se escribe y exigida por el servidor

> **Status:** approved (decisiones del owner el 2026-10-12, ver §6)
> **Created:** 2026-10-12
> **Owner:** Benjamín
> **Priority:** P2 (seguridad de cuentas con acceso a datos personales; no bloquea el piloto)

---

## 1. Contexto de negocio

**Origen:** observación del owner el 2026-10-12, al activar una secretaria de prueba (caso L01 de
`ASG-i-034`): la pantalla donde se crea la contraseña no pide ni muestra nada sobre qué tan segura
debe ser.

### Cómo está hoy (leído en el código el 2026-10-12)

| Dónde se fija una contraseña | Quién pasa por ahí | Regla | Confirmación | Qué ve la persona |
|---|---|---|---|---|
| `features/auth/force-password-change` (rutas `/force-password-change` y `/recuperar-contrasena`) | Secretarias, instructores y alumnos al **activar** su cuenta por enlace (fix-182-b, fix-168/169-m); cualquiera al **recuperar** la clave (fix-181-b) | mínimo 8 | **No** (un solo campo) | Solo "Mínimo 8 caracteres" como placeholder |
| `shared/components/ajustes-drawer` → Cambiar Contraseña | Cualquier usuario con sesión (fix-216-b: pide la actual) | mínimo 8 | Sí | Solo "Mínimo 8 caracteres" como placeholder |

- El mínimo vive en `PASSWORD_MIN_LENGTH = 8` (`core/utils/auth-errors.utils.ts`, hotfix-059-b),
  igual al de Supabase Auth en producción. **No hay ningún requisito de composición**, ni en la app
  ni en Auth (`password_requirements = ""`): `12345678` o `aaaaaaaa` son claves válidas.
- No hay otros lugares: el login no fija claves, la inscripción pública no crea contraseña y ninguna
  Edge Function asigna claves temporales (todas las cuentas nacen sin contraseña y se activan por enlace).
- Las cuentas dan acceso a datos personales de alumnos (RUT, teléfono, domicilio, documentos).

### Qué se quiere

Que quien crea o cambia su contraseña **sepa qué se le pide mientras escribe**, que la regla sea
**la misma en todas partes**, y que **no dependa solo de la pantalla** (el servidor la exige igual).

## 2. User Stories

- Como **persona que activa su cuenta**, quiero ver qué requisitos debe cumplir mi contraseña y
  cuáles ya cumplí, para no adivinar ni chocar con un error al guardar.
- Como **dueño de la escuela**, quiero que no se puedan usar claves triviales en cuentas que ven
  datos personales de alumnos.
- Como **secretaria o instructor** (no técnico), quiero una regla razonable que pueda cumplir sin
  anotar la clave en un papel.

## 3. Propuesta (a validar; ver §6)

1. **Una regla, escrita una vez.** Función pura `evaluatePassword(password, contexto)` en
   `core/utils/` que devuelve la lista de requisitos con su estado (cumplido / pendiente) y un nivel
   de fortaleza. Las dos pantallas la usan; `PASSWORD_MIN_LENGTH` pasa a derivarse de ella.
2. **Requisitos visibles mientras se escribe.** Componente presentacional `app-password-requirements`
   (lista que se va marcando + barra de fortaleza), usado en las dos pantallas. El botón de guardar
   sigue deshabilitado hasta cumplirlos todos.
3. **Regla propuesta (recomendada):** mínimo **10 caracteres**, con **letras y números**, y que **no
   contenga** el nombre, el correo ni el RUT de la persona. Sin exigir símbolos ni mayúsculas, sin
   caducidad periódica.
4. **El servidor exige lo mismo.** Supabase Auth: `minimum_password_length = 10` y
   `password_requirements = "letters_digits"` (configuración del proyecto, no migración SQL). Los
   errores de Auth por clave débil se traducen a un mensaje claro (`mapAuthError`).
5. **Confirmación al activar.** `force-password-change` pide repetir la contraseña (hoy un error de
   tipeo deja a la persona fuera hasta que pida recuperar la clave).
6. **Cuentas existentes:** no se fuerza a nadie a cambiar su clave actual; la regla nueva aplica la
   próxima vez que la cambie o la recupere.

## 4. Acceptance Criteria

- **AC1 — Requisitos visibles:** Given la pantalla de crear/recuperar contraseña o Ajustes → Cambiar
  Contraseña, When la persona escribe, Then ve cada requisito marcado como cumplido o pendiente y un
  indicador de fortaleza que se actualiza con cada tecla.
- **AC2 — No se guarda una clave que no cumple:** When falta algún requisito, Then el botón de
  guardar está deshabilitado y no se llama a Auth.
- **AC3 — Misma regla en las dos pantallas:** una clave aceptada en una es aceptada en la otra, y
  una rechazada en una es rechazada en la otra (misma función).
- **AC4 — No contiene datos propios:** When la clave contiene el nombre, la parte local del correo o
  el cuerpo del RUT de la persona, Then el requisito "No uses tu nombre, correo ni RUT" queda pendiente.
- **AC5 — El servidor también la exige:** When se llama a Auth directamente (sin la pantalla) con una
  clave que no cumple largo o composición, Then Auth la rechaza.
- **AC6 — Confirmación al activar:** Given `/force-password-change` o `/recuperar-contrasena`, When
  las dos contraseñas no coinciden, Then no se puede guardar y se indica que no coinciden.
- **AC7 — Mensaje claro si Auth rechaza:** When Auth responde "clave débil", Then se muestra un
  mensaje en español que dice qué falta, no un error genérico.
- **AC8 — Cuentas existentes intactas:** un usuario con una clave anterior que no cumple la regla
  nueva sigue pudiendo iniciar sesión.
- **AC9 — Claves filtradas (si el plan lo permite):** se intenta activar `password_hibp_enabled`; si
  queda activo, una clave conocida en brechas se rechaza con un mensaje claro; si el plan no lo
  permite, se documenta el motivo y el AC se cierra como "no disponible en el plan actual".
- **AC-E1 — Accesible:** la lista de requisitos se anuncia a lectores de pantalla (`aria-live`) y el
  estado no depende solo del color (ícono + texto).
- **AC-E2 — Pegar y gestores de contraseñas:** se puede pegar la clave y los gestores la rellenan;
  los requisitos se evalúan igual.

## 5. Fuera de alcance

- Segundo factor (MFA), bloqueo por intentos fallidos y caducidad periódica de claves.
- Contratar un plan de pago de Supabase solo para el rechazo de claves filtradas (ver AC9).
- Forzar el cambio de clave a las cuentas existentes.

## 6. Decisiones del owner (2026-10-12)

1. **Exigencia:** la recomendada — mínimo **10 caracteres**, con **letras y números**, y que **no
   contenga** el nombre, el correo ni el RUT de la persona. Sin símbolos ni mayúsculas obligatorias,
   sin caducidad.
2. **Claves filtradas:** intentarlo. El proyecto está en el plan **gratuito** de Supabase
   (`password_hibp_enabled = false` hoy); se intenta activar al implementar y, si el plan no lo
   permite, queda documentado como pendiente sin bloquear la spec (AC9).
3. **Alumnos:** misma regla que el personal.

## 7. Notas técnicas preliminares (para el plan)

- Cambiar `minimum_password_length` y `password_requirements` es **configuración de producción**
  (Management API o panel), con aprobación del owner; `supabase/config.toml` se actualiza para que
  el entorno local quede igual.
- `hotfix-059-b` dejó un test que amarra `PASSWORD_MIN_LENGTH` al mínimo de Auth: se actualiza junto.
- Tests e2e existentes que escriben claves (`cambiar-clave-actual.spec.ts`, `cambiar-clave-real.spec.ts`)
  usan claves que ya cumplen la regla propuesta; verificar al implementar.
