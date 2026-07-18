# Fix: app-badge como fuente única — consume badge-*, corrige info y token muerto
> id: fix-036-b-app-badge-fuente-unica
> refs: —
> status: done
> closed: 2026-07-08
> created: 2026-07-08

## Root Cause
Tres definiciones de "badge" coexisten sin relacionarse: (1) tokens Capa 4
`--badge-radius`/`--badge-padding-x/y` en `_variables.scss`, huérfanos (nadie los consume);
(2) utilidades `badge-{warning,success,error,info}` en `tailwind.css` con radio/padding
hardcodeados (ignoran los tokens de (1)), 0 usos reales; (3) componente `app-badge`
(`shared/components/badge/`) con CSS inline propio vía `getClasses()`, 0 usos reales.
`app-badge` tiene además una clase muerta (`text-brand-primary`, sin equivalente en
`@theme`) en sus variants `info`/`default`, y su variant `info` usa color de MARCA en vez
de color de ESTADO, inconsistente con `success`/`warning`/`error` (todas `--state-*`) y con
la utilidad `badge-info` de `tailwind.css` (que sí usa `--state-info`).

Decisión del usuario (fase 4 del roadmap de botones, `docs/BACKLOG-DEUDA-TECNICA.md`):
`app-badge` pasa a consumir las utilidades `badge-*` (fuente única); `info` = `--state-info`
(azul, alineado con la familia de estado). Como consecuencia directa: `default`/`neutral`
se fusionan en un solo variant neutral, y el escape hatch de clases crudas
(`if (variant().includes('bg-')) return variant();`) se elimina — es incompatible con
"app-badge sin CSS propio" (0 usos, sin riesgo de romper nada).

## ACs Afectados
Ninguno — fix autónomo (groundwork de fase 4, `app-badge` no tiene usos en producción).

- AC-1: `--badge-radius`/`--badge-padding-x/y` (Capa 4) son consumidos por las utilidades
  `badge-*` de `tailwind.css` (reemplazan los valores hardcodeados `radius-md`/`0.125rem 0.5rem`).
- AC-2: Nueva utilidad `badge-neutral` (bg-subtle/text-secondary, mismos tokens del variant
  `neutral` actual) usando los tokens de badge de Capa 4.
- AC-3: `app-badge` template se reduce a `[class]="'badge-' + variant()"` — sin CSS Tailwind
  propio, sin `getClasses()`. Union type: `'success' | 'warning' | 'error' | 'info' | 'neutral'`
  (sin `default` como variant separado, sin escape hatch de string libre).
- AC-4: `info` renderiza con `--state-info` (azul), no con `bg-brand-muted`/`text-brand-primary`.
- AC-5: 0 clases muertas en `badge.component.ts` (ARCH-11 limpio).
- AC-6: `indices/COMPONENTS.md` refleja el nuevo contrato de `app-badge` (variants, sin CSS propio).

## Cambio
- **Archivo:** `src/tailwind.css` — utilidades `badge-{warning,success,error,info}` migran a
  `var(--badge-radius)`/`var(--badge-padding-y) var(--badge-padding-x)`; nueva `badge-neutral`.
- **Archivo:** `src/app/shared/components/badge/badge.component.ts` — template delegado a
  `badge-*`, union type de variant simplificado, sin `getClasses()`.
- **Archivo:** `indices/COMPONENTS.md` — actualizar entrada de `app-badge`.

## Test de Regresión (ejecutado — todo verde)
- 0 consumidores de `app-badge` en `src/app` confirmado ✅ — sin riesgo de regresión visual
- **Bug real encontrado y corregido durante la implementación** (dentro del scope de AC-3,
  no requirió nuevo track): el primer intento del template usaba `[class]="'badge-' + variant()"`
  (concatenación dinámica). Tailwind v4 poda las clases `@utility` por contenido escaneado
  igual que cualquier utilidad — el scanner no puede evaluar la concatenación, así que
  `badge-neutral` nunca generaba CSS (0 reglas en el stylesheet servido, confirmado con
  Playwright recorriendo `document.styleSheets` recursivamente por `@layer`). Las otras 4
  sobrevivían por colisiones accidentales (uso local en `vehicle-documents-drawer`, ícono
  Lucide llamado `badge-info`), no por diseño. Corregido con `computed()` + `switch` que
  retorna strings literales completos — patrón ya usado en el resto del proyecto.
- `npm run lint:arch` → exit 0 (155, bajó de 156 — el ratchet reconoció la mejora) ✅
- ARCH-11 sin marcar `badge.component.ts` (0 clases muertas, confirmado con
  `findDeadTokenClasses` directo) ✅ (AC-5)
- `ng build` → exit 0 ✅
- Playwright (`localhost:4200`, recorrido recursivo de `@layer` en `document.styleSheets`):
  las 5 clases presentes tras el fix (1 regla c/u). Computed styles verificados en dark y
  light: `radius: 9999px` (`--badge-radius`), `padding: 4px 12px` (`--badge-padding-y/x`)
  en los 5 ✅ (AC-1, AC-2); `info` → `rgb(56,189,248)` dark / `rgb(3,105,161)` light =
  `--state-info`, NO marca ✅ (AC-4); `neutral` → `--bg-subtle`/`--text-secondary` en
  ambos modos ✅ (AC-2). Consola: 0 errores.
- `indices/COMPONENTS.md`: sin cambios necesarios (`variant` sigue siendo el único input,
  auto-detectado por AST, confirmado con `npm run indices:sync`) ✅ (AC-6)
- `indices/STYLES.md`: sección "Badge de estado" actualizada con los tokens de Capa 4,
  `badge-neutral`, y el gotcha del purge de Tailwind documentado para que no se repita
