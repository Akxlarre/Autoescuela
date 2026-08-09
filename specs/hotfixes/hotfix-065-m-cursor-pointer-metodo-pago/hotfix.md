# Hotfix: Falta cursor-pointer en botones de método de pago (paso 5 matrícula)
> id: hotfix-065-m-cursor-pointer-metodo-pago
> refs: —
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema
En el paso 5 (Método de Pago) de matrícula, los botones de selección de método de pago
(Efectivo, Transferencia, Débito/Crédito, Dejar pago pendiente) no muestran `cursor:
pointer` al hacer hover, a diferencia del resto de botones interactivos del wizard (ej.
"Volver"). El botón "Aplicar Descuento", justo arriba, tiene el mismo problema.

## Cambios
- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.html` — agregar `cursor-pointer` a la clase del `<button>` de cada opción de método de pago (línea ~202) y del botón "Aplicar Descuento" (línea ~182).
