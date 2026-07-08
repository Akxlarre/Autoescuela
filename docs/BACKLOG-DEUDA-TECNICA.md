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
- [ ] Auditar las variants `info`/`default` de `app-badge` (`bg-brand-muted`/`text-brand-primary`)
      — verificar si son parte del backlog de clases muertas ARCH-11 antes de usarlas como base
- [ ] Resolver el conflicto de fuente única: tokens `--badge-radius`/`--badge-padding-*`
      (Capa 4, `radius-full`) vs utilidades `badge-*` de `tailwind.css` (`radius-md`, 0 usos
      reales hoy) — elegir UNA y que la otra desaparezca o delegue en ella
- [ ] Migrar los ~122 pills ad-hoc del baseline ARCH-15, progresivo por portal
      (admin → secretaría → instructor → alumno), re-baseline con `--update-ds-baseline`
      al final de cada portal
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
