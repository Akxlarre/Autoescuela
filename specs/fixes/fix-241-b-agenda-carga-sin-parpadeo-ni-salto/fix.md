# Fix: P08 — al cargar una semana la Agenda parpadea, salta y muestra la semana anterior en el encabezado
> id: fix-241-b-agenda-carga-sin-parpadeo-ni-salto
> refs: ASG-i-026 (fix-186-b, caso P08)
> status: done
> closed: 2026-11-06
> created: 2026-11-06

## Root Cause
Tres causas en `AgendaSemanalComponent` y `AgendaFacade`, medidas en P08 (fix-186-b):

1. **Parpadeo:** la animación de entrada de la grilla (`animateSkeletonToContent`, de opacidad 0 a
   1) se lanza con doble `requestAnimationFrame`, cuando el navegador ya pintó la grilla completa:
   se ve 1–2 frames al 100 %, baja y vuelve a subir.
2. **Salto:** la leyenda vive solo en la rama con datos del `@if`; durante el skeleton desaparece y
   la grilla crece lo que mide la leyenda (35 px; 43 px al entrar), y se vuelve a achicar al
   llegar los datos.
3. **Encabezado atrasado:** la etiqueta de la semana sale de `weekData().weekLabel`, que se arma
   recién al llegar los datos: mientras carga sigue diciendo la semana anterior.

## ACs Afectados
Ninguno de una spec — pulido de P08:
- **P08a:** la grilla nunca se pinta al 100 % antes de su animación de entrada.
- **P08b:** el borde inferior de la grilla no se mueve entre el skeleton y los datos (la leyenda está
  en los dos estados).
- **P08c:** al cambiar de semana, el encabezado muestra la semana nueva desde el primer frame.

## Cambio
- **Archivo:** `src/app/core/utils/agenda-week.utils.ts` — `formatWeekLabel(weekStart)` y
  `agendaShowsLegend()` (la decisión de la leyenda, testeable sin TestBed).
- **Archivo:** `src/app/core/facades/agenda.facade.ts` — `weekLabel` se calcula de la semana pedida.
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts` — input
  `weekLabel`; leyenda también durante la carga; animación en `afterNextRender`.
- **Archivos:** `admin-agenda.component.ts`, `secretaria-agenda.component.ts` — pasan `[weekLabel]`.

## Test de Regresión
- `src/app/core/utils/agenda-week.utils.spec.ts > formatWeekLabel` ✓ y `> agendaShowsLegend` ✓.
- `src/app/core/facades/agenda.facade.spec.ts > weekLabel cambia apenas se navega, sin esperar los
  datos` ✓.
- `npm run test:ci`: 4687 pasan. `npm run lint:arch`: 0 errores.
- Medido en el navegador (secretaria sede 2, 1280×800, `ng serve`) muestreando cada frame tras
  "Semana siguiente":

  | | Antes | Después |
  |---|---|---|
  | Frames de la grilla al 100 % antes de animarse (P08a) | 2 | 0 (el primer frame ya sale al 31 %) |
  | Borde inferior skeleton → en reposo (P08b) | 696 → 661 px (salto de 35 px) | 661 → 661 px |
  | Leyenda durante el skeleton | no | sí |
  | Encabezado en el primer frame (P08c) | semana anterior | semana nueva |

  Repetido con la respuesta de la vista demorada 1,5 s (`page.route`): el encabezado dice la semana
  nueva durante todo el skeleton. Los 4–6 px que se mueve el borde mientras anima son el
  desplazamiento de 8 px de la propia animación de entrada, no un cambio de alto. Consola sin
  errores.
