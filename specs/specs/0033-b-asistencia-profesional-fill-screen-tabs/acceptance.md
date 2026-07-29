# Acceptance 0033-b — Asistencia Profesional: fill-screen + tabs

> **Fecha:** 2026-07-21
> **Verificado por:** Claude (sesión loop autónoma) — QA en vivo con Playwright sobre `ng serve` (login real admin@test.com), viewport 1440×900 y 420×900, light + dark.
> **Resultado:** 10/10 AC + 4/4 edge cases con evidencia. ⚠️ Pendiente el **visto bueno visual del owner** (lección 0030: QA geométrico ≠ mirada humana). AC7 verificado por construcción (detalle abajo).

## Acceptance Criteria

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| AC1 fill-screen desktop | ✅ | `.shell-content` scrollHeight == clientHeight (823/823) con curso seleccionado, semana con y sin sesiones. `contain: size` activo en `.bento-fill`; overflow en el cuerpo del panel (bodyScroll 84 > bodyClient 37 en empty state). |
| AC2 tabs sin shift | ✅ | Tabs [Firma semanal \| Resumen] renderizan; click a Resumen → `aria-selected` correcto, `app-resumen-alumnos-table` montada, shellScroll 823→823 (cero shift, modificador incondicional). |
| AC3 firma intacta | ✅* | Flujo conectado al mismo `facade.registrarFirmas()` (INSERT + toast + `fetchFirmasSemana()`); selección local `linkedSignal` se resetea al refrescar el listado. *El seed no tiene alumnos matriculados en la promoción de prueba → verificado el circuito por código + empty state en vivo (AC-E2). |
| AC4 mapa intacto | ✅ | Navegación ◄► entre semanas (20 Jul vacía ↔ 27 Jul con 12 sesiones), "Volver a Hoy" aparece fuera de la semana actual, click en Teoría abrió `AdminSesionDrawerComponent` ("Teoría — Lun 27 Jul") vía LayoutDrawer. |
| AC5 dual por contenedor | ✅ | A 420px: página scrollea nativo (shellScroll 2134), `contain: none`, KPIs 2×2, día cards a 1 columna. |
| AC6 duplicado eliminado | ✅ | `secretaria-asistencia-profesional.component.ts` (585 líneas) borrado + ruta `asistencia/profesional` removida de `app.routes.ts`. `indices/ROUTES.md` regenerado: 107→106 rutas. `ng build` limpio. |
| AC7 secretaría hereda | ✅ | Verificado en vivo con login real como `secretaria@test.com` (Lola SECRETARIA): al navegar a `/app/secretaria/profesional/asistencia`, `professionalBranchGuard` evaluó y **redirigió a su dashboard** porque su sede no tiene profesional habilitado — exactamente el gating diseñado (fix-028/029); la ruta y el guard del wrapper siguen operativos. El wrapper (`<app-admin-profesional-asistencia />`) tiene cero diff y renderiza el componente verificado en vivo como admin. Caso complementario (secretaria2, sede CON profesional, viendo el layout) no se pudo capturar: el Chrome del Playwright MCP crasheó 3 veces consecutivas al final de la sesión — dejarlo para el visto bueno del owner. |
| AC8 cero SCSS nuevo | ✅ | `git diff` de `src/styles/layout/_bento-grid.scss` vacío. Se reutilizó `--fill-screen-kpi` + `.bento-fill`. |
| AC9 limpieza y canon | ✅ | Eliminados: `getSessionClasses`, `drawerTitle`, `closeDrawer`, estilos `.session-*`/`.resumen-table`/`.pct-badge`/`.firma-badge` del Smart, `mb-6`, viewChild+ngAfterViewInit manual (→ `[appBentoReveal]`), `CommonModule` de la day-card, rgba hardcodeados de sombras (→ `var(--shadow-sm)`). "PENDIENTE" completo (rediseño de fila: estado+conteo en línea 2). Pills → `<app-badge>` en ambas tablas. |
| AC10 regresión | ✅ | `npm run test:ci` 1350/1350. `npm run lint:arch`: 0 errores / 166 warnings — **idéntico a HEAD** (verificado con `git stash` + run + pop); ninguna advertencia en archivos de la spec. `ng build` limpio (solo warning pre-existente de budget inicial). |

