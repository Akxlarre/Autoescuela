# Fix: Flash de texto incorrecto en Pagos de alumno Clase B
> id: fix-060-b-flash-texto-pagos-clase-b
> refs: ASG-032 (specs/assignments/ASG-032-fix-h036-flash-texto-pagos.md)
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
**[Heredado de ASG-032, a confirmar]:** Al navegar a "Pagos y Clases" como alumno de Clase B
justo tras el login, por una fracción de segundo se ve el subtítulo "Resumen de pagos de tu
matrícula profesional" (el valor por defecto de `heroSubtitle` en `alumno-pagos.component.ts`,
que depende de `facade.isClassB()` — falso mientras la matrícula no ha cargado) antes de
cambiar correctamente a "Paga tu saldo pendiente para completar tu matrícula". Cosmético, dura
menos de un segundo, pero es un mensaje de negocio incorrecto mientras carga.

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgo H-036).

## Cambio
- `src/app/features/alumno/pagos/alumno-pagos.component.ts` — `heroSubtitle` computed: agregar
  guard `if (!enroll) return '<texto neutro>'` **antes** de ramificar por `isClassB()`, en vez
  de asumir "profesional" como default mientras `facade.enrollment()` es `null` (carga inicial).

## Test de Regresión
- `src/app/features/alumno/pagos/alumno-pagos.component.spec.ts` (nuevo archivo, no existía
  spec para este componente): 4 casos —
  - `enrollment() === null` (carga inicial) → `heroSubtitle()` = texto neutro de carga, **no**
    el texto de "matrícula profesional" (reproduce H-036).
  - Clase B con saldo pendiente → subtítulo de pago Clase B.
  - Profesional con saldo pendiente → aviso de regularizar en secretaría.
  - Profesional sin saldo pendiente → resumen genérico.

## Notas
- Fix acotado a un solo archivo de producción, sin cambios de modelo ni de facade.
