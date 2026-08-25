# Acceptance 0003-i — App-like: reportes contables (`admin` + `secretaria`)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-25
> **Verifier:** ac-verifier (Haiku) · validado por i, con QA visual real vía Playwright MCP y
> feedback directo del usuario sobre 3 rondas de render real (no solo checkboxes geométricos)

---

## Resumen

- AC totales: 8 (AC1, AC1b, AC2, AC3, AC4, AC-E1, AC-E2, + implícito de regresión visual)
- AC cumplidos: 7
- AC no aplicables (documentado, no bloqueante): 1 (AC4)
- AC con trade-off documentado (cumplido con nota): 1 (AC-E1)

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Layout desktop: Hero/Filtros/Categorías fijos + 4 tabs compactas + panel único

✅ **Cumplido.** Confirmado en `/verify` real (Playwright MCP, login `admin@test.com`) en 3
viewports: 1280×800, 1440×768, 1680×900.

- Hero, Filtros y Categorías se ven exactamente igual que antes del cambio (mismo HTML/clases
  internas — solo cambió su wrapping de grid-cell).
- Los 4 tabs (Evolución Mensual, Detalle Diario, Rentabilidad, Gastos Fijos) quedaron compactos
  en la misma línea que "Mes actual"/"Aplicar" — corregido tras feedback visual (`<app-tabs>`
  tiene `:host{width:100%}` por defecto, forzaba su propia línea; se resolvió con
  `style="width:auto; flex:0 0 auto"` inline).
- `documentScrolls: false` confirmado en los 3 viewports (`document.documentElement.scrollHeight
  <= clientHeight`).
- Panel único debajo (`.bento-fill`, `.bento-grid--fill-screen-4`) muestra el contenido de la
  tab activa.

**Historial real (no maquillado):** la primera implementación tenía Hero+Filtros+Categorías+
Gastos Fijos **todos** fijos en un solo bloque scrolleable — `/verify` encontró que ese bloque
medía 954px, más que el viewport disponible (680-780px), colapsando el panel de tabs a **0px**
(bug real, no cosmético). Se corrigió reestructurando en revisión 2 (ver `tasks.md` Fase 3 y
`plan.md` §8).

### AC1b — Secretaría no ve el tab "Gastos Fijos"

✅ **Cumplido.** Confirmado en `/verify` real (login `secretaria@test.com`,
`/secretaria/contabilidad/reportes`): `tablist` expone solo 3 tabs (Evolución Mensual, Detalle
Diario, Rentabilidad), sin "Gastos Fijos". Además cubierto por test unitario:
`reportes-contables-content.component.spec.ts` → `'secretaria (no admin) ve solo 3 tabs, sin
Gastos Fijos'` (4/4 tests verdes, `npm run test:ci`).

### AC2 — No se pierde ninguna de las 7 secciones originales

✅ **Cumplido.** Las 4 tabs se probaron con **click real** en el navegador (no solo lectura de
código):

- "Evolución Mensual" (tab por defecto) — tabla con datos reales (agosto 2026, $935.000/
  $122.000/$813.000).
