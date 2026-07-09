# Backlog — Deuda Técnica del Design System

> Lista viva de pendientes detectados en la auditoría de botones/badges (jul-2026) y el
> saneamiento de semáforos que siguió. **No es un track SDD** — es un backlog de referencia;
> cada ítem se convierte en su propio `/fix-new` o `/spec-new` cuando se ataca (mismo patrón
> que fix-031/032/033). Tachar o mover a "Hecho" cuando se cierre, con el ID del track.

## Roadmap de botones/badges — Fases 4 y 5

Fases 1-3 (tokens dark-mode `btn-danger`/`btn-neutral`, guardrails ARCH-15/16/17, token
`text-2xs`) **ya están cerradas** — fix-031, fix-032. Ver `indices/ANTI-PATTERNS.md`
(AP-012 a AP-015) y `scripts/lib/class-discipline.baseline.json`.

### Fase 4 — Consolidar `app-badge`
- [x] **fix-036 (2026-07-08)** — Auditar variants `info`/`default` + resolver fuente única:
      `app-badge` ahora consume `badge-*` (que a su vez consume los tokens `--badge-radius`/
      `--badge-padding-*` de Capa 4, antes huérfanos). `info` = `--state-info` (azul, no
      marca). `default`/`neutral` fusionados en un solo variant `neutral`; nueva utilidad
      `badge-neutral`. Bug real encontrado y corregido: `'badge-' + variant()` no generaba
      CSS (Tailwind v4 poda `@utility` por contenido escaneado) — usar `computed()`+`switch`
      con strings literales, NUNCA concatenación dinámica. Ver `indices/STYLES.md`.
- [x] **fix-038 (2026-07-08)** — 6º variant `brand` agregado a `app-badge` (utilidad
      `badge-brand`, tokens `--ds-brand`/`--color-primary-muted`/`--accent-border`).
      Desbloquea la categoría 2 (chips de rol/marca) para migración.
- [x] **fix-039 (2026-07-08)** — Migrado `ajustes-drawer.component.ts` (4 pills, en
      realidad 1 badge de rol con 4 ramas mutuamente excluyentes → colapsado en un solo
      `<app-badge>` con variant/ícono/label derivados del rol; admin usa `variant="brand"`).
- [x] **fix-040 (2026-07-08)** — Migrado `certificacion-clase-b-content.component.ts`
      (4 pills: chip "curso" → `brand`, estado certificado → success/warning, log de
      acción dinámico de 4 casos → success/**brand**/info/neutral. Confirmado en
      producción: `email_sent` → `badge-brand`, el caso exacto que motivó fix-038).
- [x] **fix-042 (2026-07-08)** — Lote 1 semi-automatizado: 30 pills **estáticos**
      (sin lógica dinámica, clase `text-{variant}` literal) migrados en 24 archivos vía
      codemod ad-hoc (matcher de spans + inserción de import/registro, `--dry` antes de
      aplicar, Prettier después). Cambio de ritmo tras detectar que 1-fix-por-archivo era
      insostenible (66 archivos restantes, 85% con 1-2 pills). Verificación proporcional al
      riesgo: harness CSS de los 4 variants + build + 1 página real, no Playwright completo
      por archivo (justificado porque `badge-*` ya está probado 3x y el riesgo aquí es solo
      "mapeo de clase→variant", verificable por lectura de código).
- [x] **fix-043 (2026-07-09)** — Lote 2: 13 archivos migrados (22 pills dinámicos, vía
      helpers `getXVariant()` reemplazando `getXBg()`/`getXColor()`), 3 archivos revisados y
      excluidos con justificación documentada (`public-context-banner`, `tabs.component`,
      `alumnos-list-content` sin tocar por sesión paralela activa). Hallazgos: (a) 3 falsos
      positivos más del heurístico ARCH-15 (botones con `(click)` mal detectados como pills:
      filtro en `asistencia-clase-b-content`, 2 en `public-context-banner`); (b) contador
      "tab count" en `tabs.component.ts` no es semánticamente un badge de estado — requiere
      decisión de diseño (ver ítem "Residual" abajo); (c) `admin-promocion-ver-drawer`
      corrigió de paso un bug latente (`var(--state-brand)` inexistente, fallback silencioso
      roto) al migrar a variant tipado; (d) `section-hero.component.ts` (chip modo slim,
      ~50 páginas de blast radius) verificado con Playwright real además de harness — chip
      modo full/hero queda fuera de scope (fondo fijo semi-transparente sobre `.surface-hero`,
      no semántico por diseño). Baseline: 77→51 pills, 49→43 archivos.
