# Hotfix: El formulario de vehículo pisa lo escrito, valida mal la patente y el año, y deja bajar el kilometraje sin avisar
> id: hotfix-075-b-formulario-vehiculo
> refs: ASG-i-032 (checklist 032, S18, S19 y S3; decisión 2 del owner, 2026-10-12)
> status: closed
> created: 2026-10-12

## Problema
1. **S18:** al editar, el formulario se vuelve a precargar cada vez que cambia la lista del facade
   (refresco, cambio de sede, evento en vivo) y pisa lo que la persona estaba escribiendo.
2. **S19:** el placeholder de la patente es "ABC-123", pero la regla rechaza el guion y las minúsculas
   (no las convierte), no limita el largo y acepta formatos que no existen ("ABC123"). El año solo
   tiene mínimo; la columna es SMALLINT y un año absurdo revienta en la BD.
3. **S3 (decisión 2):** Editar vehículo deja bajar el kilometraje sin ningún aviso. El admin puede
   corregirlo, pero con confirmación.

## Cambios
- **Archivo:** `src/app/core/utils/vehicle-form.utils.ts` (+ spec) — `normalizeLicensePlate()`,
  `isValidLicensePlate()` (AA1234 o ABCD12), `maxVehicleYear()`, `isKmDecrease()`.
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts` —
  precarga una sola vez por vehículo; patente normalizada al escribir y validada (una patente ya
  guardada que no se toca se respeta, aunque sea de un formato antiguo o de prueba); año entre 1900
  y el próximo; confirmación antes de guardar un kilometraje menor al registrado.

## Verificación
- vitest de la util; `tsc`, `lint:arch`; e2e del formulario (sin guardar).

## Resultado (2026-10-12)
- `vehicle-form.utils.spec.ts` 23/23.
- `e2e/flota-formulario.spec.ts` 3/3 (escrituras a `vehicles` interceptadas, 0 intentos):
  - "ab-cd 12" queda "ABCD12" y es válida; "zz4103" → "ZZ4103" válida; "ABC123" → "Patente inválida"; año 99999 → "Año entre 1900 y …" y Guardar deshabilitado.
  - Al editar, refrescar la lista no cambia lo escrito en Marca.
  - Bajar el kilometraje en 1 abre "Bajar el kilometraje" con los dos valores; al cancelar no se guarda.
- `tsc` sin errores, `lint:arch` 0 errores.
- No se probó guardar de verdad un kilometraje menor (habría modificado un vehículo real).
