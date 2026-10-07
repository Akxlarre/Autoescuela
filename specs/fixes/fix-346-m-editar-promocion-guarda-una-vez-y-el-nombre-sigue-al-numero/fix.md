# Fix: Editar promoción guarda dos veces con doble clic y el nombre no sigue al número
> id: fix-346-m-editar-promocion-guarda-una-vez-y-el-nombre-sigue-al-numero
> refs: ASG-i-025 · fix-319-m (L04, D18) · fix-323-m
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause
Dos defectos del mismo formulario (`admin-promocion-editar-drawer.component.ts`), vistos en L04:

1. **Doble guardado.** `submit()` no revisa si ya hay un guardado en curso. El botón muestra el
   estado de carga, pero el `(click)` está en el componente `app-async-btn` (no en el `<button>`
   interno), así que un segundo clic vuelve a entrar: 2 escrituras y 2 toasts "Promoción
   actualizada correctamente". El drawer de crear no tiene el problema (cierra al primer éxito y
   su segundo INSERT chocaría con la unicidad), pero tampoco tiene la guarda.
2. **Nombre desfasado.** El nombre se genera con el número al crear ("Promoción 9001 (30 de
   Noviembre 2026)"), pero al editar el número el nombre queda igual: la promoción termina llamándose
   "Promoción 9001" con número 9002.

Decisión **D18** (Matías, 2026-10-06): al cambiar el número, el nombre se actualiza solo.

## ACs Afectados
Ninguno — corrige el formulario de edición de `fix-323-m`.

## Cambio
- `src/app/core/utils/promotion-code.utils.ts` — función pura `promotionNameForCode()`: si el
  nombre guardado es el automático de su número ("Promoción N (…)"), devuelve el mismo nombre con
  el número nuevo; un nombre escrito a mano se deja como está.
- `src/app/features/admin/profesional-promociones/admin-promocion-editar-drawer.component.ts` —
  al cambiar el número, el nombre lo sigue mientras el usuario no lo haya editado a mano; `submit()`
  ignora un segundo clic mientras hay un guardado o una confirmación en curso.
- `…/admin-promocion-crear-drawer.component.ts` — misma guarda en `submit()`.

## Test de Regresión
- `promotion-code.utils.spec.ts`: nombre automático sigue al número; nombre a mano no cambia;
  número inválido no rompe el nombre.
- `admin-promocion-editar-drawer.component.spec.ts`: cambiar el número cambia el nombre; si el
  nombre se editó a mano no se toca; dos `submit()` seguidos → una sola llamada a
  `editarPromocion`.

## Progreso
- [x] Utilidad + drawers de editar y crear, con sus tests. Vitest: 44/44 en los 4 archivos de
  Promociones (15 utilidad, 16 editar, 6 crear, 7 página).
- [x] Revisión en navegador (admin, 2026-10-06):
  - Promoción 282, sin guardar: al escribir 283 el nombre pasa a "Promoción 283 (2 de Noviembre
    2026)"; con un número inválido ("28a") vuelve al nombre guardado; tras escribir un nombre a
    mano, cambiar el número ya no lo toca.
  - Promoción de prueba (9002): doble clic en "Guardar cambios" → **una sola** escritura
    (`PATCH professional_promotions`). De paso su nombre quedó "Promoción 9002 (30 de Noviembre
    2026)".
