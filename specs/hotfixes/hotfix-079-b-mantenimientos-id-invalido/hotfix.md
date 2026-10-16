# Hotfix: `/flota/abc/mantenimientos` muestra un vehículo vacío en vez de "no encontrado"
> id: hotfix-079-b-mantenimientos-id-invalido
> refs: ASG-i-032 (checklist 032, L12 y L15)
> status: closed
> created: 2026-10-16

## Problema
Con un id que no es un número positivo en la URL, la página de mantenimientos no carga nada y
tampoco avisa: se ve "0 servicios", "Historial vacío" y el botón "Hoja de Ruta", como si el
vehículo existiera. Si antes se había abierto otro vehículo, quedan sus datos en pantalla.
(Un id numérico inexistente, L11, ya decía "Vehículo no encontrado".)

## Cambios
- **Archivo:** `src/app/core/facades/flota-detalle.facade.ts` (+ spec) — `showVehicleNotFound()`:
  limpia el estado y deja el error "Vehículo no encontrado.".
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts` —
  lo llama cuando el id no es válido.

## Verificación
- [x] vitest del facade.
- [x] e2e `flota-checklist.spec.ts` L11 + L12.
