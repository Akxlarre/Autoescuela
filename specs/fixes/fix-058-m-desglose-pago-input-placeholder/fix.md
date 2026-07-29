# Fix: Inputs de desglose de pago muestran "0" real en vez de placeholder
> id: fix-058-m-desglose-pago-input-placeholder
> refs: —
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
En `registrar-pago-drawer.component.ts`, los 4 controles del desglose de pago (`cash_amount`, `transfer_amount`, `card_amount`, `voucher_amount`) se inicializan con valor real `0` (no `null`), a diferencia de `total_amount` que se inicializa en `null`. El HTML ya tiene `placeholder="0"` en los 4 inputs, pero como Angular setea `value="0"` (un valor real, no vacío), el navegador nunca muestra el placeholder — muestra el "0" como texto real dentro del input. Al hacer click y escribir sin seleccionar todo el contenido primero, el nuevo dígito se inserta junto al "0" existente (ej. escribir "90000" da "090000").

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo (hallazgo de QA manual del usuario)

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/admin/pagos/registrar-pago-drawer.component.ts`
- **Qué cambia:** valor inicial de `cash_amount`, `transfer_amount`, `card_amount`, `voucher_amount` cambia de `0` a `null` (en la definición del form y en `resetForm()`), igual que `total_amount`. El resto de la lógica (`sumMatchesTotalValidator`, `balanceStatus`, `onSubmit()`) ya usa `?? 0` en todos lados, así que es null-safe sin cambios adicionales.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `registrar-pago-drawer.component.spec.ts > los campos de desglose inician en null (no en 0) para que el placeholder sea visible` ✓
