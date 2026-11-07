# Fix: Configuración web — precio promocional sin validar y promo activa sin texto
> id: fix-493-m-configuracion-web-precio-promo-y-promo-sin-texto
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

Dos campos de Configuración web sin la validación que su pantalla promete:

1. **Precio promocional (S18 / L08 / L09 de `fix-485-m`, visto en navegador).** La casilla
   "Personalizar precio" no tenía control propio: se deducía de `priceOverride != null`. Al
   marcarla, el precio quedaba en 0 ("Gratis") de inmediato; aceptaba negativos ("$-5.000", el
   `min="0"` del HTML no valida); y al borrar el número para reescribirlo la casilla se desmarcaba
   y el campo desaparecía. Contra AC8 de `0003-b`.
2. **Promo activa sin texto (M03).** Título, etiqueta y detalle llevan "*" pero no tenían
   validadores: se podía publicar un banner vacío.

## ACs Afectados

- `0003-b` AC8 (no se publica con datos inválidos).

## Cambio

- **`core/utils/website-config.utils.ts`:** `courseCardControls(card?)` arma los controles de una
  card de curso en un solo lugar (antes se repetían en el componente y en la pestaña), con
  `overrideEnabled` propio y `priceOverride` ≥ 0; `courseOverrideValidator` exige el precio si la
  casilla está marcada; `promoTextValidator` exige título, etiqueta y detalle si la promo está
  activa.
- **`features/admin/configuracion-web/admin-configuracion-web.component.ts`:** usa
  `courseCardControls` al cargar, `promoTextValidator` en el grupo de promo, y publica el precio
  solo si la casilla está marcada.
- **`tabs/cursos-tab.component.ts`:** la casilla es el control `overrideEnabled`; al marcarla se
  precarga el precio base del catálogo (no 0); mensaje si falta o es negativo.
- **`tabs/promo-tab.component.ts`:** mensaje cuando la promo activa tiene campos vacíos.

## Test de Regresión

- `core/utils/website-config.utils.spec.ts > fix-493-m` ✓
- Navegador: marcar la casilla precarga el precio base; −5.000 y vacío bloquean publicar; promo
  activa sin título bloquea publicar. ✓ (2026-11-07: precarga $180000; −5.000 → "El precio no puede ser negativo."; vacío → el campo sigue visible y pide el precio; captura `c485-14-override.png`)
