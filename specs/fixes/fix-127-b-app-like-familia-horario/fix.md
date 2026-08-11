# Fix: App-like: familia "horario" (`instructor` + `alumno`)
> id: fix-127-b-app-like-familia-horario
> refs: ASG-b-070
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Root Cause

[Heredado de ASG-b-070, a confirmar]: Ninguna de las 2 páginas (`/instructor/horario`,
`/alumno/horario`) sigue el patrón app-like — ambas tienen root `bento-grid` plano, sin
`--fill-screen`. Corrección importante ya confirmada sobre la primera pasada del audit:
ninguna de las 2 usa `agenda-semanal` (ese es el calendario operativo de staff, editable y
multi-instructor — no aplica acá); son implementaciones propias y distintas, de solo lectura.

`/instructor/horario`: root `bento-grid` + 1 `.bento-banner` que alterna
`WeeklyScheduleGridComponent` (desktop, ya `card flex flex-col h-full` con body
`flex-1 overflow-x-auto` y header `sticky` — ya listo para recibir `bento-fill`) /
`DailyScheduleTimelineComponent` (mobile, `space-y-6` plano — correcto así, no necesita fill).

`/alumno/horario`: calendario de 7 días 100% hecho a mano (sin componente compartido), con
hasta 4 celdas condicionales apiladas antes del calendario (hero, selector de matrícula si 2+,
"Próxima clase" si existe, calendario semanal siempre, "Sin matrícula" si aplica) — pueden
coexistir varias a la vez. Ningún modificador `--fill-screen*` existente calza tal cual con
"N filas auto variables + 1 fill".

Evaluado explícitamente si conviene unificar los componentes de instructor y alumno en uno
solo: **no** — densidad de datos distinta (instructor necesita grilla horaria por solapamiento
de clases consecutivas; alumno tiene 1-3 sesiones/semana y le alcanza una lista por día),
modelos de datos distintos (`ScheduleBlock`/`DaySchedule` con hora/minuto vs
`StudentHorarioDay`/`StudentHorarioSessionItem` sin precisión horaria) e interacción distinta
(bloques del instructor navegan a iniciar clase/evaluación; tarjetas del alumno son
informativas). Se mantienen como implementaciones separadas, tal como ya concluyó la
Asignación original.

## ACs Afectados

Ninguno — fix autónomo (rollout de layout, no cambia contrato de negocio).

## Cambio

- **Archivo:** `src/app/features/instructor/horario/instructor-horario.component.ts`
  - Root `bento-grid` → `bento-grid--fill-screen`.
  - `.bento-banner` que envuelve ambas vistas → `bento-fill flex flex-col h-full`.
  - Wrapper `hidden md:block` → `hidden md:flex md:flex-col md:min-h-0`.
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
  - Agregar `:host { display: flex; flex-direction: column; min-height: 0 }` (patrón "host como
    celda", precedente en `asistencia-clase-b-content`, spec 0031) para que su `h-full` interno
    tenga de dónde heredar altura real dentro de `.bento-fill`.
- **Archivo:** `src/app/features/alumno/horario/alumno-horario.component.ts`
  - Root `bento-grid` → `bento-grid--fill-screen-kpi` + `bento-grid--rows-fit` (este último
    agregado durante la implementación: sin él, el wrapper intermedio vacío —cuando ninguna de
    sus 3 condiciones internas es verdadera— hereda el piso `--bento-row-min: 120px` en mobile,
    donde `grid-template-rows` explícito de `--fill-screen-kpi` no aplica, dejando un hueco en
    blanco entre el hero y el calendario).
  - Reagrupar selector de matrícula + "Próxima clase" + "Sin matrícula" dentro de UN wrapper
    `.bento-banner` único, **siempre presente en el DOM** (los `@if` quedan adentro, no como
    celdas de grid separadas ni como un `@if` envolvente) — necesario para que el
    auto-placement de `--fill-screen-kpi` (3 filas fijas: hero/auto/fill) siga colocando el
    calendario en la fila `fill` cuando las 3 condiciones internas son falsas; sin el wrapper
    presente, el calendario caía en la fila `auto` y `contain:size` lo colapsaba a 0px.
  - El calendario semanal queda como única celda `.bento-fill`.
  - **Ampliación de scope autorizada por el usuario en el chat (no estaba en el Root Cause
    original):** ajuste responsive del grid de 7 días — se agrega `container-type: inline-size`
    (`.horario-calendar-card`) y una `@container` query propia del componente para que, en
    contenedores angostos (mobile), las columnas usen `minmax(30%, 1fr)` en vez de
    `minmax(88px, 1fr)` — muestra ~3 días por pantalla con swipe/scroll horizontal nativo para
    el resto, en vez de forzar `min-width: 620px` (que dejaba ~3.5 columnas cortadas sin pista
    visual de que había más contenido a la derecha).

## Test de Regresión

- Sin lógica de densidad nueva en ninguna de las 2 páginas → sin `.spec.ts` obligatorio nuevo
  (regla explícita de la Asignación original, confirmado: no existían specs previos para
  `instructor-horario`/`weekly-schedule-grid`/`alumno-horario` y no se agregó ningún `computed()`
  de decisión — solo CSS/template).
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, sin hallazgos nuevos en los 3 archivos tocados (solo warnings
  pre-existentes de complejidad, ARCH-09/ARCH-10, no relacionados a este cambio).
- `/verify` manual en navegador, logueado como `instructor@test.com` / `alumno@test.com`:
  - `/instructor/horario` — 1440×900: `documentScrolls:false`, `.bento-fill` con
    `contain:size` y sin scroll interno necesario. 390×844: timeline mobile intacto,
    `documentScrolls:false` (contenido corto). 1440×768: sin overflow, cabe completo.
  - `/alumno/horario` — 1440×900: `.bento-fill` mide 612px real (antes del fix del wrapper
    siempre-presente medía 48px, colapsado — bug encontrado y corregido en el mismo track).
    390×844: `bento-grid--rows-fit` confirmado sin hueco fantasma (wrapper vacío = 0px, 0
    hijos). 1440×768: sin overflow.
  - `force-compact`: **no aplica a ninguna de las 2 páginas** — confirmado por grep, ninguna
    inyecta `LayoutDrawerFacadeService` (ni hay otro drawer que se abra sobre ellas).
  - Ajuste responsive del calendario alumno: confirmado en 390px `gridTemplateColumns` con 7
    columnas de ~83px (vs 140px en 1440px), contenedor visible 308px → ~3.7 columnas por
    pantalla con scroll horizontal nativo para el resto (antes: `min-width:620px` fijo dejaba
    ~3.5 columnas cortadas sin pista de scroll).
  - Tabs de selector de matrícula: verificadas visualmente inyectando un segundo enrollment
    fake client-side (sin tocar la BD) sobre `alumno@test.com`, que en datos reales solo tiene
    1 matrícula — confirmado que el layout con 2 tabs (`Clase B · #0008` / `Profesional · #0012`)
    no rompe el grid de 3 filas fijas.
