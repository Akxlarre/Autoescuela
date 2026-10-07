# Hotfix: Crear un instructor práctico sin vehículo no avisa que no aparecerá en la Agenda
> id: hotfix-065-b-instructor-sin-vehiculo-aviso
> refs: ASG-i-034 (sospecha S8, confirmada en fix-197-b)
> status: closed
> created: 2026-10-07

## Problema
La disponibilidad de la Agenda (`v_class_b_schedule_availability`) arma los turnos con la
asignación de vehículo vigente del instructor (`vehicle_assignments.end_date IS NULL`). Un
instructor práctico creado sin vehículo no tiene turnos: no aparece para agendar. El formulario de
alta deja el vehículo como opcional y no lo dice; el caso del UAT ("Crear instructor → aparece en
Agenda") falla si no se le asignó vehículo.

## Cambios
- **Archivo:** `src/app/features/admin/instructores/admin-instructor-crear-drawer.component.ts` —
  con un tipo práctico o "ambos" y sin vehículo elegido, aviso bajo el campo: "Sin vehículo
  asignado, este instructor no aparecerá en la Agenda para agendar clases prácticas hasta que se le
  asigne uno." El vehículo sigue siendo opcional (no cambia el contrato).

## Verificación
- `ng build`, `lint:arch`; aviso visible en el build de producción con tipo práctico y sin vehículo.

## Resultado (2026-10-07)
- `ng build` OK, `lint:arch` 0 errores (182 advertencias, sin nuevas).
- Caso C04 en `e2e/instructores-alta.spec.ts` (build de producción): con tipo Práctico y sin vehículo aparece el aviso; sin tipo elegido, no. 2/2 en el archivo.
