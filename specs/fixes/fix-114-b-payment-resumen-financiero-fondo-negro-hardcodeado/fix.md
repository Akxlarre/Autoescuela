# Fix: Tarjeta "Resumen Financiero" usa `bg-black` hardcodeado — reemplazar por `.card-tinted`
> id: fix-114-b-payment-resumen-financiero-fondo-negro-hardcodeado
> refs: —
> status: done
> closed: 2026-08-03
> created: 2026-08-03

## Root Cause

Continuación de `fix-113-b` (que dejó `bg-black` fuera de alcance a propósito). El dueño del
producto pidió reconsiderarlo: la tarjeta "Resumen Financiero" del wizard interno de matrícula
(`payment.component.html:44`) usa `bg-black` — negro Tailwind hardcodeado — para simular una
tarjeta tipo "recibo premium". Esto rompe la identidad visual del DS: ningún otro componente de
la app usa un fondo negro sólido fuera de tema; el sistema ya tiene una clase canónica para
tarjetas destacadas (`.card-tinted`, `.claude/rules/visual-system.md` §Cards) que aplica un
gradiente sutil de marca sobre el fondo de card normal (`var(--gradient-subtle), var(--card-bg)`),
adaptado automáticamente a claro/oscuro. `bg-black` + los parches de `fix-113-b`
(`var(--color-primary-text)` forzado) eran un remiendo sobre un fondo que nunca debió ser
hardcodeado.

## ACs Afectados

Ninguno — fix autónomo de identidad visual, sin AC de spec previa.

## Cambio

- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.html`
- **Qué cambia:**
  - Contenedor (línea 44): `bg-black ... text-surface` (+ el `style="color: var(--color-primary-text)"`
    agregado en fix-113-b) → `card-tinted` (clase canónica del DS para tarjetas destacadas).
    Se elimina el forzado de color de texto — ya no hace falta, `.card-tinted` mantiene el
    contraste correcto del theme normal en ambos modos.
  - "Valor Base del Curso": el parche `color-mix(..., var(--color-primary-text) 60%, ...)` de
    fix-113-b → `text-text-secondary` (token normal, ya no hace falta el color-mix defensivo).
  - Valor del precio base (span sin clase de color): se agrega `text-text-primary` explícito.
  - Borde divisor `border-surface/10` → `border-border-subtle` (token normal de borde).
  - Precio total (`text-4xl font-black tracking-tight` + parche fix-113-b): se reemplaza por
    `.kpi-value` — la clase canónica del vocabulario tipográfico del DS para números KPI grandes
    (`.claude/rules/visual-system.md` §Vocabulario tipográfico: "Número KPI grande → `.kpi-value`,
    reemplaza a `text-4xl font-bold`"). Antes de este fix ya era candidato a esta migración,
    independiente del bug de contraste.
  - "IVA incluido": el parche `color-mix(..., 40%, ...)` de fix-113-b → `text-text-muted`.
  - Sin cambios: el ícono `banknote` de fondo (ahora hereda color normal del texto, sigue sutil
    por el `opacity-10` del wrapper), el label "Total Final a Pagar" (`text-brand`, ya era un
    token correcto, no tocado), la fila de descuento (`text-success`, sin cambios).

## Test de Regresión

Resultado (2026-08-03):

- Verificación en vivo con Playwright, retomando el draft real (Pedro Pablo Fernandez, Paso 5/6
  — Pago) en `/app/admin/matricula`:
  - Modo claro: tarjeta `.card-tinted` con gradiente sutil de marca, texto oscuro legible,
    coherente con el resto de las tarjetas destacadas de la app ✓
  - Modo oscuro: tarjeta elevada oscura con gradiente sutil, texto blanco legible, mismo lenguaje
    visual que el resto del DS — ya no es un bloque negro sólido ajeno al tema ✓
- `npx ng build` — compiló sin errores (53s, único warning es el budget de bundle pre-existente,
  no relacionado) ✓
- `npm run lint:arch` — 0 errores, 169 advertencias (idéntico al baseline, sin hallazgos nuevos) ✓
