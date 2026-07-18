# Acceptance 0019-b — Whitelist @theme (2026-07-01)

> Ejecutado por Fable 5. Evidencia: `scripts/lib/theme-tokens.test.mjs` (28 casos) +
> corridas reales guardadas en `.claude/temp/lint-0019-{default,strict}.txt`.

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| AC1 (parser @theme) | ✅ | 34 tokens `--color-*` extraídos de `src/tailwind.css`; vocabulario DS de 24 segmentos |
| AC2 (clase muerta dispara + sugerencia) | ✅ | `text-primary → text-text-primary`, `bg-bg-base → bg-base`, `text-state-error → text-error`, `bg-surface-hover → bg-surface` (test suite) y sugerencias inline en la corrida real |
| AC3 (legítimas pasan) | ✅ | 18 casos válidos sin falso positivo: `text-sm`, `text-center`, `bg-gradient-primary`, `from-brand`, `text-[9px]`, `text-editor`, `border-collapse`, `via-white`… |
| AC4 (reemplaza lista negra) | ✅ | Regex hardcodeada eliminada de architect.js; los 4 patrones viejos cubiertos (test suite). La v2 además atrapó clases que la lista negra NUNCA conoció: `border-default`, `text-warning/success/error-dark`, `bg-brand-primary`, `text-bg-surface`, `border-success-muted` |
| AC5 (rollout 2 fases) | ✅ | Default: 12 warnings (20 clases muertas únicas) + resumen global; `npm run lint:arch -- --strict`: mismas 12 como ERROR (40→52 errores). Wrapper reenvía argv |
| AC-E1 (/N) | ✅ | `bg-surface/50`, `bg-brand-dark/20` pasan (test suite) |
| AC-E2 (variantes) | ✅ | `dark:text-text-muted`, `hover:bg-elevated` pasan (test suite) |
| AC-E3 (bindings) | ✅ | `[class.text-primary]="cond()"` detectado (test suite) |

## Hallazgos honestos

1. **El backlog "~549 usos" ya no existe**: fix-030 migró las formas cortas
   `text-primary/secondary/muted`, y además aquel conteo estaba inflado por el bug de `\b`
   (matchea dentro de `text-text-primary`) — el mismo que se corrigió en indices-sync.
   **Backlog real hoy: 20 clases muertas únicas en 12 archivos** (familias `*-dark`,
   `border-default`, `bg-brand-primary`, etc.).
2. Los 5 errores ARCH-11 v1 pasan a warnings (rollout AC5) → total de errores del lint
   baja de 45 a 40; el enforcement para código nuevo lo mantiene el Architect Guard hook
   (que aún usa la lista negra vieja — actualizarlo requiere al humano, hooks protegidos).

## Decisiones cerradas (§9 de la spec)

- Set derivado se parsea en cada corrida (sin cache — costo despreciable). ✓
- Prefijos color-like: `text|bg|border|ring|from|to|via|divide|outline|fill|stroke|accent|caret`. ✓

## Estado: DONE