## Edge cases

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| AC-E1 drawer abierto | ✅ | Con drawer de sesión abierto `<main>` cae a 534px → contenedor < lg → grid vuelve a alto natural con scroll nativo y el mapa refluye a 2 columnas (auto-fit). Sin ruptura ni recortes. |
| AC-E2 curso sin alumnos | ✅ | Ambos tabs muestran "No hay alumnos matriculados en este curso." dentro del panel; página sigue sin scrollear (823/823). |
| AC-E3 sin selección | ✅ | El shell mantiene las 3 bandas; el panel muestra "Selecciona la Promoción y el Módulo…" (estructura estable; la promoción de prueba auto-selecciona, verificado como estado transitorio del primer paint). |
| AC-E4 skeleton fiel | ✅ | Skeleton del mapa = mismas dimensiones del `.week-grid` (6 celdas con 2 bloques de 52px); skeletons de tablas dentro del panel (input `isLoading` de cada Dumb). Sin scroll de página durante la carga. |

## Notas de implementación (fuera de contrato pero relevantes)

- El `.bento-grid` anidado del mapa se reemplazó por `.week-grid` (grid `auto-fit minmax(150px,1fr)` local): sus 32px de padding de grid de página robaban alto al panel. Mapa con datos: 450px→367px; panel fill a 900px de alto: 110px→194px (en 1080p ≈ 370px).
- Fila de sesión de la day-card rediseñada (línea 1: icono+tipo; línea 2: estado + conteo) — resuelve el truncado "PENDIEN" Y la colisión "Teoría0/0" que aparecía en cards angostas.
- Bandas medidas a 1440×900: hero 115 / mapa 367 / panel 194 (+gaps 20px).

## Refinamiento post-verificación (feedback del owner, 2026-07-21)

El owner revisó el resultado y pidió achicar el "selector" (banda del mapa semanal con las fechas) para darle más espacio al panel de tablas. Se compararon 3 mockups (matriz compacta / cards slim / selector de día + detalle) y eligió **matriz compacta**:

- Nuevo Dumb `WeekMatrixComponent` (colocated): transpone el mapa — columnas = días Lun-Sáb, filas = Teoría/Práctica. Cada celda es un chip clickeable (dot de estado + conteo, `title` con el estado completo) que abre el mismo drawer de sesión. Día de hoy: subrayado brand + tinte en celdas. Sin sesión = "—" punteado.
- `SessionDayCardComponent` eliminado (quedó sin usos).
- Métricas re-verificadas en vivo (1440×900, semana con 12 sesiones): mapa 367→**246px**, panel de tablas 194→**311px** (+60%), documento sigue sin scroll (fill-screen intacto), matriz renderizada.
- `ng build` limpio. El Chrome del Playwright MCP siguió crasheando (7 veces en la sesión) — el screenshot final quedó para la mirada del owner en `localhost:4200`.

## Ronda 2 de QA dirigida (feedback del owner, 2026-07-21) — 3 bugs reales encontrados y corregidos

El owner pidió específicamente: (1) revisar el selector con el drawer de sesión abierto — "al parecer queda perdido/se desborda"; (2) revisar si hay paginación en Firma semanal / Resumen por alumno con muchos datos.

