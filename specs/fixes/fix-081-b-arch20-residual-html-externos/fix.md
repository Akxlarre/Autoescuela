# Fix: ARCH-20 residual — 2 botones icon-only en templates .html externos
> id: fix-081-b-arch20-residual-html-externos
> refs: ASG-b-054, fix-079-b
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

Al cablear ARCH-20 (guardrail nuevo de fix-079-b) en `scripts/architect.js` y correr
`npm run lint:arch -- --update-ds-baseline`, el linter encontró **2 errores reales**:
botones icon-only sin `aria-label` en `matricula-steps/documents/documents.component.html`
y `matricula-steps/payment/payment.component.html`.

Estos 2 nunca aparecieron en el inventario de fix-079-b (que decía "94/94 resueltos, 0
restantes") porque el script de auditoría original solo escaneaba
`git ls-files "src/app/**/*.ts"` — **nunca miró templates externos `.html`**. Es un tercer
punto ciego del mismo audit, distinto a los otros dos ya documentados en fix-079-b (falsos
positivos `pButton label=` y el bug de `@if/@else`).

## ACs Afectados

Ninguno — fix autónomo, continuación directa de fix-079-b / ASG-b-054.

## Archivos involucrados

- `src/app/shared/components/matricula-steps/documents/documents.component.html`
- `src/app/shared/components/matricula-steps/payment/payment.component.html`

## Cambio

- `payment.component.html:106-111` — botón `x` con `(click)="clearDiscount()"` →
  `aria-label="Quitar descuento"` (mismo patrón/texto que
  `admin-curso-singular-inscribir-drawer.component.ts` en fix-079-b, mismo verbo).
- `documents.component.html:116-120` — botón `x` sobre el preview de la foto del carnet
  → `aria-label="Quitar foto"`. **Hallazgo colateral, no corregido acá**: este botón
  **no tiene `(click)` handler** — no existe ningún método `removePhoto`/`retake` en
  `documents.component.ts`. Es un botón inerte (bug de funcionalidad preexistente,
  no de accesibilidad). Fuera de alcance de este fix — el label describe la acción
  intencionada por el ícono/posición, no valida que la acción exista.

## Test de Regresión

- `npm run lint:arch` → **exit 0, 0 errores** (ARCH-19 y ARCH-20 corriendo, ambos limpios).
- `npx tsc --noEmit` → sin errores en los 2 archivos tocados.
- `npm run test:ci` → **1651 passed, 3 skipped (pre-existentes), 0 failed, exit 0**
  (136/137 archivos, 181s). Idéntico al baseline — sin regresiones.
