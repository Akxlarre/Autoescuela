# Fix: El admin no tiene cómo ayudar a una secretaria que olvidó su contraseña
> id: fix-217-b-admin-reset-clave-secretaria
> refs: ASG-i-034 (caso O04, §5) — decisión del owner 2026-10-07: botón "Enviar correo de restablecimiento" en la ficha
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] No existe en la app ninguna acción para que el admin
restablezca la contraseña de otro usuario. La única vía es que la persona use "¿Olvidaste tu
contraseña?" en el login; si no lo sabe, queda afuera.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** la ficha de una secretaria **activa** tiene "Enviar correo para restablecer contraseña", que
  manda el mismo correo que "¿Olvidaste tu contraseña?" (redirección a `/recuperar-contrasena`, fix-181-b).
- **F2:** toast de éxito con el correo de destino; si falla, toast de error. El admin nunca ve ni fija la clave.
- **F3:** una secretaria inactiva no muestra el botón (no puede iniciar sesión, fix-180-b).
- Instructores: su portal está en piloto (fix-214-b), así que queda fuera por ahora.

## Cambio
- `src/app/core/facades/secretarias.facade.ts` (+ spec) — `enviarRestablecimientoClave(email)`.
- `src/app/features/admin/secretarias/admin-secretarias-ver-drawer.component.ts` — botón.

## Test de Regresión
- `npx vitest run src/app/core/facades/secretarias.facade.spec.ts`
- `npx playwright test e2e/secretarias-reset-clave.spec.ts --workers=1` (`/auth/v1/recover` interceptado)

## Progreso
- [x] `secretarias.facade.spec.ts` +2 (envía con el redirect de fix-181-b y avisa; error → toast), rojo → verde; 18/18.
- [x] Ficha: botón "Enviar correo para restablecer contraseña" solo con la secretaria activa. `ng build` ✓, `lint:arch` 0 errores (182).
- [x] e2e (sin enviar correo): la petición va con `secretaria2@test.com` y aparece "Correo enviado". 1/1.
