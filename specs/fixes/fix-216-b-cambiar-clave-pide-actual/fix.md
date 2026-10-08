# Fix: Cambiar la contraseña desde Ajustes no pide la actual
> id: fix-216-b-cambiar-clave-pide-actual
> refs: ASG-i-034 (caso P04, §5) — decisión del owner 2026-10-07: pedir la contraseña actual
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] Ajustes → Mi Perfil → "Cambiar Contraseña" solo pide la
nueva y su confirmación, y llama `auth.updateUser({ password })`. Cualquiera frente a una sesión
abierta ajena (el mostrador) puede cambiarle la clave al titular y dejarlo afuera.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** el formulario pide "Contraseña actual"; sin ella el botón está deshabilitado.
- **F2:** `AuthFacade.changePassword(actual, nueva)` verifica la actual (inicio de sesión con el correo
  del usuario) antes de cambiarla; si no coincide → "La contraseña actual no es correcta." y no cambia nada.
- **F3:** la recuperación de contraseña por correo (`completePasswordRecovery`, fix-181-b) no cambia:
  ahí no se conoce la actual.

## Cambio
- `src/app/core/facades/auth.facade.ts` (+ spec) — `changePassword()`.
- `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — campo y llamada nuevos.

## Test de Regresión
- `npx vitest run src/app/core/facades/auth.facade.spec.ts`
- `npx playwright test e2e/cambiar-clave-actual.spec.ts --workers=1` (Auth interceptado)

## Progreso
- [x] `auth.facade.spec.ts` +3 (verifica y cambia; actual mala → error y no cambia; sin sesión), rojo → verde; 32/32.
- [x] Ajustes: campo "Contraseña actual" + `changePassword()`. `ng build` ✓, `lint:arch` 0 errores (182).
- [x] e2e (Auth interceptado, ninguna clave real cambia): sin la actual el botón está deshabilitado; con una actual incorrecta aparece "La contraseña actual no es correcta." y no se llama a `PUT /auth/v1/user`. 1/1.
