# Hotfix: Detalles de formato en Servicios especiales (fechas, montos, editar inactivo, PDF)
> id: hotfix-158-m-servicios-especiales-detalles-de-formato
> refs: fix-429-m-testing-servicios-especiales (casos I03, J02, G17, D04, E06, K03)
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Problema
- El Historial de ventas y el aviso "No se puede borrar: la caja del … ya está cerrada" muestran la
  fecha en ISO (`2026-08-27`); el resto de la app usa `DD-MM-AAAA`.
- Un monto con decimales (`1500.5`) deja habilitado "Registrar Venta" / "Agregar al Catálogo" /
  "Guardar Cambios" y la BD lo rechaza con "El formato de los datos enviados es inválido." (las
  columnas son enteras).
- En la vista de tarjetas (contenedor angosto), un servicio inactivo no tiene el botón de editar;
  en la tabla sí.
- El PDF del Historial dice "Total (1 ventas)".

## Cambios
- **Archivo:** `src/app/features/admin/servicios-especiales/historial-ventas-drawer.component.ts` — fecha de cada venta con `formatDayMonthYear`.
- **Archivo:** `src/app/core/facades/servicios-especiales.facade.ts` (+ spec) — el aviso de caja cerrada con `formatDayMonthYear`.
- **Archivo:** `src/app/core/utils/servicios-especiales.utils.ts` (+ spec) — validador `montoEntero`.
- **Archivo:** `src/app/shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts` — `montoEntero` en Monto + aviso bajo el campo.
- **Archivo:** `src/app/shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts` — ídem en Precio base.
- **Archivo:** `src/app/features/admin/servicios-especiales/editar-servicio-drawer.component.ts` — ídem en Precio base.
- **Archivo:** `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts` — botón editar en la tarjeta de un servicio inactivo.
- **Archivo:** `supabase/functions/export-special-services/index.ts` — "1 venta" / "N ventas" (requiere deploy).
