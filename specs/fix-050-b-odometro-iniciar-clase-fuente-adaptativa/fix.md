# Fix: Odómetro de "Iniciar clase" corta números de 6 dígitos
> id: fix-050-b-odometro-iniciar-clase-fuente-adaptativa
> refs: —
> status: done
> closed: 2026-07-17
> created: 2026-07-16

## Root Cause
En el drawer "Iniciar clase" (`admin-iniciar-clase-drawer`), el input de kilometraje es un
odómetro de ancho FIJO `w-36` (144px) con fuente `text-5xl` (48px). A ese tamaño solo caben
~5 dígitos (medido: 45000 = 134px). Pero `max="999999"` admite 6 dígitos, y los odómetros
reales llegan a 6 cifras → un valor de 6 dígitos mide ~161px y **se sale 17px de la caja**,
perdiéndose la visualización del número.

## ACs Afectados
Ninguno funcional — bug de presentación. No cambia validación (min 0, max 999999) ni el
flujo de iniciar clase.

## Cambio
- **Archivo (nuevo):** `src/app/core/utils/odometer.utils.ts` — función pura
  `odometerFontTier(value)` que devuelve el tier de fuente (`'5xl' | '4xl' | '3xl'`) según
  la cantidad de dígitos, para que el número SIEMPRE quepa en la caja fija (Functional Core).
- **Archivo (nuevo):** `src/app/core/utils/odometer.utils.spec.ts` — tests de la función.
- **Archivo:** `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.ts`
  - Signal `kmValue` alimentado por `kmStart.valueChanges` (OnPush-safe) + `computed`
    `kmFontTier` = `odometerFontTier(kmValue())`.
  - El input pasa de `text-5xl` fijo a `[class.text-5xl/4xl/3xl]` según el tier: grande para
    ≤5 dígitos, se achica a 6 y 7+ para que quepa completo. Caja `w-36` intacta.

## Test de Regresión
- `src/app/core/utils/odometer.utils.spec.ts` verde (tiers por cantidad de dígitos).
- `npm run test:ci` verde.
- `ng build` compila.
- `/verify` (Playwright): con 6 dígitos (999999) el número se ve completo dentro de la caja
  (`scrollWidth <= clientWidth`), sin cortarse. Light + dark.
