# Hotfix: Descuento predefinido — cursor, label con % y botón Quitar
> id: hotfix-088-m-descuento-predefinido-cursor-label-quitar
> refs: —
> status: done
> closed: 2026-08-21
> created: 2026-08-21

## Problema
En el Paso de Pago (matrícula), la sección de "Descuentos disponibles": (1) el botón de un
descuento predefinido no muestra `cursor: pointer` al hoverear; (2) una vez aplicado, el label
solo muestra el nombre del descuento (ej. "Promoción fin de agosto") sin el porcentaje/monto fijo
que representa; (3) el botón para quitar el descuento es un ícono `x` suelto en vez del patrón
"Quitar" con ícono `trash-2` ya usado en el paso de Documentos (foto carnet).

## Cambios
- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.html` —
  agregar `cursor-pointer` al botón de descuento predefinido; mostrar el label con
  porcentaje/monto; reemplazar el botón `x` por un botón "Quitar" con ícono `trash-2` (mismo
  patrón visual que `documents.component.html`).
- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.ts` —
  agregar `computed()` que arma el label del descuento aplicado (nombre + % o monto) buscando en
  `availableDiscounts` por `selectedDiscountId`; fallback al `reason` crudo si es descuento manual.
