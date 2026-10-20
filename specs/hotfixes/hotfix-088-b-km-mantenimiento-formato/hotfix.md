# Hotfix: el km del formulario de servicio se muestra "1,200"
> id: hotfix-088-b-km-mantenimiento-formato
> refs: ASG-i-032 (checklist 032, M01 / M06)
> status: done
> created: 2026-10-16

## Problema
En "Registrar Servicio", el campo "Kilometraje al momento" es un `p-inputNumber` sin `locale`:
con 1.200 km muestra "1,200" (separador inglés). El campo de costo del mismo formulario ya usa
`locale="es-CL"`.

## Cambios
- **Archivo:** `src/app/features/admin/flota/maintenance-form-drawer/maintenance-form-drawer.component.ts` —
  `locale="es-CL"` y sin decimales en el campo de km (la columna es entera).

## Verificación
- [x] e2e `flota-checklist.spec.ts` L01/M01: el km precargado se ve "1.200".