- "Detalle Diario" — clickeada, renderiza "7 días con movimientos" + tabla con datos.
- "Rentabilidad" — clickeada, renderiza "Rentabilidad Estimada por Tipo de Curso · Agosto 2026".
- "Gastos Fijos" (solo admin) — clickeada, renderiza empty-state correcto ("Sin gastos fijos en
  este período") + botón "Registrar Gasto Fijo".

Hero, Filtros y Categorías (Ingresos/Gastos por Categoría) confirmados visibles en todas las
capturas — nada se perdió de las 7 secciones originales.

### AC3 — Mobile: scroll nativo normal

✅ **Cumplido.** Confirmado en `/verify` a 390×844 (secretaria): el shell usa `.shell-content`
como contenedor de scroll real (no `document.documentElement` — arquitectura ya documentada en
`.claude/skills/verify/SKILL.md`), con `scrollHeight(1154) > clientHeight(768)`. Scrolleado
manualmente hasta confirmar que Categorías, Gastos por Categoría y el panel de Evolución Mensual
son alcanzables sin recortes.

### AC4 — `force-compact` con drawer abierto

⚪ **No aplicable, documentado.** Verificado en código (T4.2): esta ruta no tiene ningún
binding `[class.force-compact]` ni inyección de `LayoutDrawerFacadeService` en
`reportes-contables-content.component.ts` ni en sus wrappers `admin`/`secretaria` — no hay
drawer en su flujo actual. AC4 no aplica; documentado explícitamente en vez de asumido en
silencio. No bloquea el cierre porque no es una funcionalidad que la spec pedía crear, solo
verificar que no se rompa si existiera.

### AC-E1 — 768px de alto, contenido usable sin recortes

✅ **Cumplido, con trade-off documentado.** Probado explícitamente a 1440×768 (no solo
800/900px). Hallazgo real: con el diseño inicial (`minmax(0,1fr)` para Categorías) colapsaba a
**0px** — invisible, no solo "necesita scroll". Se corrigió dándole un piso propio
(`minmax(100px,1fr)`). Resultado final a 768px: Categorías visible (100px + scroll interno),
panel de tabs completo (280px) con datos — nada oculto ni recortado.

**Trade-off aceptado a propósito:** en este viewport extremo, el grid se desborda ~98px de su
caja fija, absorbido por el scroll del shell general (no por `document.documentElement`, no
rompe nada visualmente, confirmado sin errores de consola). A 768px de alto ya no es "cero
scroll" perfecto como a 800-900px, pero cumple la letra del AC ("contenido usable sin
recortes") — nada queda inaccesible.

### AC-E2 — Cambio de tab con contenido largo scrollea internamente

✅ **Cumplido.** El panel `.bento-fill` tiene `overflow-y-auto` en cada `@case` del `@switch`
(`flex-1 min-h-0 overflow-y-auto`). Confirmado con datos reales de Detalle Diario (tabla con 7
filas) sin romper el shell.

---

## Fuera de alcance respetado

- ❌ `cuadratura-content` — no tocado, queda en spec separada `0004-i-app-like-cuadratura`.
  Confirmado: el único archivo de producción modificado es `reportes-contables-content.component.ts`
  (+ `.spec.ts` nuevo) y el modificador SCSS global `_bento-grid.scss`.
- ❌ Lógica de negocio o cálculos de los reportes — no se tocó ningún cálculo, solo el
  layout/estructura. Confirmado: no se modificó `reportes-contables.facade.ts` ni
  `reportes-contables.model.ts`.

Sin scope creep detectado.

---

## Deuda técnica / seguimientos menores (no bloqueantes)

- El warning `NG0955` (keys duplicadas "Otros" en `@for track cat.nombre` de Categorías) es
  **preexistente**, no introducido por este track — pertenece a datos de prueba con 2
  categorías del mismo nombre. No se tocó ese `@for`, fuera de alcance de esta spec.
- El trade-off de scroll a 768px de alto (ver AC-E1) es aceptado, no un blocker, pero vale la
  pena tenerlo en cuenta si en el futuro se agregan más filas fijas a esta página.

---

## Cambios en índices

- `indices/COMPONENTS.md` — entrada de `app-reportes-contables-content` actualizada con la
  arquitectura final (tabs, filas, modificador nuevo).
- `indices/STYLES.md` — `.bento-grid--fill-screen-4` documentado con su historial de 2
  iteraciones (colapso → ajuste de peso).
- `indices/APP-LIKE-ROLLOUT.md` — filas de `/admin/contabilidad/reportes` y
  `/secretaria/contabilidad/reportes` marcadas como cerradas (paso 14 del rollout, parcial —
  cuadratura queda pendiente en spec separada).
- `scripts/lib/bento-classes.allowlist.json` — `bento-grid--fill-screen-4` registrado (requerido
  por `ARCH-21`).

---

## Validación técnica

- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, 171 warnings (baseline preexistente, ninguno nuevo).
- `npm run test:ci` → 2221 passed, 1 failed (preexistente y no relacionado —
  `secretaria-contabilidad-cuadratura.component.spec.ts`), 5 skipped.
- `.spec.ts` nuevo (`reportes-contables-content.component.spec.ts`) → 4/4 tests verdes.
