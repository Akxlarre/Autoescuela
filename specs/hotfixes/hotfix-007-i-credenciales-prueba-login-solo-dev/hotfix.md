# Hotfix: Credenciales de prueba visibles en `/login` solo deben mostrarse en desarrollo

> id: hotfix-007-i-credenciales-prueba-login-solo-dev
> refs: ASG-i-039
> status: done
> created: 2026-09-30
> closed: 2026-09-30

## Problema

[Heredado de ASG-i-039, confirmado en vivo]: `/login` muestra un recuadro "Credenciales de
prueba" con las 5 cuentas `@test.com` y la contraseña `Test123456`, sin ninguna condición de
entorno (`login.component.ts`, bloque final del template; el comentario del archivo dice
"Eliminar antes de producción"). Las credenciales funcionan contra la BD del piloto (se usaron
para la confirmación del 2026-09-30), así que cualquiera que abra `/login` en un sitio desplegado
puede entrar como admin.

El equipo todavía usa ese recuadro al probar en local, por lo que **no se elimina**: se oculta en
los builds de producción.

## Cambio

- **`src/app/features/auth/login/login.component.ts`**:
  - El bloque "Recordatorio de credenciales de prueba" se renderiza solo dentro de
    `@if (showTestCredentials())`, con `showTestCredentials = signal(isDevMode())` (`ng serve`).
  - **Las cuentas y la contraseña ya no están escritas en el template**: viven en dos constantes
    (`TEST_ACCOUNTS`, `TEST_PASSWORD`) condicionadas por `ngDevMode`. El CLI fija `ngDevMode =
    false` en `ng build --configuration production` (el que usa
    `.github/workflows/deploy-app-production.yml`) y el bundler elimina esas ramas. Hacía falta
    porque con solo el `@if` el texto seguía viajando dentro del JS desplegado (se comprobó: el
    primer build de producción aún contenía `Test123456`).
- Alcance mínimo: no se tocan las cuentas, ni otros métodos del componente.

## Fuera de alcance (pendiente aparte)

- Las cuentas `*@test.com` y la contraseña `Test123456` siguen existiendo en la BD. Si esa BD es
  la del piloto con el cliente, **rotarlas o desactivarlas antes de entregar**.
- Limpiar los métodos sobrantes del panel de pruebas visual (`toggleError`, `toggleSuccess`,
  `navigateToApp`, `modes`).

## Test de Regresión

- `src/app/features/auth/login/login.component.spec.ts` (3 tests): en desarrollo el recuadro se
  habilita y trae cuentas y contraseña; el bloque solo existe dentro de `@if
  (showTestCredentials())`; y cada línea con `Test123456` o `@test.com` está dentro del bloque
  condicionado por `ngDevMode`. Los tests de plantilla renderizada no están soportados en este
  repo (`vitest.config.ts`), por eso se verifica estado + forma del fuente.

## Evidencia de Verificación

- **2026-09-30/10-01:** `npx vitest run login.component.spec.ts` 3/3. `tsc --noEmit` limpio.
  Suite completa `npm run test:ci`: 2788 verdes. `npm run lint:arch`: sin errores nuevos.
- **Build de producción** (`ng build --configuration production`): buscando en todo el bundle,
  `Test123456`, `secretaria@test.com` y `admin@test.com` aparecen **0 veces** (antes de mover los
  literales detrás de `ngDevMode`, `Test123456` aparecía en 1 archivo).
- **En vivo con Playwright en `ng serve`** (`/login`): el recuadro se muestra con las 5 cuentas y
  la contraseña; 0 errores en consola.
- Pendiente fuera de este hotfix: rotar/desactivar las cuentas `@test.com` antes de entregar.
