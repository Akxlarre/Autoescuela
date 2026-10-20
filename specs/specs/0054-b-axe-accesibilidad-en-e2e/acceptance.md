# Acceptance — Spec 0054-b (axe en el barrido e2e)

> **Fecha:** 2026-10-20 · **Resultado:** ✅ PASA

| AC | Evidencia | Estado |
|---|---|---|
| AC1 | `e2e/barrido-rutas.spec.ts` corre axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) en cada celda; cada test adjunta `a11y.json` (regla, impacto, nodos, hasta 3 selectores). Barrido completo: 49 rutas × rol × 3 celdas | ✅ |
| AC2 | Por defecto no falla: barrido completo **53/53 en verde** con violaciones presentes; anotación `a11y` con el conteo por celda (ej. B01 admin: "375/cla: 2 serious · 1440/cla: 1 serious · 1440/osc: 1 serious") | ✅ |
| AC3 | `E2E_A11Y_WRITE_BASELINE=1` escribió 49 archivos en `e2e/a11y-baseline/` (uno por ruta × rol, claves `"<tema>:<regla>"`) | ✅ |
| AC4 | `E2E_A11Y_STRICT=1` sobre B01 admin: con la línea base → pasa; quitándole `light:color-contrast` → falla en las 2 celdas claras ("375/cla C7: color-contrast (serious, 19)", "1440/cla C7: color-contrast (serious, 62)") y no en la oscura. Archivo restaurado | ✅ |
| AC5 | Paso 9 "Accesibilidad (axe)" en `.claude/skills/verify/SKILL.md` + fila en el reporte. Probado en el navegador sobre `app-login-card`: 16 reglas pasan, 0 violaciones | ✅ |
| AC-E1 | Un error de axe se guarda como texto en la celda (`axe no pudo correr: …`) dentro de un `try` propio; no cae en el `catch` de la celda | ✅ (por código) |

**Tests:** `e2e/support/a11y.spec.ts` 8/8 (vitest).

## Línea base inicial (2026-10-20)

Reglas y en cuántas ruta × rol aparecen (cada una en claro y oscuro salvo nota):

| Regla | Impacto | Rutas |
|---|---|---|
| `color-contrast` | serious | 49 / 49 |
| `aria-prohibited-attr` | serious | 22 |
| `scrollable-region-focusable` | serious | 5 claro / 4 oscuro |
| `aria-required-children` | critical | 3 |
| `aria-required-parent` | critical | 2 |
| `button-name` | critical | 2 |
| `aria-valid-attr-value`, `link-name`, `nested-interactive` | critical / serious | 1 c/u |

Ninguna se corrige en esta spec (fuera de alcance): quedan para fixes propios. El contraste viene
sobre todo de `text-text-muted` (micro-labels, títulos de grupo del menú) — decisión del DS pendiente.
