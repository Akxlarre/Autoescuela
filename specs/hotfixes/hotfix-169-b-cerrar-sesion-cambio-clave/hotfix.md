# Hotfix: "Cerrar sesión" en la pantalla de crear contraseña
> id: hotfix-169-b-cerrar-sesion-cambio-clave
> refs: fix-183-b-testing-autenticacion-sesion (C03)
> status: done
> closed: 2026-10-29
> created: 2026-10-29

## Problema
Caso C03 del checklist 022: en `/force-password-change` (primer ingreso) y `/recuperar-contrasena`
no había forma de salir. `firstLoginGuard` rebota cualquier ruta a esa pantalla, así que quien
entró con la cuenta equivocada (o en un equipo compartido) quedaba atrapado. Decisión del owner
(2026-10-29): agregar "Cerrar sesión".

## Cambios
- **Archivo:** `src/app/features/auth/force-password-change/force-password-change.component.ts` —
  botón `btn-ghost` "Cerrar sesión" bajo el formulario, en los dos modos. Llama a
  `AuthFacade.logout()`, que cierra la sesión y navega al inicio (mismo patrón que `/sin-sede`).
  Se deshabilita mientras se guarda la contraseña.
- **Mismo archivo (C12, encontrado al automatizarlo):** con doble clic en "Guardar y entrar" se
  mandaban **dos** cambios de clave: el segundo clic llega antes de que el botón se pinte
  deshabilitado, y `onSubmit()` no miraba `loading()`. Ahora sale si ya está guardando.
- **Archivo:** `e2e/auth-sesion-8.spec.ts` — C03 y C12 (más C02, C10, C13 y G34 del checklist 022).

## Verificación
- Navegador (2026-10-29, Chrome con `ng serve`): `auth-sesion-8.spec.ts` 6/6 y `contrasena-requisitos.spec.ts`
  4/4. C12 falló antes del fix (2 cambios de clave) y pasa después (1).
