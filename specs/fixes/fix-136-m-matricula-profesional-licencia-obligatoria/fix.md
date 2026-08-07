# Fix: Matrícula profesional permite avanzar sin licencia previa ni fecha de licencia B
> id: fix-136-m-matricula-profesional-licencia-obligatoria
> refs: —
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Root Cause
`canAdvance` en `PersonalDataComponent` (`src/app/shared/components/matricula-steps/personal-data/personal-data.component.ts`)
no valida `currentLicense` ni `licenseDate` cuando `courseCategory === 'professional'`. Estos
campos son obligatorios solo para esa categoría (los inputs del template ya los muestran
condicionalmente), pero el botón "Siguiente" se habilita sin ellos.

## ACs Afectados
Ninguno — fix autónomo (bug reportado directamente por el dueño en QA manual).
- Al seleccionar categoría "Profesional", el paso 1 no debe permitir avanzar si falta
  "Licencia previa" (`currentLicense`) o "Fecha de obtención licencia B" (`licenseDate`).

## Cambio
- **Archivo:** `src/app/shared/components/matricula-steps/personal-data/personal-data.component.ts`
- **Qué cambia:** `canAdvance` agrega la condición: si `courseCategory === 'professional'`,
  entonces `currentLicense` no debe ser `null`/`'none'`/vacío y `licenseDate` no debe ser
  `null`/vacío.

## Test de Regresión
- `personal-data.component.spec.ts > canAdvance es false en categoría profesional sin licencia previa ni fecha` ✓
