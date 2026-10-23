# Fix: El stepper del wizard de matrícula anuncia pestañas que no existen (ARIA inválido)
> id: fix-068-i-wizard-matricula-aria-stepper
> refs: fix-058-i-testing-matricula-presencial (B4-2)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

El wizard usa `p-stepper` de PrimeNG **sin** `p-step-list`, solo para mostrar un panel por paso (el
progreso se ve en el badge "Paso N de 6" y en el título de cada paso). PrimeNG igual pone
`role="tablist"` en `p-stepper` y `role="tabpanel"` + `aria-controls="…_step_N"` en cada
`p-step-panel`. axe (crítico, en `fix-058-i`):

- `aria-required-children`: un `tablist` cuyos hijos son `tabpanel` (no tiene `tab`s).
- `aria-valid-attr-value`: `aria-controls` apunta a un `…_step_N` que no existe.

Un lector de pantalla anuncia una lista de pestañas vacía y paneles huérfanos.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B4-2). Criterios de este fix:

- **AC-F1:** axe no reporta `aria-required-children` ni `aria-valid-attr-value` en el wizard.
- **AC-F2:** el wizard se ve y navega igual (mismo panel visible por paso).

## Cambio

- **Archivo:** `src/app/core/directives/plain-stepper.directive.ts` — `[appPlainStepper]`
  quita `role` y `aria-controls` del host (sus `host` bindings se aplican después de los de
  PrimeNG en el mismo elemento).
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.html` (+ `.ts`
  imports) — la directiva en `p-stepper` y en cada `p-step-panel`.

## Test de Regresión

- axe en navegador sobre el wizard, antes y después (AC-F1). Sin spec unitario: la directiva no
  tiene lógica (dos `host` bindings) y el Vitest del proyecto no compila plantillas, así que la
  precedencia sobre los bindings de PrimeNG solo se puede comprobar en el navegador.

## Progreso

- [x] Directiva + uso en el wizard; `tsc` limpio.
- [x] axe en navegador + revisión visual.
- [x] Suite completa, `tsc`, `lint:arch`, índices y cierre.

## Verificación

- 2026-10-23, Playwright como secretaria (sede 1), wizard nuevo:
  - **Antes** (mismo día, sin la directiva): axe wcag2a/wcag2aa → `aria-required-children`
    (`p-stepper` `role="tablist"` con hijos `tabpanel`) y `aria-valid-attr-value`
    (`aria-controls="pn_id_2_step_0"` sin destino), ambos críticos.
  - **Después:** `p-stepper` y los 6 `p-step-panel` sin `role` ni `aria-controls`
    (`data-p-active` intacto); axe sobre el wizard → **0 violaciones** ✅ (AC-F1).
  - Paso 1 → 2 → 1: se muestra un solo panel cada vez (1.º visible al inicio, 2.º tras avanzar) y
    el aspecto es el mismo (captura) ✅ (AC-F2).
- Suite completa 299 archivos, `tsc` limpio, `lint:arch` 0 errores. `indices/DIRECTIVES.md`
  actualizado.
