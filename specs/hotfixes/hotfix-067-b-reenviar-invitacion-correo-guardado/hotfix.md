# Hotfix: "Reenviar invitación" usa el correo del formulario, no el guardado
> id: hotfix-067-b-reenviar-invitacion-correo-guardado
> refs: ASG-i-034 (sospecha S10, confirmada en fix-197-b)
> status: closed
> created: 2026-10-07

## Problema
En Editar instructor, "Reenviar invitación" manda el correo escrito en el formulario. Si se editó y
aún no se guarda, `activate-instructor-account` responde 400 "El email no coincide" (compara con el
guardado). Desde fix-200-b ese mensaje se ve, pero la acción igual falla y no explica qué hacer.

## Cambios
- **Archivo:** `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts` —
  la invitación siempre va al correo guardado (`inst.email`), y si el formulario tiene otro correo
  aparece la nota "La invitación se enviará a {guardado}. Guarda los cambios para enviarla al correo
  nuevo."

## Verificación
- `ng build`, `lint:arch`; e2e contra el build de producción con `activate-instructor-account`
  interceptado (no se envía nada): con el correo editado sin guardar, la nota aparece y el body lleva
  el correo guardado.

## Resultado (2026-10-07)
- `ng build` OK, `lint:arch` 0 errores (182 advertencias, sin nuevas).
- `e2e/instructores-invitacion.spec.ts` (H03) contra el build de producción, sin enviar nada: sin
  editar no hay nota; con el correo cambiado la nota muestra el guardado y la función recibe
  `instructor.seed3@test-data.local` (antes: el del formulario). 1/1.