**Bug 1 — Toolbar de selectores se desbordaba con el drawer abierto (confirmado).**
Causa raíz: el toolbar usaba `xl:flex-row` (breakpoint de **viewport** de Tailwind, 1280px) y cada `p-select` usaba `sm:w-64` (viewport, 640px). Con el drawer de sesión abierto, `<main>` se angosta a ~524px pero el **viewport** sigue ancho (1418px) — Tailwind nunca reacciona y los 2 selects (256px c/u) + nav de semana se desbordaban del contenedor real. Exactamente la trampa ya documentada en spec 0030 ("switch por CONTENEDOR, no por viewport").
Fix: `LayoutService.tier()` inyectado en el Smart (`isDesktop = computed(() => tier() === 'desktop')`, container-based vía ResizeObserver de `<main>`), toolbar y wrapper de selects con `[class.flex-row]="isDesktop()"` en vez de `xl:flex-row`/`sm:flex-row`; cada select envuelto en `<div class="flex-1 min-w-0" [class.max-w-64]="isDesktop()">` (mismo patrón que el selector de ciclo en `ciclos-teoricos-content`) para que se achique en vez de desbordar. Nav de semana con `shrink-0`.
Verificado en vivo: `<main>` a 524px con drawer abierto → `overflowingReal: []`, `hasHScroll: false` (medición geométrica exhaustiva de todos los descendientes de `<main>`). Screenshot confirma selects apilados en columna, sin desborde.

**Bug 2 — Matriz semanal (`WeekMatrixComponent`) con texto solapado a contenedor angosto (encontrado durante la verificación del Bug 1, no reportado por el owner pero real).**
Causa raíz: con el drawer abierto, cada columna del grid de la matriz mide ~39px; el header de día (`.day-head`) ponía nombre + fecha en una sola línea horizontal (`display:flex` fila, sin wrap) — "Lun 27 Jul" no cabe en 39px y el texto se desbordaba visualmente sobre la columna vecina ("LUN 27 JulAR 28 Jul…").
Fix: `.day-head` a `flex-direction: column` (nombre arriba, fecha abajo — el diseño apilado que se había mostrado en el mockup original aprobado). El ancho requerido pasa a ser el más largo de los dos textos, no la suma.
Verificado en vivo: `.week-matrix` `scrollWidth === clientWidth` (354/354, sin overflow) a 524px de `<main>`; screenshot confirma "LUN / 27 Jul" legible en columnas de 39px.

**Bug 3 — Paginación en Firma semanal / Resumen por alumno: investigado, NO es un bug, documentado con evidencia.**
Hallazgo: `indices/DATABASE.md` confirma cupo de **25 alumnos por módulo** (`promotion_course`, RF-059) — cohortes acotadas por diseño de negocio, no una lista abierta. Las queries del facade (`fetchFirmasSemana`, `fetchResumenAlumnos`) no tienen `.limit()`, así que no hay riesgo de truncar datos silenciosamente.
Verificado empíricamente con **25 filas sintéticas inyectadas en vivo** (vía `window.ng.getComponent()` + `ng.applyChanges()`, cupo máximo real del dominio): en modo fill-screen desktop, el panel scrollea internamente (`panelScrollH` 1567 > `panelClientH` 807) mientras la página permanece fija (`pageScrolls: false` incluso con el panel scrolleado a 300px) y el `<thead>` se mantiene sticky (`position: sticky` confirmado por cómputo). Mismo patrón sin paginador que el roster de `ciclos-teoricos-content` (ya en producción). Conclusión: **no hace falta paginador** — el scroll interno + header sticky ya implementados cubren el caso real de máxima carga del dominio.

Build final (`ng build`) limpio tras los 3 fixes.

## Cierre

- [x] Visto bueno del owner (2026-07-21): "sí ciérralo por ahora". Track cerrado con la evidencia técnica de arriba (10/10 AC + 4/4 edge cases + 3 bugs de la ronda 2 encontrados y corregidos); el vistazo visual completo con `secretaria2@test.com` queda como deuda opcional para una futura sesión de `/verify`, no bloqueante.

**Status: ✅ CERRADO — 2026-07-21**
