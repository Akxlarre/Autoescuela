# Fix: Revertir alias text-secondary/muted/disabled + guardrail anti-recurrencia
> id: fix-033-b-revertir-alias-texto-corto
> refs: fix-030-tokens-texto-muertos (reabre su cierre)
> status: done
> closed: 2026-07-08
> created: 2026-07-07

## Root Cause
`fix-030` (spec 0019) estableció `text-text-{primary,secondary,muted}` como única forma
canónica, migró 561 usos y cerró el punto ciego del linter (ARCH-11 v2) para clases muertas.
El commit `a4675ee` (motor Ciclos Teóricos, 04-jul) escribió 3 componentes nuevos/reescritos
usando la forma corta (`text-secondary`, `text-muted`) sin saber que estaba muerta. Al notar
que no renderizaba, en vez de migrar las líneas al canon, agregó 3 alias al `@theme` de
`tailwind.css` (`--color-secondary/muted/disabled`) que resucitan la forma corta.

Auditoría (2026-07-07): esos alias tienen **0 usos fuera de esos 3 archivos** — no fueron
adoptados como convención, fue un parche puntual de una sola sesión.

**Por qué esto puede repetirse:** ARCH-11 (clases muertas) solo detecta clases que NO
generan CSS. En cuanto el alias existe en `@theme`, la clase "muerta" pasa a ser válida y
ARCH-11 deja de marcarla — el guardrail existente es ciego exactamente al mecanismo que
causó la regresión. Revertir sin blindar deja la puerta abierta a que la próxima sesión
repita el mismo atajo.

## ACs Afectados
Ninguno — fix autónomo (integridad del design system).

- AC-1: `tailwind.css` no define `--color-secondary`, `--color-muted` ni `--color-disabled`
  bare en el `@theme` (0 resultados).
- AC-2: Los 31 usos reales (`asistencia-clase-b-content.component.ts`,
  `ciclos-teoricos-content.component.ts`, `certificacion-clase-b-content.component.ts`)
  migran a `text-text-{secondary|muted}`. 0 usos de la forma corta en `src/app/`.
- AC-3: Nuevo guardrail ARCH-18 — falla si `tailwind.css` vuelve a definir cualquiera de
  esos 3 alias (o `--color-primary` bare, preventivo) en el `@theme`. A diferencia de
  ARCH-11 (audita el USO en componentes), ARCH-18 audita la DEFINICIÓN del bridge mismo.
- AC-4: `indices/ANTI-PATTERNS.md` documenta el patrón correcto: "si `text-X` no renderiza,
  migra las líneas a `text-text-X`; NUNCA agregues un alias bare al `@theme`".

## Cambio
- **Archivo:** `src/tailwind.css` — elimina las 3 líneas de alias.
- **Archivos:** los 3 componentes con los 31 usos — migración mecánica a `text-text-*`.
- **Archivo:** `scripts/lib/theme-tokens.js` (o lib nueva) — función de detección de alias
  prohibidos en `@theme`.
- **Archivo:** `scripts/architect.js` (protegido, vía staging) — regla ARCH-18.
- **Archivo:** `indices/ANTI-PATTERNS.md` — AP-015.

## Test de Regresión (ejecutado — todo verde)
- Micro-suite `theme-tokens.test.mjs` (extendida): `findForbiddenThemeAliases` con @theme
  limpio (0 falsos positivos, sufijos `--color-border-muted`/`--color-brand-muted`
  preservados), @theme sucio (detecta `--color-secondary`+`--color-muted`, no
  `--color-text-secondary`), y contra el `tailwind.css` real → 0 ✅
- Codemod `scripts/migrate-short-text-tokens.mjs`: primer intento (substring ciego) tenía
  un bug que corrompía `var(--text-muted)` en 109 archivos incl. `dashboard.facade.ts`
  (sin templates) — detectado con `--dry` antes de aplicar. Reescrito con ámbito estricto
  a `class="..."` (mismo patrón `extractClassAttributes` de class-discipline.js) →
  31 reemplazos en exactamente los 3 archivos esperados, coincide con la auditoría manual ✅
- Grep de los 3 alias en `tailwind.css` → 0 ✅ (AC-1); grep de formas cortas en `src/app` → 0,
  `var(--text-*)` intacto en `weekly-schedule-grid`/`tabs`/`dashboard.facade` (13+2+3) ✅ (AC-2)
- ARCH-18 probado end-to-end: reinserción temporal del alias → dispara error con el `key`
  correcto; removido → limpio de nuevo ✅ (AC-3)
- `npm run lint:arch` → exit 0 (156 warnings, +1 vs baseline por ruido pre-documentado de
  Prettier en ARCH-09, no regresión) ✅
- Playwright (`localhost:4200`, sesión ya autenticada): `text-text-secondary`→
  `rgb(161,161,170)`, `text-text-muted`→`rgb(113,113,122)` (colores reales y distintos);
  `text-secondary`/`text-muted` → `rgb(244,244,245)` = heredan de `body` (muertas de
  verdad). Consola: 0 errores ✅
- `indices/ANTI-PATTERNS.md` → AP-015 documentado ✅ (AC-4)
