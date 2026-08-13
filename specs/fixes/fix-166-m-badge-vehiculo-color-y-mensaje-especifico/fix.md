# Fix: Badge de documentos de vehículo — color amarillo fijo y mensaje con documentos específicos
> id: fix-166-m-badge-vehiculo-color-y-mensaje-especifico
> refs: specs/fixes/fix-164-m-advertencia-documentos-vehiculo-agendamiento, specs/fixes/fix-165-m-advertencia-vehiculo-scheduling-real-flows
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
Feedback directo del usuario tras revisar el badge en la app: (1) el ícono usaba
`var(--state-error)` (rojo) cuando el documento estaba `expired`, transmitiendo un error
bloqueante en vez de una advertencia informativa — semánticamente incorrecto para una feature
que explícitamente "no bloquea el agendamiento". (2) el mensaje del tooltip era genérico
("documento vencido"/"documento por vencer") porque las queries a `vehicle_documents` en
`AgendaFacade`, `EnrollmentFacade` y `AdminAlumnoDetalleFacade` nunca seleccionaban la columna
`type` — sin ese dato no había forma de decir qué documento específico (SOAP, Revisión Técnica,
Permiso de Circulación, Seguro) es el vencido.

## ACs Afectados
- Ninguno — ajuste de UX sobre fix-164-m/fix-165-m, feature no forma parte de un AC formal.

## Cambio
- **Archivo:** `src/app/core/utils/vehicle-document-status.utils.ts`
  **Qué cambia:** `buildVehicleDocWarningMap()` ahora agrupa por vehículo la lista de nombres
  de documentos vencidos (`expiredDocs`) y por vencer (`expiringSoonDocs`) — usando las labels
  de `VEHICLE_DOC_TYPES` — en vez de solo el peor estado. `vehicleDocWarningLabel()`/
  `vehicleDocWarningLabelGeneric()` arman el mensaje a partir de esas listas
  (ej. "SOAP vencido", "SOAP y Seguro vencidos; Revisión Técnica por vencer").
- **Archivo:** `src/app/core/facades/agenda.facade.ts`, `enrollment.facade.ts`,
  `admin-alumno-detalle.facade.ts`
  **Qué cambia:** las 3 queries a `vehicle_documents` agregan la columna `type` al `select()`.
- **Archivo:** `src/app/core/models/ui/agenda.model.ts`,
  `src/app/core/models/ui/enrollment-assignment.model.ts`
  **Qué cambia:** el tipo de `vehicleDocWarning` pasa de `'expired'|'expiring_soon'|null` a la
  nueva forma agregada (objeto con `expiredDocs`/`expiringSoonDocs`).
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-slot.component.ts`,
  `src/app/shared/components/schedule-grid/schedule-grid.component.ts`,
  `src/app/features/admin/alumno-detalle/reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component.ts`
  **Qué cambia:** el ícono `triangle-alert` usa siempre `var(--state-warning)` (se elimina el
  modificador rojo condicional); el tooltip usa el mensaje con documentos específicos.

## Test de Regresión
- `src/app/core/utils/vehicle-document-status.utils.spec.ts > buildVehicleDocWarningMap agrupa documentos específicos vencidos y por vencer por vehículo` ✓
- `src/app/core/utils/vehicle-document-status.utils.spec.ts > vehicleDocWarningLabel/vehicleDocWarningLabelGeneric arman el mensaje con nombres de documentos` ✓
