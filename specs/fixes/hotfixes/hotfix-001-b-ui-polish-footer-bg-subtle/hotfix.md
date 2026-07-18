# Hotfix: UI polish — footer drawers sin bg-subtle, inner cards bg-base
> id: hotfix-001-b-ui-polish-footer-bg-subtle
> status: done
> closed: 2026-05-27
> created: 2026-05-27

## Problema
Los footers de drawers usaban `bg-subtle` creando un fondo innecesario cuando solo tienen un botón. Las tarjetas de configuración dentro del `ajustes-drawer` usaban `bg-subtle border-border-subtle` que en light mode no genera contraste suficiente contra `bg-surface`.

## Cambios
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — footer: quita `bg-subtle`; cards internas: `bg-subtle border-border-subtle` → `bg-base border-border-default`
- **Archivo:** `src/app/features/admin/alumnos/clase-online-drawer/admin-clase-online-drawer.component.ts` — footer: `bg-subtle` eliminado, agrega `border-border-subtle` explícito
- **Archivo:** `src/app/features/admin/alumno-detalle/inasistencia-drawer/admin-inasistencia-drawer.component.ts` — footer: `bg-subtle` eliminado
- **Archivo:** `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts` — footer: `bg-subtle` eliminado
