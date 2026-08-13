# Fix: Mi Horario genera scroll horizontal interno al abrir un drawer
> id: fix-145-b-horario-scroll-horizontal-drawer
> refs: —
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Reportado por el owner con captura real: al abrir el drawer "Ajustes del Sistema" en
`/instructor/horario`, aparece scroll horizontal. Reproducido en Claude Browser: el
`<div class="overflow-x-auto flex-1 bg-surface">` interno de `WeeklyScheduleGridComponent`
pasa de `scrollWidth === clientWidth` a `scrollWidth: 900 / clientWidth: 390` en cuanto el
drawer angosta `<main>`. El documento en sí NO scrollea horizontal (`documentScrollsX:
false`) — el scroll queda contenido dentro de la card, pero visualmente rompe la UI.

Causa raíz: `InstructorHorarioComponent` decide grilla-desktop vs timeline-mobile con
`hidden md:flex` / `md:hidden` (breakpoint de **viewport** de Tailwind, 768px) en vez de
por **ancho de contenedor** (`LayoutService.tier()`, ya usado en el resto del proyecto para
este mismo problema — ver `.claude/rules/visual-system.md` §"Switch de layout por
CONTENEDOR, NO por lg: de Tailwind"). Con un viewport de 1440px, `md:` se mantiene
satisfecho aunque el drawer angoste `<main>` a 534px — la grilla semanal (que necesita
~900px reales para sus 7 columnas) sigue montada sin espacio, y su propio
`overflow-x-auto` se activa como fallback.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
Ninguno — fix autónomo (mismo anti-patrón ya corregido en Asistencia B / spec 0030, acá
quedó sin aplicar en Mi Horario).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/instructor/horario/instructor-horario.component.ts`
  — **Qué cambia:** reemplazar `hidden md:flex`/`md:hidden` por `@if
  (isDesktopLayout())`/`@else` sobre un `computed()` que lee `LayoutService.tier() ===
  'desktop'` (mismo patrón `isDesktopLayout()` ya usado en Asistencia B). Grilla semanal
  solo se monta cuando el contenedor tiene ≥1024px reales (tier desktop) — con el drawer
  abierto, cae a la vista timeline diaria (ya optimizada para poco ancho) en vez de mostrar
  la grilla con scroll interno roto.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Verificación manual en navegador: `/instructor/horario` en 1440×900, abrir el drawer de
  perfil → la grilla semanal cambia a timeline diario (sin scroll horizontal), cerrar el
  drawer → vuelve a la grilla.
- Sin `computed()` de decisión NUEVO no cubierto (reutiliza `LayoutService.tier()` ya
  testeado en otros componentes) → sin `.spec.ts` obligatorio nuevo.
