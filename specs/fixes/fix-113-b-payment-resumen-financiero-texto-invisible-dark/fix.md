# Fix: "Resumen Financiero" del wizard interno de matrícula ilegible en modo oscuro
> id: fix-113-b-payment-resumen-financiero-texto-invisible-dark
> refs: —
> status: done
> closed: 2026-08-03
> created: 2026-08-03

## Root Cause

`payment.component.html:44` — la tarjeta "Resumen Financiero" (Paso de Método de Pago del
wizard interno `secretaria-matricula` / `admin/matricula`, componente
`matricula-steps/payment/`) usa:

```html
<div class="bg-black rounded-2xl p-6 text-surface relative overflow-hidden shadow-xl">
```

`bg-black` es un negro Tailwind hardcodeado (no un token). `text-surface` es el token de
**fondo** de superficie (`--color-surface`), reusado por error como color de texto — pero ese
token cambia con el tema:

| Modo | `--color-surface` | Resultado visual |
|---|---|---|
| Claro | `#ffffff` | Texto blanco sobre negro — se ve bien, parece intencional |
| **Oscuro** | `#18181b` | Texto `rgb(24,24,27)` sobre fondo `rgb(0,0,0)` — contraste ~1:1, **ilegible** |

Confirmado en vivo con Playwright (`getComputedStyle`): en modo oscuro el precio "Total Final a
Pagar" y "Valor Base del Curso" son prácticamente invisibles.

El resto del DS ya resuelve exactamente este patrón ("texto claro fijo sobre superficie oscura
de marca") con `var(--color-primary-text)`, definido como `#ffffff` fijo en los 3 contextos de
tema (`_variables.scss:233,466`, `_public-enrollment.scss:128,203`) — es el mismo token que usa
`.surface-hero` ("el texto SIEMPRE en blanco", `visual-system.md`).

## ACs Afectados

Ninguno — fix autónomo (bug visual descubierto en vivo, no hallazgo de auditoría previa).

## Cambio

- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.html`
- **Qué cambia:** en la tarjeta de la línea 44, se reemplazan las 3 ocurrencias de color de
  texto dependientes de `text-surface`/clases relativas (`text-surface`, `text-surface/60`,
  `text-surface/40`, `text-brand` se mantiene) por `var(--color-primary-text)` vía `style`,
  fijando el texto en blanco sin importar el modo. `bg-black` se mantiene (fuera de alcance de
  este fix — es una decisión de diseño de la tarjeta "recibo negro premium", no el bug reportado;
  si el equipo quiere tokenizarlo también, es un fix aparte).

## Test de Regresión

Resultado (2026-08-03):

- Verificación en vivo con Playwright, retomando el draft real guardado (Pedro Pablo Fernandez,
  Paso 5/6 — Pago) en `/app/admin/matricula`:
  - Modo oscuro: "Valor Base del Curso" y "Total Final a Pagar" (180.000 $) ahora blancos,
    perfectamente legibles sobre la tarjeta negra ✓ (antes: `rgb(24,24,27)` sobre `rgb(0,0,0)`,
    prácticamente invisible)
  - Modo claro: sin cambios visuales respecto al comportamiento previo (texto blanco sobre negro,
    ya era legible) ✓ — confirma que el fix no rompe el caso que sí funcionaba
- `npx ng build` — compiló sin errores (107s, único warning es el budget de bundle pre-existente,
  no relacionado) ✓
- `npm run lint:arch` — 0 errores, 169 advertencias (idéntico al baseline, sin hallazgos nuevos
  sobre `payment.component.html`) ✓
