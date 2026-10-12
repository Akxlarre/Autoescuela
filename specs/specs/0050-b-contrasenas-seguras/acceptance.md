# Acceptance 0050-b — Contraseñas seguras

> **Estado (2026-10-12):** código listo y verificado. **Pendiente la configuración de Supabase Auth
> en producción** (AC5, AC9), que se aplica DESPUÉS de publicar esta versión de la app: si se
> aplicara antes, la app publicada (que aún acepta 8 caracteres) dejaría escribir claves que el
> servidor rechaza.

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — Requisitos visibles | ✅ | `e2e/contrasena-requisitos.spec.ts` (2/2): la lista de 4 requisitos y la fortaleza cambian al escribir, en las dos pantallas. Capturas en `evidencia/` |
| AC2 — No se guarda una clave que no cumple | ✅ | Mismo e2e: botón deshabilitado con `camino202` (9 caracteres) aun con la confirmación correcta; 0 llamadas a Auth |
| AC3 — Misma regla en las dos pantallas | ✅ | Las dos usan `evaluatePassword()`; el e2e corre la misma tabla de casos en ambas |
| AC4 — Sin datos propios | ✅ | `password-policy.utils.spec.ts` (nombre, correo, RUT; sin distinguir mayúsculas ni tildes; "Ana" no bloquea "banana") + e2e con el nombre real de la cuenta |
| AC5 — El servidor también la exige | ⏳ | Pendiente: `password_min_length = 10` + letras y dígitos en Auth (producción), tras publicar la app |
| AC6 — Confirmación al activar | ✅ | e2e "Primer ingreso": sin confirmación o distinta → botón deshabilitado y "Las contraseñas no coinciden." |
| AC7 — Mensaje claro si Auth rechaza | ✅ | `auth-errors.utils.spec.ts`: `weak_password` con motivos `length` / `characters` / `pwned` → mensaje en español |
| AC8 — Cuentas existentes intactas | ⏳ | Se comprueba junto con AC5 (login con la cuenta de prueba de siempre tras el cambio de configuración). Auth solo valida la regla al fijar una clave |
| AC9 — Claves filtradas | ⏳ | Pendiente: intentar `password_hibp_enabled`; el proyecto está en plan gratuito |
| AC-E1 — Accesible | ✅ | Lista con `aria-live="polite"`; cada requisito lleva ícono + texto + "(cumplido)/(pendiente)" para lector de pantalla |
| AC-E2 — Pegar y gestores | ✅ | Los campos no bloquean el pegado y llevan `autocomplete="new-password"`; el valor puesto de una vez se evalúa igual (e2e) |

## Verificación

- vitest: `password-policy.utils.spec.ts` 24/24, `auth-errors.utils.spec.ts` 12/12, `auth.facade.spec.ts` 34/34.
- e2e: `contrasena-requisitos.spec.ts` 2/2 (Auth interceptado: no cambia ninguna clave).
- `lint:arch` 0 errores (182 advertencias). `ng build` OK.

## Hallazgo durante la verificación visual

Con fortaleza "Débil" la barra no pintaba ningún tramo: la clase del fondo gris le ganaba a la roja
por el orden del CSS generado. Corregido aplicando el gris solo a los tramos vacíos.

## Para cerrar la spec

1. Mergear y publicar la app.
2. Aplicar la configuración de Auth en producción (con aprobación) y correr AC5, AC8 y AC9.