- [ ] Migrar los pills ad-hoc restantes del baseline ARCH-15 a `<app-badge [variant]="...">`
      (**51 restantes**, mayormente 1 pill por archivo — lote 3). Re-baseline con
      `--update-ds-baseline` tras cada lote.
- [ ] Decisión de diseño: el "tab count" (contador numérico dentro de `<app-tab>`, ver
      `tabs.component.ts`) no es un badge de estado — ¿merece su propia utilidad `.tab-count`
      o se dejan como excepción documentada del heurístico ARCH-15?
- [ ] Refinar heurístico ARCH-15 para excluir `<button>` con `(click)` — van 5 falsos
      positivos confirmados entre fix-043 y su análisis previo (filtros/acciones que
      visualmente parecen pills pero son controles interactivos, no badges de estado)
- [ ] Modificador componible `btn-sm` (NO crear `btn-primary-sm`/`btn-danger-sm`/… por tipo —
      explosión combinatoria) para los casos hoy resueltos mutilando `btn-*` con utilities
      (baseline ARCH-16, ~120 instancias)

### Fase 5 — Accesibilidad + limpieza puntual
- [ ] Menú desplegable de `section-hero.component.ts`: cerrar con `Escape`, devolver foco al
      trigger al cerrar, foco al primer ítem al abrir (hoy solo cierra por click-outside)
- [ ] Botones icon-only sin `aria-label` (conocidos: `admin-pre-inscrito-drawer.component.ts:617`,
      `admin-contabilidad-anticipos.component.ts:195` — puede haber más, re-auditar)
- [ ] Limpiar hex/rgba inline en `.ts` fuera del CSS de impresión legítimo (`epq-print.util.ts`,
      `route-sheet`) — conocidos: `live-classes-panel`, `instructor-alumnos`, `dms.facade`,
      `admin-alumno-detalle`, `public-wizard-shell`, `secretaria-matricula` (~10 archivos)

### Residual del ratchet ARCH-17
- [ ] 66 instancias de tamaños arbitrarios `text-[8/9/13/15/17/22px]` sin token — requiere
      decisión de diseño: 8-9px es ilegible → subir a `text-2xs`; 13/15/17px → encajar en la
      escala existente o formalizar un nuevo peldaño

## Saneamiento general (escaneado 2026-07-07, sin actuar)

- [ ] 322 `TODO`/`FIXME`/`HACK` en `src/app` — triar cuáles siguen vigentes vs. ya resueltos
- [ ] 227 tipados `: any` en `src/app` (excluye specs) — reemplazar por tipos reales donde
      no sea deliberado (payloads de Supabase sin tipar, etc.)
- [ ] 340 `style="..."` inline con `color`/`background` — mezcla de `var(--token)` legítimos
      y violaciones reales; necesita triage antes de tocar nada (no es un solo patrón)
- [ ] 29 emojis en UI (`button`, `span`, `p`, `h1-h3`, `a`, `label`) — prohibidos por
      `visual-system.md`, reemplazar por `<app-icon>`
- [ ] 27 `setTimeout(...)` en componentes/facades — evaluar cuáles deberían ser callbacks de
      GSAP (`GsapAnimationsService`) o eventos Realtime en vez de temporizadores
- [ ] ARCH-11: ~20 clases muertas residuales (familias `*-dark`, `bg-brand-primary`…) en
      12-13 archivos, hoy warnings — migrar y correr `lint:arch -- --strict` para que ARCH-11
      las trate como error

## Infraestructura de guardrails

- [ ] `Architect Guard` hook (`.claude/hooks/pre-write-guard.js`, protegido — requiere
      autorización humana) sigue usando la lista negra vieja de clases muertas, desalineada
      de ARCH-11 v2 (whitelist derivada del `@theme`). El linter de `npm run lint:arch` ya
      está correcto; el hook en tiempo real de escritura no.

## Administrativo

- [ ] Push + PR de la rama `feat/ds-tokens-guardrails` (6 commits: fix-031 tokens danger/neutral,
      guardrails fase 2 ARCH-15/16/17, fix-032 text-2xs, semáforos verdes ARCH-02/03 + test:ci
      1209/1209, fix-033 revertir alias + ARCH-18, sync de índices)
