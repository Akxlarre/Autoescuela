# hotfix-013-m — NG01350 en drawer "Iniciar Clase" de Asistencia B

## Problema
Al abrir el drawer "Iniciar Clase" en Asistencia B (con vehículos disponibles en la sede) y
luego cerrarlo, la app lanza `RuntimeError: NG01350`.

## Causa raíz
El `p-select` de selección de vehículo usa `[(ngModel)]` (banana-in-box) pero está anidado
dentro de `<form [formGroup]="form">`. Sin `ngModelOptions: { standalone: true }`, Angular
intenta registrar el control vía `NgModel` contra el `FormGroup` padre, lo cual está prohibido
y dispara `NG01350` al destruirse/reevaluarse la vista.

## Cambio
### `admin-iniciar-clase-drawer.component.ts`
- Agregar `[ngModelOptions]="{ standalone: true }"` al `p-select` del selector de vehículo.

## Acceptance Criteria
- [x] Abrir el drawer "Iniciar Clase" para una clase de hoy con vehículos disponibles y
      cerrarlo no lanza `NG01350` ni ningún error en consola.
- [x] El selector de vehículo sigue funcionando (selección actualiza `selectedVehicleId` y
      el km del formulario vía `onVehicleSelectChange`).
