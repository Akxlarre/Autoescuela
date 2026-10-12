# Acceptance 0050-b — Contraseñas seguras

> **Estado (2026-10-12):** ✅ cerrada. App publicada en `v0.2.1` y configuración de Supabase Auth
> aplicada en producción (después del deploy, con aprobación del owner). AC9 no disponible en el
> plan actual.

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — Requisitos visibles | ✅ | `e2e/contrasena-requisitos.spec.ts` (2/2): la lista de 4 requisitos y la fortaleza cambian al escribir, en las dos pantallas. Capturas en `evidencia/` |
| AC2 — No se guarda una clave que no cumple | ✅ | Mismo e2e: botón deshabilitado con `camino202` (9 caracteres) aun con la confirmación correcta; 0 llamadas a Auth |
| AC3 — Misma regla en las dos pantallas | ✅ | Las dos usan `evaluatePassword()`; el e2e corre la misma tabla de casos en ambas |
| AC4 — Sin datos propios | ✅ | `password-policy.utils.spec.ts` (nombre, correo, RUT; sin distinguir mayúsculas ni tildes; "Ana" no bloquea "banana") + e2e con el nombre real de la cuenta |
| AC5 — El servidor también la exige | ✅ | Auth de producción: `password_min_length = 10`, letras + dígitos obligatorios. `e2e/contrasena-servidor.spec.ts` (`E2E_CLAVE_REAL=1`): directo contra Auth, rechaza con `weak_password` una clave de 9 caracteres, una sin números y una sin letras |
| AC6 — Confirmación al activar | ✅ | e2e "Primer ingreso": sin confirmación o distinta → botón deshabilitado y "Las contraseñas no coinciden." |
| AC7 — Mensaje claro si Auth rechaza | ✅ | `auth-errors.utils.spec.ts`: `weak_password` con motivos `length` / `characters` / `pwned` → mensaje en español |
| AC8 — Cuentas existentes intactas | ✅ | Mismo test: la cuenta de prueba entra con su clave de siempre antes y después de cada intento rechazado |
| AC9 — Claves filtradas | ➖ No disponible | Se intentó activar `password_hibp_enabled`: Supabase respondió 402 "available on Pro Plans and up". El proyecto está en plan gratuito; queda fuera (§5). La app ya sabe mostrar ese rechazo (`pwned`) si algún día se activa |
| AC-E1 — Accesible | ✅ | Lista con `aria-live="polite"`; cada requisito lleva ícono + texto + "(cumplido)/(pendiente)" para lector de pantalla |
| AC-E2 — Pegar y gestores | ✅ | Los campos no bloquean el pegado y llevan `autocomplete="new-password"`; el valor puesto de una vez se evalúa igual (e2e) |

## Verificación

- vitest: `password-policy.utils.spec.ts` 24/24, `auth-errors.utils.spec.ts` 12/12, `auth.facade.spec.ts` 34/34.
- e2e: `contrasena-requisitos.spec.ts` 2/2 (Auth interceptado: no cambia ninguna clave).
- `lint:arch` 0 errores (182 advertencias). `ng build` OK.

## Hallazgo durante la verificación visual

Con fortaleza "Débil" la barra no pintaba ningún tramo: la clase del fondo gris le ganaba a la roja
por el orden del CSS generado. Corregido aplicando el gris solo a los tramos vacíos.

## Cierre

- Deploy `v0.2.1` completado el 2026-10-12 (GitHub Actions, success).
- Configuración de Auth aplicada por la Management API después del deploy: el orden evita que la app
  anterior (que aceptaba 8 caracteres) dejara escribir claves que el servidor rechaza.
- AC7 comprobado también contra los mensajes reales de Auth: "al menos 10 caracteres" y "letras y números".
