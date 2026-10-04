# Fix: "Enviar invitación" solo con el correo guardado
> id: fix-296-m-invitacion-solo-con-el-correo-guardado
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
En "Editar Perfil", el botón "Enviar invitación" toma el correo que está escrito en el formulario,
aunque todavía no se haya guardado. La función `activate-student-account` compara ese correo con el
guardado y, si no coinciden, rechaza el pedido con "El email no coincide con el registrado para
este usuario". No se llega a mandar nada a un correo equivocado, pero la secretaria que corrige el
correo y aprieta el botón sin guardar recibe un error que no le dice que el problema es que no
guardó. Es la segunda mitad de la sospecha S18 de `fix-264-m` (`024b`).

**Decisión de Matías (2026-10-04):** mientras el correo del formulario sea distinto del guardado,
el botón queda deshabilitado y debajo aparece "Guarda los cambios antes de enviar la invitación".

## ACs Afectados
- Con el correo del formulario igual al guardado, "Enviar invitación" funciona como antes.
- Con un correo distinto del guardado, el botón está deshabilitado y se ve el aviso.
- Mayúsculas o espacios al inicio o al final no cuentan como diferencia (el correo se guarda
  normalizado).

## Cambio
- **Archivo:** `src/app/core/utils/email.utils.ts` — `isSameEmail()`: compara dos correos
  normalizados.
- **Archivo:** `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts`
  — el botón se deshabilita y muestra el aviso mientras el correo no esté guardado.

## Test de Regresión
- `email.utils.spec.ts > isSameEmail() (fix-296-m)` ✓ (4 tests)
- `e2e/alumnos-b-ficha.spec.ts > S18 · invitación (fix-296-m)` (nuevo) ✓ — botón habilitado con el
  correo guardado, deshabilitado y con aviso al cambiarlo, habilitado otra vez con el mismo correo
  en mayúsculas.
- Captura del panel con el aviso, revisada a la vista.
- No se envió ninguna invitación real: el test solo escribe en el formulario.
