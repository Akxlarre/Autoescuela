# Hotfix: si falla la carga de la flota se ve "No se encontraron vehículos"
> id: hotfix-087-b-flota-error-de-carga
> refs: ASG-i-032 (checklist 032, A08)
> status: done
> created: 2026-10-16

## Problema
Si la consulta de vehículos falla (red cortada, timeout), `FlotaFacade` guarda "Error al cargar
la flota vehicular." pero el listado no lo muestra: se ve "No se encontraron vehículos · Limpiar
filtros", como si la flota estuviera vacía.

## Cambios
- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts` —
  input `error`; con error y sin vehículos muestra el mensaje y "Reintentar" (emite
  `refreshRequested`). D10: la vista de tarjetas sin resultados usa el mismo estado vacío que la
  tabla ("No se encontraron vehículos" + "Limpiar filtros"); antes decía solo "Sin resultados".
- **Archivo:** `src/app/features/admin/flota/admin-flota.component.ts` — le pasa `facade.error()`
  (la misma página sirve al admin y a la secretaria).

## Verificación
- [x] e2e `flota-checklist.spec.ts` A08 (respuesta cortada) y D10.
