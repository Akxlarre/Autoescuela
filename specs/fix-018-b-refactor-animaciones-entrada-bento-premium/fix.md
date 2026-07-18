# Fix: Refactor premium de animaciones de entrada bento
> id: fix-018-b-refactor-animaciones-entrada-bento-premium
> refs: —
> status: done
> closed: 2026-06-15
> created: 2026-06-14

## Root Cause
La orquestación de animaciones de entrada de página tiene 5 defectos que degradan la
percepción de calidad:

1. **Flash en primera carga** — `animateBentoGrid` usa `fromTo({opacity:0})` pero no hay
   pre-hide en CSS. Entre el paint y el momento en que GSAP corre (afterNextRender/RAF/effect),
   las celdas pintan visibles → GSAP las salta a opacity:0 → recién anima. Parpadeo.
2. **Eases CSS rotos** — `getCssEase()` devuelve strings `cubic-bezier(...)` que GSAP core
   NO entiende sin el plugin CustomEase (no registrado). Cae silenciosamente al ease default.
3. **Blur jank** — el hero anima `filter: blur(6/8px)` sobre superficies grandes; costoso,
   puede tironear en equipos modestos.
4. **Doble-tween en el hero** — páginas que no pasan `[animateOnInit]="false"` al
   `app-section-hero` lo animan vía `animateHero()` Y vía la rama hero de `animateBentoGrid`.
5. **Triggers inconsistentes** — 3 patrones de disparo (`ngAfterViewInit`, `+RAF`,
   `effect+Promise`) → timing no determinista. Duraciones hardcodeadas en el servicio.

## ACs Afectados
Ninguno — fix autónomo (refactor puntual de motion ya en producción, sin nueva funcionalidad
de negocio).

## Cambio
- **Archivo:** `src/styles/tokens/_variables.scss`
- **Qué cambia:** tokens premium de reveal (`--ease-out-expo`, `--duration-reveal-*`, `--stagger-reveal`, `--delay-reveal-grid`).
- **Archivo:** `src/styles/layout/_bento-grid.scss`
- **Qué cambia:** pre-hide gated `.bento-grid.is-reveal-pending > * { opacity: 0 }` + safety net reduced-motion.
- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts`
- **Qué cambia:** registrar CustomEase, arreglar `getCssEase` (cubic-bezier→CustomEase), reescribir `animateBentoGrid` (sin blur, tokens, gsap.context, overwrite, cascada hero→grid en capas, retiro de pre-hide).
- **Archivo:** `src/app/core/directives/bento-reveal.directive.ts` (NUEVO)
- **Qué cambia:** directivo `[appBentoReveal]` que acopla pre-hide (constructor) + reveal (afterNextRender), con input de readiness para SWR.
- **Archivo:** `src/app/core/directives/bento-grid-layout.directive.ts`
- **Qué cambia:** (rollout universal del flash-fix, mismo root cause #1) — `[appBentoGridLayout]` está en TODOS los bento-grid, así que centralizamos ahí el pre-hide anti-flash (constructor, guard SSR) + safety-net que revela tras el 1er render si nadie animó. Esto da el flash-fix a las ~30 páginas restantes sin migrarlas una por una.
- **Archivos:** páginas de referencia (`dashboard`, `instructor-dashboard`, `admin-auditoria`)
- **Qué cambia:** migrar al nuevo patrón, eliminar doble-tween del hero.

## Test de Regresión
- `src/app/core/services/ui/gsap-animations.service.spec.ts > animateBentoGrid (fix-018-b)` ✓ 15/15 — no lanza, respeta reduced-motion, retira `.is-reveal-pending`, devuelve cleanup.
- `npm run build` ✓ verde (solo warnings preexistentes: RouterLink sin usar en Dashboard + budget de bundle).
- Nota: `alumno-dashboard.spec` tiene 1 fallo PREEXISTENTE (`heroActions agendar primary`) ajeno a este fix — no se tocó ese archivo.
- ✅ Verificación visual (Playwright sobre `ng serve` :4200) en 5 páginas bento de todos los escenarios de riesgo:
  - `admin/dashboard` (SWR `@if/@else`, 7 celdas), `admin/auditoria` (migrada a `[appBentoReveal]`, 4),
    `admin/flota` (SWR effect-based, 6), `admin/instructores` (disparo dual effect+ngAfterViewInit, 2).
  - Resultado: **0 celdas ocultas**, `.is-reveal-pending` retirada en todas, **0 errores de consola**.
  - Captura `fix018-instructores.jpeg`: render correcto (hero + tabla completa visible).

## Estado del rollout
- ✅ Motor premium (tokens + CSS pre-hide + servicio + directivo) — beneficia a TODAS las páginas que llaman `animateBentoGrid`.
- ✅ Migradas al directivo `[appBentoReveal]`: `admin-auditoria`, `instructor-dashboard`.
- ✅ `dashboard` verificado ya compatible (SWR con `effect()` + `animateOnInit=false`; no migrar al directivo por el swap `@if/@else`).
- ✅ **Flash-fix universal** vía `[appBentoGridLayout]` → las ~30 páginas restantes quedan cubiertas sin migración individual (pre-hide + safety-net). Ya tenían las mejoras internas del motor.
