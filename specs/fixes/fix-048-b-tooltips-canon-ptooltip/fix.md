# Fix: Tooltips nativos (title) → pTooltip canon en Asistencia B
> id: fix-048-b-tooltips-canon-ptooltip
> refs: 0030-asistencia-b-layout-dual
> status: done
> closed: 2026-07-16
> created: 2026-07-16

## Root Cause
La vista `asistencia-clase-b-content` usa 5 tooltips **nativos** del navegador
(`title="..."`), que NO son canon: se ven con el estilo por defecto del SO (sin blur,
sin tokens, delay largo). El canon del proyecto es **PrimeNG `pTooltip`** con el estilo
"Tooltips Premium" (glassmorphic dark charcoal + backdrop blur) de
`styles/vendors/_primeng-overrides.scss`, usado en user-panel, dashboards, etc.

## ACs Afectados
Ninguno funcional — consistencia visual. No cambia acciones ni contratos.

## Cambio
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
- **Qué cambia:**
  - Importar `TooltipModule` de `primeng/tooltip` y agregarlo a `imports`.
  - Migrar los 5 `title` nativos a `[pTooltip]`/`pTooltip` + `tooltipPosition`:
    fila de alerta, botones Iniciar/Marcar inasistencia/Finalizar, y justificación.
  - Simplificar `alertaTooltip()` a una sola línea (política/hint), ya que nombre,
    conteo y última fecha ahora están inline (fix-047). Eliminar `formatIsoDate()` si
    queda sin uso.

## Test de Regresión
Cambio de presentación (template + imports). Verificación:
- `ng build` compila.
- `/verify` (Playwright): al hacer hover sobre una alerta y sobre los botones de la tabla,
  aparece el tooltip PREMIUM del DS (glass oscuro), no el nativo. Light + dark.
