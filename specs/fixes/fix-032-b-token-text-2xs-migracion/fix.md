# Fix: Formalizar token text-2xs (10px) y migrar micro-textos arbitrarios
> id: fix-032-b-token-text-2xs-migracion
> refs: —
> status: done
> closed: 2026-07-07
> created: 2026-07-06

## Root Cause
La escala tipográfica del DS termina en `--text-xs` (12px), pero la UI real necesita
micro-textos de 10-11px: hay 238 instancias de `text-[10px]`/`text-[11px]` (valores JIT
arbitrarios) en 57+ archivos, más 14 instancias de valores arbitrarios que duplican
tokens existentes (`text-[12px]`=xs, `text-[14px]`=sm, `text-[16px]`=base, `text-[18px]`=lg).
El sistema de diseño está incompleto, no los usos: falta el token.

## ACs Afectados
Ninguno — fix autónomo (fase 3 del roadmap de botones/DS, guardrail ARCH-17/AP-014).

- AC-1: Existe `--text-2xs: 0.625rem` (10px) en la escala de `_variables.scss` y en el
  `@theme` de `tailwind.css` → la clase `text-2xs` genera CSS real (font-size 10px,
  sin line-height forzado — mismo comportamiento que el valor arbitrario).
- AC-2: 0 instancias de `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[14px]`,
  `text-[16px]`, `text-[18px]` en `src/app/`.
- AC-3: ARCH-11 no marca `text-2xs` como clase muerta; ARCH-17 baseline re-consolidado
  a solo los tamaños fuera de scope (8/9/13/15/17/22px, pendientes de decisión de diseño).
- AC-4: `ng build` verde y font-size computado de `.text-2xs` = 10px en navegador real.

## Cambio
- **Archivo:** `src/styles/tokens/_variables.scss` — token `--text-2xs` en Capa 1.
- **Archivo:** `src/tailwind.css` — bridge `--text-2xs` en `@theme`.
- **Archivo:** `scripts/migrate-text-2xs.mjs` — codemod (patrón migrate-*.mjs existente).
- **Archivos:** `src/app/**/*.{ts,html}` — reemplazo mecánico de los 6 valores arbitrarios.

## Test de Regresión (ejecutado — todo verde)
- Micro-suites `theme-tokens.test.mjs` y `class-discipline.test.mjs` ✅
  (theme-tokens estaba ROTA pre-existente: a4675ee agregó alias `--color-secondary/muted/disabled`
  al @theme sin actualizar la suite → `text-secondary`/`text-muted` ya no son clases muertas;
  suite actualizada a la realidad commiteada)
- Grep de los 6 patrones migrados → **0** ✅ (AC-2; 252 reemplazos en 57 archivos)
- ARCH-11 no marca `text-2xs` ✅; ratchet ARCH-17: backlog 312 → 66, sin regresiones,
  baseline re-consolidado ✅ (AC-3)
- `ng build` exit 0 ✅ + Playwright: `.text-2xs` computa font-size 10px con line-height
  heredado (idéntico a `text-[10px]`) en localhost:4200 ✅ (AC-1, AC-4)
- Captura: `fix032-login-post-migracion.png` (.playwright-mcp)
