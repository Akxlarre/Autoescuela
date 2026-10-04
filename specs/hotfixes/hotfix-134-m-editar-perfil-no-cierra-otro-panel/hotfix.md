# Hotfix: "Editar Perfil" no cierra un panel que no es el suyo
> id: hotfix-134-m-editar-perfil-no-cierra-otro-panel
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Problema
Al guardar "Editar Perfil" se programa el cierre del panel para 1,2 segundos después (mientras se
muestra "guardado"). Ese cierre llama a `layoutDrawer.close()` sin mirar qué panel está abierto: si
en ese lapso el usuario cerró "Editar Perfil" y abrió otro (Ficha Técnica, Inasistencias…), se
cierra el otro. Es la sospecha S18 de `fix-264-m` (`024b`).

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts`
  — el cierre diferido se cancela cuando el panel de "Editar Perfil" se destruye.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — test `S18 (hotfix-134-m)`: guarda, cierra y abre la
  Ficha Técnica dentro del plazo; pasados 1,8 s la Ficha Técnica sigue abierta. Comprobado que
  falla con el arreglo desactivado y pasa con él (3 de 3).

## No incluido
La otra mitad de S18 (la invitación de acceso se envía al correo escrito en el formulario, aunque
no se haya guardado) no se tocó: es otro comportamiento y necesita decisión.
