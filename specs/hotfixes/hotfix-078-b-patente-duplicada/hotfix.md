# Hotfix: patente duplicada → "Error al guardar el vehículo", sin decir por qué
> id: hotfix-078-b-patente-duplicada
> refs: ASG-i-032 (checklist 032, E06 y F10)
> status: closed
> created: 2026-10-16

## Problema
Crear un vehículo con una patente que ya existe, o editar uno poniéndole la patente de otro, no
guarda (la BD tiene `UNIQUE (license_plate)`), pero el formulario muestra el genérico "Error al
guardar el vehículo". El error de Supabase no es una instancia de `Error`, así que el drawer ni
siquiera lo pasa por el sanitizador; y el sanitizador, para `23505`, habla de "RUT o correo".

## Cambios
- **Archivo:** `src/app/core/utils/vehicle-form.utils.ts` (+ spec) — `vehicleSaveErrorMessage(error, plate)`:
  `23505` → "Ya existe un vehículo con la patente XXXX.".
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts` —
  usa ese mensaje; cualquier otro error pasa por el sanitizador (también los que no son `Error`).

## Verificación
- [x] vitest del util.
- [x] e2e `flota-checklist.spec.ts` E06 y F10.
