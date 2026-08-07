# Fix: Eliminar el estado "En Clase" del ciclo de vida manual de vehículos
> id: fix-121-m-eliminar-estado-en-clase-vehiculo
> refs: —
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
`vehicles.status = 'in_class'` es un estado 100% manual (solo se escribe desde el `p-select`
"Estado Actual" del drawer de editar vehículo) que ningún flujo de negocio real (agendar,
iniciar o finalizar clase) actualiza automáticamente. El vehículo "en clase de verdad" ya se
determina por otra vía (agenda calculada desde `class_b_sessions`), así que este campo manual
solo se desincroniza con la realidad y no aporta nada frente a "Disponible". Decisión del dueño
(2026-08-05): eliminarlo del ciclo de vida manual del vehículo.

## ACs Afectados
Ninguno — fix autónomo, decisión de producto post-QA.

- AC-1: El selector "Estado Actual" del drawer de editar/crear vehículo ya no ofrece "En Clase"
  como opción (solo Disponible, Mantenimiento, Fuera de Servicio).
- AC-2: El filtro de estado de la tabla de flota ya no ofrece "En Clase" como opción.
- AC-3: La KPI "En Clase" del hero de Flota se retira (deja de tener sentido con la opción
  eliminada).
- AC-4: `VehicleStatus` dejar de incluir `'in_class'`; cualquier vehículo con ese valor legacy
  en BD (columna `vehicles.status`, string libre) se sigue normalizando a `'available'` al
  leerlo, para no romper renders de datos existentes.

## Cambio
- **Archivo:** `src/app/core/models/ui/vehicle-table.model.ts` — `VehicleStatus` pasa a
  `'available' | 'maintenance' | 'out_of_service'`; `FlotaKpis` pierde el campo `inClass`.
- **Archivo:** `src/app/core/utils/vehicle-status.utils.ts` — `STATUS_MAP` deja de mapear a
  `'in_class'`; `in_use`/`in_class`/`'en clase'` ahora normalizan a `'available'`.
- **Archivo:** `src/app/core/facades/flota.facade.ts` — `kpis` computed deja de calcular
  `inClass`.
- **Archivo:** `src/app/core/facades/flota-detalle.facade.ts` — `resolveStatus()` deja de
  mapear/devolver `'in_class'` (mismo criterio que el util: normaliza a `'available'`).
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
  — se quita la opción `{ label: 'En Clase', value: 'in_class' }` de `statusOptions`.
- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
  — se quita la opción del filtro `statusOptions`, la entrada `in_class` de `statusLabel()` y
  `statusSeverity()`, y la KPI "En Clase" (`heroKpis`).

## Test de Regresión
- `vehicle-status.utils.spec.ts > mapea "in_use" a "available" (legacy, ya no existe in_class)` ✓
