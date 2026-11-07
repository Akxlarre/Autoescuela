# Hotfix: El menú "Exportar" no se cierra al hacer clic en el encabezado o el menú lateral
> id: hotfix-171-m-menu-exportar-se-cierra-al-clic-afuera
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
G09 de `fix-485-m`. Los menús de exportar se cerraban con una capa invisible
(`fixed inset-0 z-10`) dibujada dentro de la card. La card y el menú lateral forman su propio
contexto de apilamiento, así que el encabezado de la página y el sidebar quedan **encima** de la
capa: un clic ahí no cierra el menú (verificado en Auditoría: clic en la tabla o el topbar cierra;
en el encabezado o el sidebar, no). Mismo patrón en 6 pantallas.

## Cambios
- **Archivos:** `features/admin/auditoria/admin-auditoria.component.ts`,
  `shared/components/{detalle-cuadratura-modal,cuadratura-content,liquidaciones-content,historial-cuadraturas-content,reportes-contables-content}/*.component.ts`
  — se quita la capa y el menú usa `ClickOutsideDirective` (escucha el clic en `document`, no
  depende del apilamiento), excluyendo el botón que lo abre para que ese botón siga alternándolo.

## Verificación
- Navegador (2026-11-07, admin): en Auditoría el menú abre y cierra con su botón y se cierra con
  un clic en el encabezado, el sidebar y la parte baja de la página. Lo mismo en Reportes
  contables, Liquidaciones e Historial de cuadraturas (sidebar y parte baja). Cuadratura no
  muestra el botón con "Todas las sedes"; usa el mismo cambio. Consola sin errores.
- `vitest` de Auditoría, Cuadratura y Reportes contables: 60/60.
