# Hotfix: quitar "Ambas sedes" a un vehículo con instructor pide confirmación
> id: hotfix-083-b-apagar-ambas-con-instructor
> refs: ASG-i-032 (checklist 032, G09; decisión del owner 2026-10-16)
> status: closed
> created: 2026-10-16

## Problema
El admin podía apagar "Ambas sedes" en un vehículo con instructor asignado sin ningún aviso. Si
ese instructor opera en la otra sede, se le caen los horarios ahí (la vista de disponibilidad
exige que el vehículo cubra la sede del turno). Decisión: pedir confirmación.

## Cambios
- **Archivo:** `src/app/core/utils/vehicle-form.utils.ts` (+ spec) — `bothBranchesRemovalWarning()`.
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts` —
  confirmación antes de guardar; al cancelar no se guarda.
- **Archivo:** `e2e/flota-formulario.spec.ts` — caso G09.

## Verificación
- [x] vitest del util.
- [x] e2e G09: aparece la confirmación y al cancelar no hay escrituras.
