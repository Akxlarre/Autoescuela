# Fix: "Iniciar clase" no avisa que el vehículo elegido tiene el SOAP o la revisión técnica vencidos
> id: fix-247-b-iniciar-clase-avisa-documentos-vehiculo
> refs: ASG-i-026 (fix-186-b, caso K07; decisión del owner 2026-11-10: avisar, no bloquear)
> status: done
> closed: 2026-11-10
> created: 2026-11-10

## Root Cause
El selector de vehículo del drawer "Iniciar clase" (`AdminIniciarClaseDrawerComponent`) se arma con
`AsistenciaClaseBFacade.loadVehiclesByBranch()`, que lee solo `vehicles`. No consulta
`vehicle_documents`, así que no hay con qué avisar. La grilla de la Agenda y "Reprogramar" sí avisan
(triángulo con "SOAP vencido", I12) con `buildVehicleDocWarningMap()`: el aviso quedó en el momento
de agendar y no llegó al momento de salir con el auto.

## ACs Afectados
Ninguno de una spec — decisión del owner sobre K07 del checklist 026:
- **K07-a:** si el vehículo elegido (el de la clase o uno cambiado en el selector) tiene documentos
  vencidos o por vencer, el drawer lo dice con la patente y los documentos ("Vehículo RTRE29: SOAP
  vencido"), con el mismo texto que la Agenda.
- **K07-b:** es un aviso: "Comenzar Clase" sigue habilitado.
- **K07-c:** sin documentos vencidos ni por vencer, no aparece nada.

## Cambio
- **Archivo:** `src/app/core/models/ui/asistencia-clase-b.model.ts` — `VehicleOption.docWarning`.
- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.ts` — `loadVehiclesByBranch()` lee
  también `vehicle_documents` de esos vehículos y adjunta el aviso.
- **Archivo:** `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.ts` — aviso
  bajo el selector.

## Test de Regresión
- `src/app/core/facades/asistencia-clase-b.facade.spec.ts` > fix-247-b: adjunta el aviso de documentos ✓
- `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.spec.ts` > fix-247-b (3 tests) ✓
  — 121 unit tests del facade y los dos drawers en verde.
- `e2e/agenda-6.spec.ts` > K07 ✓ — simula `vehicle_documents` con `page.route` (hoy ningún vehículo
  de la sede 1 tiene documentos vencidos o por vencer). Revisado visualmente en claro y oscuro.
