# Fix: Actividad Reciente — rutas inventadas y clickabilidad falsa
> id: fix-141-m-actividad-reciente-rutas-inventadas
> refs: fix-105-m-actividad-reciente-eliminados-genericos
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause
`RecentActivityDrawerComponent.handleItemClick()` construía rutas de destino a mano
(`/app/{role}/alumno-detalle/:id`, `/app/admin/configuracion`) que nunca existieron en
`app.routes.ts` — la ruta real de detalle de alumno es `/app/{role}/alumnos/:id` y no
existe ninguna ruta `configuracion` para admin (es `usuarios`). Además, la clase
`cursor-pointer`/hover se aplicaba a cualquier item con `action !== 'DELETE'`, sin
verificar si el `switch` realmente resolvía un `path` — entidades no contempladas
(ej. `vehicles`) o `users` con rol secretaria quedaban visualmente como link pero no
navegaban a ningún lado al hacer click.

## ACs Afectados
- Ninguno — fix autónomo (no hay spec activa; corrección de bug reportado por el owner).

## Cambio
- **Archivo:** `src/app/features/dashboard/recent-activity-drawer/recent-activity-drawer.component.ts`
- **Qué cambia:** se extrae `getTargetPath(item)` como fuente única de verdad para resolver
  la ruta (corrigiendo `alumno-detalle` → `alumnos` y `configuracion` → `usuarios`, y
  devolviendo `null` para roles/entidades sin ruta válida); se agrega `isClickable(item)`
  que reutiliza `getTargetPath()` para decidir si el item lleva `cursor-pointer`/hover, en
  vez de inferirlo solo de `action !== 'DELETE'`.

## Test de Regresión
- Verificación manual: click en "Vehículo actualizado" (entidad sin ruta) ya no muestra
  cursor de link; click en un item de alumno navega a `/app/{role}/alumnos/:id`; click en
  "Usuario eliminado"/creado como secretaria no navega (ruta admin-only).
