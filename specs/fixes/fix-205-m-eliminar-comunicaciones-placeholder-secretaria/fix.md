# Fix: Eliminar la página placeholder "Comunicaciones" de secretaria
> id: fix-205-m-eliminar-comunicaciones-placeholder-secretaria
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
`secretaria/comunicaciones` es un placeholder de 41 líneas que solo renderiza un estado
"Próximamente — el módulo de comunicaciones está en desarrollo". No tiene facade, ni datos, ni
acciones. Aun así ocupa un ítem en el menú, y encima colgado del grupo **"Finanzas y Caja"**,
que no tiene nada que ver con comunicaciones.

La función que ese ítem prometía ya existe y está implementada: **"Comunicación"** en el grupo
*Operaciones Diarias* → `secretaria/observaciones` (183 líneas sobre `TasksFacade`, con tabs,
modal de detalle y drawer de creación). Admin no tiene el placeholder: su ítem "Comunicación"
apunta directo a su página real (`admin/tareas`).

O sea que el placeholder es una asimetría de rol que además duplica conceptualmente algo ya
resuelto.

## Decisión del dueño (2026-08-24)
Eliminar la página Comunicaciones de secretaria y quedarse con la de Operaciones Diarias
("Comunicación") que ya existe.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts`
  **Qué cambia:** se elimina el `NavItem` "Comunicaciones" del grupo "Finanzas y Caja" de
  `SECRETARIA_NAV`. El grupo queda alineado con el de admin (solo ítems financieros).
- **Archivo:** `src/app/app.routes.ts`
  **Qué cambia:** se elimina la ruta `comunicaciones` del bloque `secretaria`.
- **Archivo:** `src/app/features/secretaria/comunicaciones/secretaria-comunicaciones.component.ts`
  **Qué cambia:** se **elimina**.
- **Archivos:** `indices/COMPONENTS.md`, `indices/USAGE-MAP.md`
  **Qué cambia:** se quitan las referencias a la página eliminada.

## Test de Regresión
- `npx ng build` sin errores (garantiza que no queda ninguna referencia al componente eliminado
  ni a su ruta).
- `npm run lint:arch` sin errores nuevos.
- Verificación manual: el sidebar de secretaria ya no muestra "Comunicaciones"; "Comunicación"
  en Operaciones Diarias sigue abriendo Observaciones.

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**
