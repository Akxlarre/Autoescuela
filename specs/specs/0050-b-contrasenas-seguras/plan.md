# Plan 0050-b — Contraseñas seguras

> **Status:** aprobado (owner, 2026-10-12)

## Diseño

### 1. La regla, una sola vez — `core/utils/password-policy.utils.ts` (función pura + spec)

```ts
export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordContext { name?: string | null; email?: string | null; rut?: string | null }
export type PasswordRequirementId = 'length' | 'letter' | 'digit' | 'not-personal';
export interface PasswordRequirement { id: PasswordRequirementId; label: string; met: boolean }
export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export function evaluatePassword(password: string, ctx?: PasswordContext): {
  requirements: PasswordRequirement[];  // en orden fijo, siempre las 4
  valid: boolean;                       // todas cumplidas
  strength: PasswordStrength;
};
```

- **`length`** ≥ 10 · **`letter`** al menos una letra (`\p{L}`) · **`digit`** al menos un número ·
  **`not-personal`**: no contiene (sin distinguir mayúsculas ni tildes) ninguna palabra del nombre de
  4+ letras, la parte local del correo (4+ caracteres) ni el cuerpo del RUT (sin puntos ni DV).
  Con la clave vacía, `not-personal` queda pendiente (no se muestra como cumplido algo sin evaluar).
- **Fortaleza** (solo orientativa, no bloquea): `weak` si no es válida; válida → `fair`; `good` con
  14+ caracteres o 3 clases de caracteres; `strong` con 14+ y 3 clases. Sin diccionarios en el cliente.
- `PASSWORD_MIN_LENGTH` deja de vivir en `auth-errors.utils.ts`, que lo re-exporta para no romper
  imports; el test de hotfix-059-b pasa a comprobar 10.

### 2. Mostrarla — `shared/components/password-requirements/` (Dumb, OnPush)

`<app-password-requirements [requirements]="…" [strength]="…" />`: barra de fortaleza con su
etiqueta ("Débil", "Aceptable", "Buena", "Muy buena") y la lista de requisitos con ícono
(`check-circle` / `circle`, ya registrados) + texto. `aria-live="polite"`; el estado nunca depende
solo del color (AC-E1). Solo `input()`; sin Facades. Tokens del DS, sin colores a mano.

### 3. Las dos pantallas

- **`features/auth/force-password-change`** (activar, primer ingreso y recuperar): se agrega el campo
  **Confirmar contraseña**, el componente de requisitos y el validador de la regla. El contexto
  (nombre, correo, RUT) sale de `AuthFacade.currentUser()`. Mensaje "Las contraseñas no coinciden".
- **`shared/components/ajustes-drawer`**: mismo componente y misma función en vez de
  `newPassword().length < minPasswordLength`.
- **`AuthFacade` / modelo `User` (ui):** se suma `rut` al perfil que ya se lee de `users` (una
  columna más en la misma consulta de la fila propia), solo para la regla `not-personal`.

### 4. El servidor exige lo mismo (configuración de Auth en producción — con aprobación)

Por la Management API (`PATCH /v1/projects/{ref}/config/auth`):
`password_min_length: 10`, `password_required_characters` = letras + dígitos, y se intenta
`password_hibp_enabled: true` (AC9; el proyecto está en plan gratuito, puede rechazarlo).
`supabase/config.toml` queda igual (`minimum_password_length = 10`,
`password_requirements = "letters_digits"`).

- `core/utils/auth-errors.utils.ts`: mapea el error de Auth por clave débil (`weak_password`, con sus
  `reasons`: largo, caracteres, filtrada) a un mensaje en español que dice qué falta (AC7).
- **Orden de salida:** primero el código (la app ya exige 10 + letras y números), después la
  configuración de Auth. Al revés, la app aceptaría claves de 8 que el servidor rechaza.

### 5. Lo que NO cambia

- Iniciar sesión con una clave antigua que no cumple la regla (Auth solo valida al fijarla) — AC8.
- Login, inscripción pública y Edge Functions (ninguna fija contraseñas).

## Validación

| AC | Cómo |
|---|---|
| AC1, AC2, AC3, AC4 | `password-policy.utils.spec.ts` (tabla de casos) + specs de las dos pantallas |
| AC5, AC8 | Script contra Auth: fijar una clave que no cumple → rechazo; login con la cuenta de prueba de siempre → entra |
| AC6 | spec del componente de activación + e2e |
| AC7 | `auth-errors.utils.spec.ts` |
| AC9 | Resultado del PATCH; si queda activo, probar una clave filtrada conocida |
| AC-E1, AC-E2 | e2e: `aria-live`, pegar la clave, `/verify` en claro y oscuro |

e2e: se amplía `cambiar-clave-actual.spec.ts` (interceptado) con los requisitos visibles; los tests
"reales" (`*-real.spec.ts`) usan claves que ya cumplen la regla.

## Riesgos

- **Cuentas de prueba:** la clave del seed y de la suite e2e ya cumple (10 caracteres, letras y números).
- **Enlaces de activación ya enviados:** siguen sirviendo; al abrirlos se les pide la regla nueva.
- **Fricción:** una persona que hoy elegiría 8 caracteres tendrá que escribir 10; la lista de
  requisitos le dice por qué.

## Fuera de este plan

MFA, bloqueo por intentos, caducidad, y forzar el cambio a cuentas existentes (§5 de la spec).
