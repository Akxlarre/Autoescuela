# Fix: Se puede guardar un descuento cuyo "Vigente hasta" es anterior a "Vigente desde"
> id: fix-056-i-descuento-hasta-antes-de-desde
> refs: fix-048-i-testing-pagos-y-descuentos (B4-1, caso L13)
> status: done
> closed: 2026-10-16
> created: 2026-10-16

## Root Cause

`DescuentosDrawerComponent.canSave` valida nombre, valor y porcentaje ≤ 100, pero no compara
las fechas: un descuento con "hasta" anterior a "desde" se guarda y nunca aparece en el paso de
pago (la consulta pide `valid_from` ≤ hoy ≤ `valid_until`), sin que nadie se entere. La BD
tampoco lo frena; solo el admin puede crear descuentos (la secretaria queda fuera por RLS, caso
L03), así que el riesgo real está en el formulario.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B4-1). Criterios de este fix:

- **AC-F1:** si "Vigente hasta" es anterior a "Vigente desde", "Guardar" queda deshabilitado y se
  ve "La fecha 'hasta' no puede ser anterior a 'desde'".
- **AC-F2:** "hasta" vacío (sin vencimiento) o igual a "desde" sigue permitido.

## Cambio

- **Archivo:** `src/app/features/admin/configuracion-descuentos/descuentos-drawer.component.ts`
- **Qué cambia:** `computed` `vigenciaInvalida` que bloquea `canSave` y muestra el aviso bajo
  "Vigente hasta".
- **Archivo:** `src/app/features/admin/configuracion-descuentos/descuentos-drawer.component.spec.ts`
  (nuevo).

## Test de Regresión

- `descuentos-drawer.component.spec.ts` (hasta < desde bloquea; vacío o igual, no).

## Progreso

- [x] Spec nuevo 3/3, `tsc` limpio, `lint:arch` 0 errores (2026-10-16).
- [x] Suite completa: 4248 en verde; los únicos 3 en rojo son de `vehicle-maintenances.component.spec.ts`
      (Flota, ya en rojo en main `c66aacec`, ver ASG-i-064), sin relación con este fix.
- [x] QA en navegador omitida por decisión de Ignacio (2026-10-16): validación de formulario
      cubierta por el spec.
