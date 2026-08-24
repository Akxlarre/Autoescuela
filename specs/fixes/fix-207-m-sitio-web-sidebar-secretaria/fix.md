# Fix: "Sitio Web" no está en el sidebar de secretaria
> id: fix-207-m-sitio-web-sidebar-secretaria
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
La ruta `secretaria/configuracion-web` existe (reutiliza `AdminConfiguracionWebComponent`) y es
alcanzable desde el drawer de Ajustes, que navega dinámicamente a
`/app/{role}/configuracion-web` (`ajustes-drawer.component.ts:510`). Pero el ítem **"Sitio Web"**
solo está en `ADMIN_NAV`, así que en secretaria la página quedó sin entrada en el sidebar.

Mismo patrón que fix-201-m (Cursos Singulares): la ruta se agregó para el rol pero el ítem de
menú no. `indices/SECRETARIA-AUDIT.md` ya lo tenía anotado como pendiente de decidir.

## Decisión del dueño (2026-08-24)
Agregar "Sitio Web" al sidebar de secretaria, igual que en admin.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts`
  **Qué cambia:** agrega el `NavItem` "Sitio Web" (icono `globe`) al grupo "Recursos y Logística"
  de `SECRETARIA_NAV`, apuntando a `/app/secretaria/configuracion-web`.
- **Archivo:** `indices/SECRETARIA-AUDIT.md`
  **Qué cambia:** marca como resuelta la observación sobre `configuracion-web` fuera del menú.

## Test de Regresión
- `npx ng build` sin errores.
- Verificación manual: el sidebar de secretaria muestra "Sitio Web" en Recursos y Logística y
  abre la misma pantalla que admin.

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**
