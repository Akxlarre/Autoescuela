# Fix: getAgeStatus duplicado — admin hereda order bug de fix-013
> id: fix-014-b-getAgeStatus-compartido
> refs: fix-013-menor-17-profesional-mensaje
> status: done
> closed: 2026-06-10
> created: 2026-06-10

## Root Cause

`getAgeStatus()` está definida localmente en `public-personal-data.component.ts`
(fix-013 corrigió su orden). `personal-data.component.ts` (admin/secretaria) tiene
su PROPIA reimplementación con el orden original incorrecto:

```
age < 18 → requires-authorization   ← antes que el check profesional
professional && age < 20 → under-20-professional
```

Resultado: una secretaria que matrícula un alumno de 17 años en Clase Profesional
ve solo un warning amarillo (requires-authorization) y puede avanzar, cuando debería
ver el bloqueo rojo (under-20-professional).

La raíz real es que la función no está en `core/utils/age.utils.ts` donde pertenece.
Cada componente tiene su copia → divergen silenciosamente al actualizar una.

## ACs Afectados

- Ninguno — fix autónomo de lógica compartida.

## Cambio

Tres archivos, una causa raíz (consolidación):

1. **`src/app/core/utils/age.utils.ts`** — agregar `getAgeStatus(birthDate, courseType)`
   con el orden correcto (profesional antes de menor-18). Importa `AgeAlertStatus`
   del modelo.

2. **`src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`**
   — eliminar la definición local de `getAgeStatus`, importar desde `age.utils.ts`.

3. **`src/app/shared/components/matricula-steps/personal-data/personal-data.component.ts`**
   — eliminar la reimplementación inline del `ageStatus` computed, llamar a la
   función compartida `getAgeStatus(birthDate, courseType)`.

## Test de Regresión

- `src/app/core/utils/age.utils.spec.ts` (nuevo)
  - `getAgeStatus > 17 años + profesional → under-20-professional` ✓
  - `getAgeStatus > 17 años + class_b → requires-authorization` ✓
  - `getAgeStatus > 18 años + class_b → ok` ✓
  - `getAgeStatus > 19 años + profesional → under-20-professional` ✓
  - `getAgeStatus > 20 años + profesional → ok` ✓
- `public-personal-data.component.spec.ts` — todos los tests existentes siguen verdes ✓
