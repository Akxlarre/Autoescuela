# Hotfix: El menú de Carnet de la ficha se cierra con Escape
> id: hotfix-138-m-menu-de-carnet-se-cierra-con-escape
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Problema
El menú desplegable de la tarjeta de Perfil (Carnet / Contrato) se cierra con un clic fuera, pero
no con Escape. Encontrado en la 3ª pasada de `fix-264-m` (`024b` J09); es B40.

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` —
  `closeCardMenu()` también escucha `keydown.escape` en el documento.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — test `J09` de la tercera pasada.
