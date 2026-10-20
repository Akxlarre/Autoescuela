# Plan — Spec 0054-b (axe en el barrido e2e)

> **Status:** approved (el owner pidió tomar las asignaciones pendientes, 2026-10-20)

## Cambios

1. **`package.json`**: devDependency `@axe-core/playwright@4.13.0`.
2. **`e2e/support/a11y.ts`** (+ `a11y.spec.ts`, funciones puras):
   - `summarizeViolations(result)` → `{ rule, impact, nodes, targets }[]`;
   - `baselineKeys(theme, violations)` → `"<tema>:<regla>"`;
   - `newSeriousViolations(theme, violations, baseline)` → las `serious`/`critical` que no están.
   - `runAxe(page)` → `AxeBuilder.withTags(['wcag2a','wcag2aa']).analyze()` resumido.
3. **`e2e/barrido-rutas.spec.ts`**: C7 accesibilidad en cada celda; adjunto JSON por test; anotación
   con el conteo por impacto; escritura de la línea base (`E2E_A11Y_WRITE_BASELINE`) y modo estricto
   (`E2E_A11Y_STRICT`). Un error de axe se anota sin tumbar la celda.
4. **`e2e/a11y-baseline/`**: línea base inicial generada con el barrido.
5. **`.claude/skills/verify/SKILL.md`**: paso de axe sobre el componente nuevo.
6. **`docs/E2E-PLAYWRIGHT.md`**: cómo leer el reporte, regenerar la línea base y encender el modo estricto.

## Verificación

- Tests de `e2e/support/a11y.spec.ts`.
- Barrido de un par de rutas con reporte; línea base generada; modo estricto en verde con la línea base
  y en rojo al quitarle una regla grave.
