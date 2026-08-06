# Fix: App-like — `/admin/configuracion-web` + `/secretaria/configuracion-web`
> id: fix-124-m-app-like-configuracion-web
> refs: ASG-b-072
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
[Heredado de ASG-b-072, a confirmar]: Paso 6b del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`).
`AdminConfiguracionWebComponent` (shared entre admin y secretaria) tiene 6 tabs —
`general`/`hero`/`cursos`/`promo`/`contacto`/`faqs` — cada una su PROPIO componente
`*-tab.component.ts` separado, usando `<app-tabs>` (el shared `TabsComponent`, no hand-rolled).
Base ideal para el patrón: las tabs ya existen, solo falta el shell.

Plan:
1. Root → `bento-grid--fill-screen-kpi` alrededor de `<app-tabs>`.
2. Panel de la tab activa → `bento-fill flex flex-col h-full` con scroll interno del formulario.
3. **Verificar al implementar** (no revisados los 6 componentes en la auditoría): al ser 6
   archivos separados, confirmar que ninguno tenga su propia altura fija o estructura que rompa
   el fill (mismo tipo de anti-patrón que se encontró en `dms-list-content`, ASG-b-071).

**Decisión al implementar:** la estructura real es Hero (con KPIs embebidos como prop
`[kpis]="heroKpis()"`, no como celdas `.bento-square` separadas) + una sola card grande con
tabs — exactamente el mismo patrón que `/admin/auditoria` (fix-122). `bento-grid--fill-screen-kpi`
es para "hero + fila de KPIs separada + lista" (3 filas), que no aplica acá. Se usa
`bento-grid--fill-screen` (2 filas: hero auto + card fill), igual que fix-122.

## ACs Afectados

- AC-1: Root del componente usa `bento-grid--fill-screen`.
- AC-2: El panel de la tab activa tiene `bento-fill flex flex-col h-full` y scrollea internamente
  su formulario en desktop (lg+).
- AC-3: Cada uno de los 6 `*-tab.component.ts` (general/hero/cursos/promo/contacto/faqs) fue
  revisado individualmente — ninguno rompe el fill con altura fija o estructura propia
  incompatible.
- AC-4: En Mobile, la página revierte a scroll nativo.
- AC-5: Verificado en ambas rutas (`/admin/configuracion-web` y `/secretaria/configuracion-web` —
  componente shared).

## Checklist de cierre (rollout app-like, heredado de ASG-b-072)

- [x] `force-compact` — no aplica: esta página no tiene drawers.
- [x] Sin lógica de densidad nueva → sin tests obligatorios adicionales
- [x] `/verify` en **AMBAS rutas** (admin y secretaria), en 390×844, 1440×900 y 768 de alto
- [x] Revisar los 6 `*-tab.component.ts` uno por uno antes de aplicar el shell — no asumir que
      todos calzan igual

## Cambio
- **Archivo:** `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts`
  - Root: `bento-grid` → agrega `bento-grid--fill-screen`.
  - Card principal (`bento-banner`): agrega `bento-fill h-full`; se retira el `style` inline
    (`min-height: 500px; display: flex; flex-direction: column;`) reemplazado por clases
    Tailwind `flex flex-col` (el canon de altura vive en `.bento-fill`, no inline).
  - El `<form>` interno ya tenía `flex-1 ... overflow-y-auto` — el scroll interno del contenido
    de cada tab ya funcionaba, no requirió cambios adicionales.
  - Revisados los 6 `*-tab.component.ts`: todos tienen root `flex flex-col gap-6` (o
    `.hero-studio-container` con `display:flex;flex-direction:column;width:100%` en
    `hero-tab.component.ts`) sin altura fija — ninguno rompe el fill. Únicas alturas fijas
    encontradas son de controles internos (inputs, preview de imagen, dropdowns), no del root.
  - Componente `shared` entre `/admin/configuracion-web` y `/secretaria/configuracion-web` — el
    cambio aplica a ambas rutas automáticamente (mismo componente, sin bifurcación de código).

## Test de Regresión
`/verify` visual en ambas rutas — sin lógica de densidad nueva que testear.

**Ejecutado 2026-08-06 (Playwright MCP):**
- `/admin/configuracion-web` (rol admin, sede "Autoescuela Chillán" seleccionada): probadas las 6
  tabs en 1440×900 — todas scrollean su contenido internamente sin romper el fill. `documentScrolls:
  false`, `inlineContainViolation: 0`, `form.scrollsInternally: true` (461px visibles / 1349px
  contenido en la tab más simple). Confirmado también en 1440×768 (`documentScrolls: false`, sin
  recortes). En 390×844 el fill-screen se desactiva y el scroll nativo vuelve al contenedor
  `.shell-content` (2272px contenido / 768px visible) — comportamiento correcto del patrón dual.
  Consola: 0 errores (1 warning preexistente de Angular Forms, no relacionado). Red: todos los
  requests a Supabase en 200, datos reales (no mock).
- `/secretaria/configuracion-web` (rol secretaria, sede fija sin selector): mismo resultado —
  `bento-grid--fill-screen` activo, `documentScrolls: false`, `formScrollsInternally: true`,
  `inlineViolation: 0`. Verificado en 1440×900 y 390×844 (scroll nativo del shell restaurado,
  header "Sede: Autoescuela Chillán" visible).

Sin issues encontrados. Pendiente únicamente el visto bueno visual del owner sobre las capturas.
