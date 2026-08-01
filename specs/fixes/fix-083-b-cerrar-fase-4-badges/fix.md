# Fix: cerrar la fase 4 del roadmap de badges (los 4 residuos)
> id: fix-083-b-cerrar-fase-4-badges
> refs: ASG-b-058
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-058, a confirmar]:** la fase 4 del roadmap de badges
(`docs/BACKLOG-DEUDA-TECNICA.md`) bajó el baseline de 122→36 pills (fix-036 a fix-044-m),
pero quedaron 4 residuos abiertos desde el 2026-07-09, cada uno demasiado chico para su
propio track:

1. `alumnos-list-content.component.ts` (2 pills) — bloqueado por una sesión paralela en
   fix-044-m, nunca se retomó.
2. Pill "tipo" SENCE/Particular usa `var(--color-purple)`, token inexistente — 3 archivos
   de contabilidad-cursos.
3. El "tab count" de `tabs.component.ts` — ¿badge de estado o simple contador?
4. ARCH-15 tiene 6 falsos positivos confirmados (`<button>` con `(click)` detectados como
   pills) — el baseline miente mientras esto no se corrija.

## ACs Afectados

Ninguno — fix autónomo. Referencia: `specs/assignments/ASG-b-058-cerrar-fase-4-badges.md`.

## Archivos involucrados

- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
- `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts`
- `src/app/features/admin/contabilidad-cursos/admin-curso-singular-detalle-drawer.component.ts`
- `src/app/features/admin/contabilidad-cursos/admin-curso-singular-cobro-drawer.component.ts`
- `src/app/shared/components/tabs/tabs.component.ts`
- `scripts/lib/class-discipline.js` — heurístico ARCH-15

## Cambio

**Los 4 residuos cerrados.**

### 1. `alumnos-list-content.component.ts` (2 pills → `<app-badge>`)

Chips de curso en tabla y card, coloreados por `licenseGroup`:
`[variant]="curso.licenseGroup === 'professional' ? 'brand' : 'neutral'"`. Import +
registro de `BadgeComponent` agregados (no estaba en este archivo).

### 2. Pill "tipo" SENCE/Particular → `<app-badge>` (4 sitios, 3 archivos)

`admin-contabilidad-cursos.component.ts` (helper `getTipoStyle()` con
`var(--color-purple)` inexistente, reemplazado por `getTipoVariant()` que devuelve
`'brand' | 'neutral'`) + los 2 drawers con el mismo ternario inline. **Decisión: resolver
con los 6 variants existentes**, no agregar un 7º `purple` — SENCE ya usaba
`--color-primary` (mismo origen que `brand`), Particular no tiene semántica de
success/warning/error, y agregar un variant nuevo para una sola distinción categórica
violaría la Regla 3-2-1 de marca sin necesidad real.

**Hallazgo colateral fuera de alcance**: `rentabilidad-cursos.component.ts:206` usa el
mismo `var(--color-purple)` roto, pero como color de segmento de gráfico, no de badge —
contexto distinto al declarado en este fix. No tocado; flaggeado como tarea aparte
(`task_4c4e30f8`).

### 3. "Tab count" de `tabs.component.ts` → nueva utilidad `.tab-count`

**Decisión: no es un badge de estado, merece su propia utilidad.** `badge-neutral` tiene
`border: 1px solid var(--border-default)` y padding rectangular — el tab count es una
burbuja circular sin borde (aspecto de contador, no de estado). Se formalizó
`@utility tab-count` en `tailwind.css` (junto a las `badge-*`): `min-width`/`height`
1.25rem + `padding-inline` (círculo para 1 dígito, píldora para 2+, sin `width` fijo que
rompería con 2 dígitos) + `bg-subtle`/`text-muted`, sin borde.

Las 3 variantes de `<app-tabs>` (`line`/`segmented`/`pill`) tenían **3 copias
ligeramente distintas** del mismo span — consolidadas en `.tab-count`. La variante `pill`
tenía además `border` + `bg-surface` propios (se sienta sobre el fondo del pill activo/
inactivo) — preservados componiendo `class="tab-count border border-border-subtle
bg-surface"`, igual que `btn-sm` compone sobre `btn-*`. Verificado en navegador que
`bg-surface` sobrescribe correctamente el `background` base de `.tab-count` (blanco vs.
gris, cascade correcto — ver Test de Regresión).

### 4. Heurístico ARCH-15 — excluir `<button>` con `(click)`

`findAdhocPills()` en `scripts/lib/class-discipline.js` operaba solo sobre el string
`class="..."`, sin ver el tag que lo contenía. Reescrito para escanear el **opening tag
completo** (`<(\w[\w-]*)\b([^>]*)>`) y excluir específicamente `tagName === 'button' &&
/\(click\)\s*=/.test(attrsRaw)` — un botón con handler de click es un control interactivo
(filtro, toggle), no un badge de estado; un badge real es un `<span>`.

**Verificado antes de aplicar**, no solo confiado en el conteo: se extrajeron los 7
casos que el refinamiento excluye y se leyó el contexto de cada uno — los 7 son botones
reales (selector de categoría en `hero-tab`, "Volver a Hoy", filtros de estado en
`asistencia-clase-b-content`, botón de WhatsApp en `public-wizard-shell`, "Limpiar" en
`signature-pad`, más los 2 ya confirmados en `public-context-banner`). Ninguno es un
badge de estado mal clasificado como control — la exclusión es correcta, no
sobre-amplia.

Baseline ARCH-15 re-generado: **34 → 19** (los 2 de `alumnos-list-content` migrados +
7 falsos positivos excluidos por el heurístico + otros ya migrados incidentalmente en
tracks anteriores de esta sesión que compartían archivos).

## Test de Regresión

- `node scripts/lib/class-discipline.test.mjs` → **verde**, incluye 4 casos nuevos de
  regresión para el refinamiento ARCH-15 (`<button>` con click no marca, `<span>` con la
  misma forma sí marca, `<button>` sin click sí marca, `<div>` con `(click)` sí marca —
  la exclusión es específica de `<button>`, no de "cualquier elemento con click").
- `npx tsc --noEmit` → sin errores.
- `npm run lint:arch -- --update-ds-baseline` → **0 errores**, ARCH-15 baseline 34→19.
- **Verificación en navegador real** (`ng serve` vivo, Browser MCP):
  - `/app/admin/alumnos`: 17 `<app-badge>` renderizados, "Clase B" → `badge-neutral`
    correcto (bg gris, sin el token roto).
  - `/app/admin/contabilidad/cursos`: 4 badges "Part./Particular" → `badge-neutral`
    correcto, cero referencias a `--color-purple` en el DOM computado.
  - Composición `.tab-count` + `bg-surface` + `border`: probado inyectando el markup
    exacto en el DOM vivo — `bg-surface` sobrescribe correctamente el `background` base
    de `.tab-count` (blanco `rgb(255,255,255)` vs. gris base `rgb(228,228,231)`),
    confirmando que la cascada de Tailwind v4 resuelve como se esperaba, sin necesitar
    `!important` ni reordenar utilidades.
- `npm run test:ci` → **1651 passed, 3 skipped (pre-existentes), 0 failed, exit 0**
  (136/137 archivos, 198s). Sin regresiones.
