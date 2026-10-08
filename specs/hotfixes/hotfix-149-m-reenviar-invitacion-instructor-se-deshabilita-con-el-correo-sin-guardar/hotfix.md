# Hotfix: "Reenviar invitación" del instructor se deshabilita con el correo sin guardar
> id: hotfix-149-m-reenviar-invitacion-instructor-se-deshabilita-con-el-correo-sin-guardar
> refs: ASG-i-034 (S10) — ajusta hotfix-067-b; mismo criterio que fix-296-m
> status: done
> closed: 2026-10-08
> created: 2026-10-07

## Problema
En "Editar instructor", con el correo editado y sin guardar, "Reenviar invitación" sigue activo y
manda la invitación al correo guardado (hotfix-067-b), que es justo el que la persona está
corrigiendo. En "Editar Perfil" del alumno el mismo caso deshabilita el botón y pide guardar
(fix-296-m, decisión de Matías del 2026-10-04). Las dos pantallas quedan con el comportamiento del
alumno.

## Cambios
- **Archivo:** `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts` —
  el botón se deshabilita mientras el correo del formulario difiere del guardado (`isSameEmail()`)
  y muestra "Guarda los cambios antes de enviar la invitación."; se quita la nota de hotfix-067-b.
- **Archivo:** `e2e/instructores-invitacion.spec.ts` — el test de S10 espera el botón deshabilitado
  con el aviso, y que con el correo guardado la invitación salga a ese correo.
