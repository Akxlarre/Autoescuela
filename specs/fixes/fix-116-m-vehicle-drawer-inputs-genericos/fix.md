# Fix: Drawer de Vehículo usa inputs/selectores fuera del patrón visual del proyecto
> id: fix-116-m-vehicle-drawer-inputs-genericos
> refs: 0004-m-instructores-vehiculos-multi-sede
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
`vehicle-form-drawer.component.ts` se implementó antes de que se consolidaran las clases
globales `.field-input`/`.field-label` (fix-025/026) y el componente reutilizable
`app-branch-scope-selector` (creado en 0004-m para instructores, pero pensado también para
vehículos según su propio `data-llm-description`: "input for the instructor or vehicle's main
branch"). Quedó con `pInputText`/`p-inputNumber` + clases Tailwind ad-hoc (`rounded-xl`,
`font-mono uppercase text-lg`, etc.) y duplicó manualmente la lógica de sede + "ambas sedes"
(toggle + selects + computed de visibilidad/disabled) en vez de delegarla al componente
canónico, divergiendo del resto de los drawers de creación/edición (secretaria, instructor).

## ACs Afectados
Ninguno — fix autónomo de consistencia visual, no cambia comportamiento ni contratos de datos.

## Cambio
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
- **Qué cambia:** los inputs de texto/número (patente, marca, modelo, año, km) pasan de
  `pInputText`/`p-inputNumber` con clases Tailwind sueltas a inputs planos con `field-input`/
  `field-label` (mismo patrón que `admin-instructor-crear-drawer` y
  `admin-secretarias-crear-drawer`); el bloque de sede + "ambas sedes" se reemplaza por
  `<app-branch-scope-selector>`, eliminando los computeds y el segundo `effect()` de
  enable/disable duplicados en el propio drawer.

## Test de Regresión
- Verificación manual visual (`/verify`): el drawer "Nuevo Vehículo" y "Editar Vehículo" se ven
  con el mismo estilo de campos que "Nueva Secretaria" / "Nuevo Instructor"; sede/ambas-sedes
  siguen respetando las reglas de rol (secretaria no puede tocar sede/ambas) igual que antes.
