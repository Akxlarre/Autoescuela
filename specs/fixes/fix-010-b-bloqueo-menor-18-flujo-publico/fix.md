# Fix: Bloqueo de 17-18 años en flujo público — no pueden completar matrícula online
> id: fix-010-b-bloqueo-menor-18-flujo-publico
> refs: 0009-rediseno-ux-flujo-inscripcion-online-publico
> status: done
> closed: 2026-06-09
> created: 2026-06-09

## Root Cause

`canAdvanceFn` bloquea `'under-17'` y `'under-20-professional'` pero NO bloquea
`'requires-authorization'` (17–18 años). Resultado: un menor de 18 puede avanzar por
todos los pasos del wizard público — incluyendo el pago — sin haber presentado la
autorización notarial.

La alerta warning del template es engañosa porque dice "adjunta en el paso de documentos",
pero `step3Data` hardcodea `isMinor: false`, así que ese paso nunca pide el documento.

Regla de negocio confirmada: los menores de 18 **no pueden** completar la matrícula online.
Deben realizar el trámite notarial y presentarse físicamente en la sucursal para que la
secretaria los inscriba en el flujo admin.

## ACs Afectados

- Ninguno en spec 0009 (edge case no cubierto en el diseño original) — fix autónomo sobre
  la lógica de edad.

## Cambio

- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`
- **Qué cambia:**
  1. `canAdvanceFn` — agregar `age !== 'requires-authorization'` a las condiciones de bloqueo.
  2. Template — reemplazar el bloque warning amarillo de `requires-authorization` por un
     estado terminal informativo (sin botón "Continuar") que explique: realizar trámite
     notarial → ir a la sucursal con el documento → la secretaria inscribe.

## Test de Regresión

- `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.spec.ts`
  - `canAdvanceFn > bloquea requires-authorization (17-18 años)` ✓
  - `canAdvanceFn > permite ok (18+ años Clase B)` ✓
  - `getAgeStatus > retorna requires-authorization para edad 17` ✓
