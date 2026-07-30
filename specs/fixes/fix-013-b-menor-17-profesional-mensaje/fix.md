# Fix: 17 años en flujo profesional muestra mensaje incorrecto
> id: fix-013-b-menor-17-profesional-mensaje
> refs: fix-010-bloqueo-menor-18-flujo-publico
> status: done
> closed: 2026-06-09
> created: 2026-06-09

## Root Cause

En `getAgeStatus()`, el check `age < 18` (→ `requires-authorization`) se evalúa ANTES
que `professional && age < 20` (→ `under-20-professional`). Un alumno de 17 años en el
flujo profesional recibe `requires-authorization` y ve el mensaje "ve a la sucursal con
autorización notarial" — pero eso es engañoso: aunque consiguiera el papel notarial,
igual no podría inscribirse en Clase Profesional hasta los 20 años.

La causa raíz correcta para bloquearlo es la restricción de edad profesional, no la
condición de menor.

## ACs Afectados

- Ninguno — fix autónomo de lógica de presentación de mensajes de error.

## Cambio

- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`
- **Qué cambia:** En `getAgeStatus()`, mover el check de profesional ANTES del check
  de menor de 18, de modo que:
  - 17 años + profesional → `under-20-professional` (mensaje: necesitas 20 años)
  - 17 años + clase_b → `requires-authorization` (mensaje: ve a la sucursal)
  - 18-19 años + profesional → `under-20-professional` (sin cambio)

## Test de Regresión

- `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.spec.ts`
  - `getAgeStatus > retorna "under-20-professional" con alumno de 17 años en profesional` ✓
  - `getAgeStatus > retorna "requires-authorization" con alumno de 17 años en class_b` ✓ (no regresión)
