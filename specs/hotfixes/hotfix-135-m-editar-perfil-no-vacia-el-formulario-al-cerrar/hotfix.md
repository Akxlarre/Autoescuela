# Hotfix: El aviso de la invitación no parpadea al cerrar ni al guardar "Editar Perfil"
> id: hotfix-135-m-editar-perfil-no-vacia-el-formulario-al-cerrar
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Problema
El aviso "Guarda los cambios antes de enviar la invitación." (`fix-296-m`) se alcanzaba a ver en
dos momentos en que no hay nada sin guardar:

1. **Al cancelar** (reportado por Matías el 2026-10-04): el formulario se vaciaba con
   `form.reset()` antes de que terminara la animación de cierre. Con el correo vacío, el aviso
   creía que había un cambio sin guardar.
2. **Justo después de guardar un correo nuevo** (encontrado al revisar el primero): el aviso
   comparaba contra el correo del Facade, que tarda un momento en refrescarse tras guardar; en ese
   lapso aparecía junto a "Datos actualizados correctamente."

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts`
  - se quita `form.reset()` de "Cancelar" y del cierre automático tras guardar: el panel se
    destruye al terminar de cerrarse y, desde `fix-295-m`, reabrirlo crea uno nuevo;
  - el aviso compara contra el correo guardado que recuerda el propio panel (el del alumno al
    abrir y el recién enviado tras guardar), no contra el Facade.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts`
  - `S18 · invitación`: mira cada cuadro de la animación de cierre y falla si el aviso se ve;
  - `M09 · M15 · B36`: lo mismo desde que aparece "Datos actualizados correctamente." hasta que
    el panel se cierra.

## Verificación
Cada test se corrió contra el código sin su arreglo (falla: "el aviso no debe verse…") y con él
(pasa). Los tests de "Editar Perfil" (M01–M03, M06, M07, M09, M15, B36 y los dos de S18) pasan
2 corridas seguidas cada uno.
