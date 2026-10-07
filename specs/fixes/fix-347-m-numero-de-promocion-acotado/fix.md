# Fix: Un número de promoción mal tipeado corre toda la numeración automática
> id: fix-347-m-numero-de-promocion-acotado
> refs: ASG-i-025 · fix-319-m (M08, K07, D19) · fix-323-m
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause
El número de una promoción manual solo se valida como "dígitos" (`isValidPromotionCode`,
`promotion-code.utils.ts:17`). Como la siguiente automática toma **el mayor número existente + 1**
(`reserve_next_promotion_slot`) y el formulario sugiere lo mismo, un número mal tipeado deja la
numeración corrida para siempre: en el testing, una promoción de prueba con el 9001 hizo que el
formulario sugiriera 9003 y el cron habría seguido desde ahí. Además se acepta `0`.

Decisión **D19** (Matías, 2026-10-06): limitar el número de una promoción manual.

## ACs Afectados
Ninguno — endurece la validación del número de `fix-323-m`.

## Cambio
Regla: el número debe ser **mayor que 0 y como máximo "el último usado + 10"**. Hacia abajo no hay
límite (se puede usar un número libre anterior; la unicidad la sigue garantizando la BD). El margen
de 10 deja programar varias manuales por adelantado y corta los errores de tipeo (2830 por 283).

- `src/app/core/utils/promotion-code.utils.ts` — `isValidPromotionCode` deja de aceptar `0` y ceros
  a la izquierda; nuevas `maxPromotionCode()` y `promotionCodeError()` (mensaje para el usuario, o
  `null` si el número sirve).
- `src/app/core/facades/promociones.facade.ts` — `fetchMaxPromotionCode()`; `suggestNextCode()` la
  reutiliza.
- Drawers de crear y editar — cargan el último número usado al abrir y muestran el mensaje de
  `promotionCodeError()`; no se puede guardar con un número fuera de rango.

La validación es del formulario: no se agrega restricción en BD (el cron y los números históricos
no pasan por él).

## Test de Regresión
- `promotion-code.utils.spec.ts`: `0` y `007` inválidos; mayor número; mensajes de vacío, letras,
  cero y fuera de rango; el límite exacto (último + 10) se acepta.
- Specs de los drawers de crear y editar: un número fuera de rango no deja guardar.

## Progreso
- [x] Utilidad + facade + drawers de crear y editar, con sus tests. Vitest: 81/81 en los 5 archivos
  de Promociones (21 utilidad, 28 facade, 18 editar, 7 crear, 7 página).
- [x] En editar, el número que la promoción ya tiene guardado siempre sirve: el tope aplica a
  números nuevos, no invalida uno histórico (si no, la promoción de prueba 9002 no se podría
  editar).
- [x] Revisión en navegador (admin, 2026-10-06; último número usado 9002 por la promoción de
  prueba): crear con `0` → "Debe ser un número mayor que 0, sin ceros delante."; `9013` → "No
  puede ser mayor que 9012: el último número usado es 9002."; `9012` y `150` sirven; vacío y
  letras conservan sus mensajes. Editar la 282 con `99999` → mismo mensaje y "Guardar cambios"
  deshabilitado.
