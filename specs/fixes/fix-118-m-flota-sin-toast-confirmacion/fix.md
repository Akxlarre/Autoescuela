# Fix: Crear/editar vehículo no muestra toast de confirmación
> id: fix-118-m-flota-sin-toast-confirmacion
> refs: fix-116-m-vehicle-drawer-inputs-genericos
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
`FlotaFacade.createVehicle()` y `updateVehicle()` nunca inyectaron `ToastService` ni llamaron
`toast.success(...)` al terminar el insert/update — a diferencia de `SecretariasFacade` e
`InstructoresFacade`, que sí confirman la acción con un toast (`crearSecretaria()`,
`editarSecretaria()`). El dueño lo notó al editar un vehículo (no aparece nada abajo a la
derecha); el mismo hueco existe al crear, porque `createVehicle()` tiene el mismo problema.

## ACs Afectados
Ninguno — fix autónomo de consistencia de feedback al usuario, no cambia contratos de datos.

## Cambio
- **Archivo:** `src/app/core/facades/flota.facade.ts`
- **Qué cambia:** se inyecta `ToastService` y se agrega `toast.success('Vehículo creado', ...)` /
  `toast.success('Vehículo actualizado', ...)` al final de `createVehicle()` / `updateVehicle()`,
  mismo patrón que `SecretariasFacade.crearSecretaria()`/`editarSecretaria()`.

## Test de Regresión
- Verificación manual visual (`/verify`): al crear y al editar un vehículo desde el drawer,
  aparece un toast de confirmación abajo a la derecha.
