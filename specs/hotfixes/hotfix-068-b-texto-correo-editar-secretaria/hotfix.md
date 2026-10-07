# Hotfix: Editar secretaria promete un correo de confirmación que no se envía
> id: hotfix-068-b-texto-correo-editar-secretaria
> refs: ASG-i-034 (sospecha S13, confirmada en parte en fix-197-b)
> status: closed
> created: 2026-10-07

## Problema
Al cambiar el correo en Editar secretaria aparece "Se enviará confirmación al nuevo correo. El
cambio es inmediato." `update-secretary` cambia el correo con la API de admin
(`auth.admin.updateUserById`), que no envía confirmación: el cambio es directo. El admin espera un
correo que nunca llega.

La otra mitad de S13 ("La secretaria no podrá iniciar sesión mientras esté inactiva") ya es cierta
desde fix-180-b (desactivar banea la cuenta en Auth): se deja igual.

## Cambios
- **Archivo:** `src/app/features/admin/secretarias/admin-secretarias-editar-drawer.component.ts` —
  texto: "El cambio es inmediato: al guardar, la secretaria ingresa con este correo. No se envía
  correo de confirmación." Cambia el `style` con color de respaldo en hex por la clase `text-warning`.

## Verificación
- `ng build`, `lint:arch`.

## Resultado (2026-10-07)
- `ng build` OK, `lint:arch` 0 errores (182 advertencias, sin nuevas). `text-warning` ya se usa en la app (p. ej. ficha del alumno), así que su CSS existe.
