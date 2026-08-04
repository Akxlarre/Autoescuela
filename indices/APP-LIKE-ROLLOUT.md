# Rollout App-like — Auditoría completa (4 portales)

> **Fecha:** 2026-08-02
> **Alcance:** las ~86 rutas enrutables de los 4 portales (`admin`, `secretaria`, `instructor`,
> `alumno`), incluidas subpáginas y `:id`. Fuente de rutas: `indices/ROUTES.md`
> (`src/app/app.routes.ts`).
> **Metodología:** para cada componente de ruta se leyó su template (o el `*-content` compartido
> al que delega) buscando `bento-grid`, los modificadores `--fill-screen`/`-2`/`-kpi`, `.bento-fill`
> y la estructura real renderizada (KPIs, tablas, tabs, listas, formularios). Se verificó cada
> archivo del listado de partida (`bento-fill`/`fill-screen` vía grep) en vez de asumirlo resuelto:
> **2 falsos positivos** del grep inicial se reclasificaron — `admin-alumno-detalle.component.ts`
> y `secretaria-matricula.component.scss` solo mencionan `fill-screen` en un **comentario**
> explicando por qué NO lo usan (o por qué usan un patrón custom), no en una clase aplicada.
> No se modificó ningún archivo de código — este documento es solo de lectura/planificación.
>
> **Actualización 2026-08-02 (revisión de criterio):** la primera pasada de esta auditoría trató
> "múltiples secciones secuenciales" y "es un wizard" como motivos de exclusión válidos. Se
> formalizó el criterio real en `.claude/rules/visual-system.md` §"Cuándo NO aplica el patrón" —
> **app-like es el default, la excepción debe justificarse** con 1 de 3 criterios explícitos
> (contenido corto sin overflow / uso real mobile-tablet-first / no es vista de navegación). Bajo
> ese criterio, **4 páginas se reclasificaron de "No aplica" a "Candidatas"** (con recomendación de
> reestructurar en tabs, sin perder funcionalidad) — ver detalle en cada sección.

## Ya aplicado (✅ 30 rutas)

| Ruta(s) | Componente / Content | Modificador | Notas de patrón |
|---|---|---|---|
| `/admin/dashboard` | `DashboardComponent` | `--fill-screen-2` | Hero + fila KPIs + fila Actividad/Alertas 50/50 (`bento-activity-lg`/`bento-alerts-lg`) + `app-live-classes-panel` como `.bento-fill` |
| `/admin/alumnos`, `/secretaria/alumnos` | `alumnos-list-content` (shared) | `--fill-screen` | Lista + filtros, densidad adaptativa |
| `/admin/clase-profesional/alumnos`, `/secretaria/profesional/alumnos` | `alumnos-profesional-list-content` (shared) | `--fill-screen` | — |
| `/admin/clase-profesional/pre-inscritos`, `/secretaria/profesional/pre-inscritos` | `pre-inscritos-content` (shared) | `--fill-screen` | — |
| `/admin/ex-alumnos` | `AdminExAlumnosComponent` (propio) | `--fill-screen` | — |
| `/secretaria/ex-alumnos` | `SecretariaExAlumnosComponent` (propio, casi duplicado del de admin) | `--fill-screen` | — |
| `/admin/ex-alumnos-profesional`, `/secretaria/ex-alumnos-profesional` | `ex-alumnos-profesional-content` (shared) | `--fill-screen` | — |
| `/admin/agenda`, `/secretaria/agenda` | `agenda-semanal` (shared) | `--fill-screen` | Calendario semanal, patrón reutilizable para horarios |
| `/admin/asistencia`, `/secretaria/asistencia` | `asistencia-clase-b-content` (shared) | `--fill-screen-kpi` | 2 tabs internas: Prácticas + Ciclos Teóricos (`ciclos-teoricos-content` anidado, host-as-bento-fill, spec 0031) |
| `/admin/certificacion`, `/secretaria/certificados` | `certificacion-clase-b-content` (shared) | `--fill-screen` | — |
| `/admin/clase-profesional/certificados`, `/secretaria/profesional/certificados` | `certificacion-profesional-content` (shared) | `--fill-screen` | Card `dual-viewport-container` |
| `/admin/clase-profesional/relatores`, `/secretaria/profesional/relatores` | `AdminProfesionalRelatoresComponent` (secretaria wrappea al de admin) | `--fill-screen` | — |
| `/admin/clase-profesional/promociones`, `/secretaria/profesional/promociones` | `AdminProfesionalPromocionesComponent` (secretaria wrappea) | `--fill-screen` | — |
| `/admin/clase-profesional/asistencia`, `/secretaria/profesional/asistencia` | `AdminProfesionalAsistenciaComponent` (secretaria wrappea) | `--fill-screen-kpi` | — |
| `/admin/tareas` | `AdminTareasComponent` → `task-list-content` (shared) | `--fill-screen` | Consolidado spec 0029 |
| `/instructor/tareas` | `InstructorTareasComponent` → `task-list-content` (shared) | `--fill-screen` | — |
| `/secretaria/observaciones` | `SecretariaObservacionesComponent` → `task-list-content` (shared) | `--fill-screen` | Ruta se llama "observaciones", no "tareas", pero es el mismo content consolidado |
| `/admin/matricula`, `/secretaria/matricula` | `SecretariaMatriculaComponent` (admin wrappea; wizard PrimeNG Stepper) | **Patrón custom** (no usa `.bento-grid--fill-screen`) | `:host{display:flex}` + `@container layoutmain (min-width:1024px){height:calc(100vh - 100px)}` documentado en el `.scss`. Fuera del canon bento-grid porque es un wizard reutilizado también dentro de un drawer |

## Candidatas (🔲 45 rutas)

### Admin

| Ruta | Componente | Contexto | Recomendación de layout | Complejidad |
|---|---|---|---|---|
| `/admin/instructores` | `AdminInstructoresComponent` | Tabla paginada de instructores (10/página, Anterior/Siguiente fijo en desktop Y mobile), `.bento-banner.card.dual-viewport-container` + `--hero-fit` (`--hero-fit` no aporta app-like, solo fija `grid-template-rows:auto`) | **Decisión tomada 2026-08-02:** eliminar paginación fija, reemplazar por el patrón real de `alumnos-list-content.component.ts:867-936` — root `--fill-screen`, card `bento-fill flex flex-col h-full`, `.viewport-content` `flex-1 min-h-0 overflow-y-auto`. Desktop: tabla muestra `filteredInstructores()` completo (sin paginar, scroll interno). Mobile: `visibleCards()=sliceByBudget(filteredInstructores(), mobileShown())` con `mobileShown=signal(6)` + botón "Cargar más (N restantes)", reset a 6 en cada cambio de filtro | **Baja-Media** (subida 2026-08-02: `sliceByBudget`/`mobileShown` son `computed()` con decisión → `.spec.ts` obligatorio por `testing-tdd.md`) |
| `/admin/secretarias` | `AdminSecretariasComponent` | Hero + **1 fila** con 2 celdas lado a lado: `bento-wide` (9 cols, lista con paginación Anterior/Siguiente hand-rolled) + `bento-tall` (3 cols, sidebar estático: descripción de rol + permisos + link a auditoría) | **Decisión 2026-08-02:** root `--fill-screen` (singular — es 1 fila con 2 columnas, NO `--fill-screen-2` que es para filas apiladas). AMBAS celdas necesitan `.bento-fill` (comparten la misma fila `minmax(0,1fr)`). Lista: sacar paginación, mismo patrón `LayoutService`+`mobileShown`+`sliceByBudget`+"Cargar más" que instructores/secretarias-list. Sidebar: `bento-fill flex flex-col h-full` + `overflow-y-auto` defensivo en su contenido (hoy cabe siempre, pero puede crecer) | Media |
| `/admin/auditoria` | `AdminAuditoriaComponent` | Hero (`--hero-fit`, no aporta) + card de tabla (grid CSS custom, no `<table>`) con `<p-paginator>` **server-side** (`facade.setPage()` dispara fetch nuevo, 25/página) + banner informativo como 3ra celda separada del grid | **Decisión 2026-08-02:** el paginador NO se saca (es server-side, no hay lista completa en memoria para scrollear). Root `--hero-fit` → `--fill-screen`. Card: `bento-fill flex flex-col h-full`, wrapper de filas `flex-1 min-h-0 overflow-y-auto` (scroll interno de las 25 filas de la página actual). El banner informativo se mueve DENTRO de la card como footer fijo (`shrink-0`, debajo del paginador) en vez de quedar como 3ra celda del grid — ningún modificador existente soporta "hero + fila fill + fila estática abajo", y el banner es contenido corto directamente relacionado con la tabla | Baja-Media |
| `/admin/flota` | `AdminFlotaComponent` (wrapper sin template propio) → `flota-list-content` (shared) | `p-table` de vehículos con `[paginator]="true" [rows]="10"`, `dual-viewport-container`. **Decisión 2026-08-02:** para tablas `p-table` se MANTIENE el paginador nativo (no como instructores, que es tabla hecha a mano) | Copiar el patrón ya probado en 6 páginas hermanas `p-table` (`alumnos-list-content` etc.): root `--fill-screen`, card `bento-fill flex flex-col h-full`, ambos `.viewport-content` con `flex flex-col flex-1 min-h-0 h-full w-full`, `<p-table [scrollable]="true" scrollHeight="flex">` (paginador se mantiene). Mobile sin cambios — ya renderiza todas las cards sin límite, correcto para scroll natural | Baja |
| `/admin/flota/:id/mantenimientos` | `VehicleMaintenancesComponent` | **Verificado 2026-08-02:** orden real es tabla PRIMERO, `bento-square`s de "próximas fechas" DESPUÉS (0-N según data) — al revés del patrón KPI-row-luego-contenido del resto del DS | Reordenar template: mover los `bento-square` ANTES de la tabla (para calzar con `--fill-screen-kpi`, auto-auto-fill). Tabla ya tiene `p-table [paginator]="true"` → agregar `[scrollable]="true" scrollHeight="flex"` (mantiene paginador, patrón estándar) | Baja-Media |
| `/admin/pagos` | `AdminPagosComponent` | **Corregido 2026-08-02:** NO son 2 tablas — son 3 bloques SIEMPRE visibles apilados en 1 sola `.bento-banner`: (1) Deudores (paginación hand-rolled), (2) fila 2-col `lg:8/lg:4` con Pagos Recientes (paginada) + sidebar Métodos de Pago | **Decisión de diseño (⚠️ confirmar, no es solo CSS):** NO usar tabs — hoy todo es visible a la vez y esconder Pagos Recientes detrás de un click cambiaría el flujo de trabajo. Root `--fill-screen-2`: fila 1 = Deudores `.bento-fill` (sin paginación, scroll interno + "Cargar más" mobile); fila 2 = Pagos Recientes + sidebar, ambas `.bento-fill` compartiendo la fila, mismo tratamiento de paginación | **Alta** (subida 2026-08-02: 2 listas con `sliceByBudget`/`mobileShown` nuevos = 2 sets de tests nuevos, sobre una página ya Media-Alta por la decisión de diseño) |
| `/admin/documentos` | `AdminDocumentosComponent` → `dms-list-content` (shared) | 4 tabs (`students`/`school`/`templates`/`instructors`), root hoy `--rows-fit`. **Hallazgo 2026-08-02:** tab "students" tiene `h-125` (500px) HARDCODEADO — anti-patrón, hay que sacarlo antes de aplicar fill. Posible split 8/4 columnas sin verificar completo (archivo de 753 líneas) | Root → `--fill-screen-kpi` (hero=auto, tabs-nav=auto, panel=fill). Envolver el `@switch(activeTab())` en `bento-fill flex flex-col h-full`. Sacar `h-125`, usar `h-full flex-1 min-h-0`. Los 2 `p-table` (students/instructors) → `[scrollable]="true" scrollHeight="flex"` + mantener paginador condicional. Verificar split 8/4 y tabs school/templates al implementar | Media |
| `/admin/servicios-especiales` | `AdminServiciosEspecialesComponent` → `servicios-especiales-content` (shared) | **Verificado 2026-08-02:** 2 `.bento-banner` apiladas de ancho completo (catálogo arriba, historial de ventas abajo) — NO es 2 columnas lado a lado. Historial es `<table>` hecha a mano SIN paginación (ni desktop ni fallback mobile `sm:hidden`) | Root `--fill-screen-2` (2 filas fill apiladas, no `--fill-screen` singular). Ambas `.bento-banner` → `bento-fill flex flex-col h-full`; contenido interno → `flex-1 min-h-0 overflow-y-auto`. Sin decisión de paginación pendiente — nunca tuvo | Media |
| `/admin/contabilidad/cursos` | `AdminContabilidadCursosComponent` | **Verificado 2026-08-02:** hero + 1 sola `.bento-banner` con `<table>` hand-rolled, sin paginación | `--fill-screen` (singular), `.bento-fill` en la tabla, wrapper interno `flex-1 min-h-0 overflow-y-auto`. Sin decisión de paginación pendiente | Baja |
| `/admin/contabilidad/anticipos` | `AdminContabilidadAnticiposComponent` | **Verificado 2026-08-02:** hero + toolbar (`.bento-banner` propia) + 2 tablas hand-rolled apiladas (cuenta corriente, historial), sin paginación ni tabs — son 4 filas conceptuales, no 3 | **⚠️ Sin modificador que calce:** ningún `--fill-screen-*` cubre "hero + toolbar auto + 2 filas fill apiladas". Opciones a decidir: (a) plegar el toolbar como header fijo dentro de la primera tabla (como se hizo con el banner de auditoría) para volver a 3 filas y usar `--fill-screen-2`; (b) toolbar se queda como fila propia y se necesita un modificador nuevo. Recomiendo (a) por consistencia con la decisión de auditoría | Media |
| `/admin/contabilidad/liquidaciones` | `AdminContabilidadLiquidacionesComponent` → `liquidaciones-content` (shared) | **Verificado 2026-08-02:** hero + toolbar filtros + tabla hand-rolled sin paginación (muestra todo el período; "Anterior/Siguiente" es navegación de MES, no de tabla) — 3 filas | `--fill-screen-kpi` (no `--fill-screen` singular). Tabla → `bento-fill flex flex-col h-full`, wrapper `hidden md:block` → `flex-1 min-h-0 overflow-y-auto`. Sin decisión de paginación pendiente | Baja-Media |
| `/admin/contabilidad/historial-cuadraturas` | `AdminContabilidadHistorialCuadraturasComponent` → `historial-cuadraturas-content` (shared) | **Verificado 2026-08-02:** hero + toolbar mes + calendario mensual acotado (máx 42 celdas, `hidden lg:grid` + fallback mobile aparte) — 3 filas | `--fill-screen-kpi`. Calendario → `bento-fill flex flex-col h-full`, grid `hidden lg:grid...flex-1` → agregar `min-h-0 overflow-y-auto` (por si un mes tiene muchos eventos por celda) | Baja |
| `/admin/contabilidad/reportes` | `AdminContabilidadReportesComponent` → `reportes-contables-content` (shared, `--rows-fit`) | **Verificado 2026-08-02: son 7 `.bento-banner` secuenciales, no 4-5** (784 líneas, no mapeadas en detalle) | Confirma el diagnóstico original: necesita rediseño en tabs antes de fill-screen, no es una pasada mecánica. Requiere sesión dedicada para decidir cómo agrupar las 7 secciones en tabs sin perder ningún reporte | Alta |
| `/admin/contabilidad/cuadratura` | `AdminContabilidadCuadraturaComponent` → `cuadratura-content` (shared, `--hero-fit` + `.bento-feature`) | **Verificado 2026-08-02:** 990 líneas, YA tiene CSS custom inline para `.bento-grid` + manejo de `force-compact` (drawer abierto) que hay que respetar; `p-6 pb-12` extra en el host del grid (inusual) | Requiere sesión dedicada — adaptar `.bento-feature` a `.bento-fill` sin romper el CSS custom existente ni el contador de billetes/monedas (interacción táctil, no debe perder tamaño) | Alta |
| `/admin/clase-profesional/evaluaciones` | `AdminProfesionalEvaluacionesComponent` | **Verificado 2026-08-02 — más complejo de lo estimado:** el componente tiene DOS modos completamente distintos: (1) "Aterrizaje" sin grilla activa — N grupos de promoción apilados, cada uno su propia `.bento-banner` con grid de cursos (cantidad variable, no acotada); (2) "Grilla" con la matriz de notas real — ya tiene CSS custom inline sobrescribiendo `.bento-grid`, header sticky Y columna de alumno sticky (scroll bidireccional ya resuelto en parte) | **Necesita sesión dedicada, no es una pasada mecánica.** Modo aterrizaje: envolver TODOS los `@for` de promo-groups en un único wrapper `.bento-fill` (hoy cada uno es su propia celda top-level, hay que restructurar). Modo grilla: ya tiene la base de scroll bidireccional — falta integrarla con `--fill-screen-kpi`/`.bento-fill` sin romper los sticky existentes. 828 líneas, no alcancé a mapear todo en esta ronda | Alta |
| `/admin/clase-profesional/archivo` | `AdminProfesionalArchivoComponent` (secretaria wrappea) | **Corregido 2026-08-02 — más simple que Evaluaciones:** NO tiene el modo dual landing/grilla. Es filtro (auto) + tabla con columna "Alumno" ya `sticky-col` + 2 empty-states condicionales, sin paginación | `--fill-screen-kpi`: filtro=auto, tabla=fill `.bento-fill`, wrapper con `flex-1 min-h-0 overflow-y-auto` (el sticky-col ya existe, no romperlo) | Media |
| `/admin/libro-de-clases`, `/secretaria/libro-de-clases` | `LibroDeClasesComponent` (shared) | **Verificado 2026-08-02: son 7 `.bento-banner` secuenciales (no 6+)**, ya con `<app-libro-de-clases-subnav>` como navegación auxiliar (874 líneas) — buena base porque la semántica de "secciones nombradas" ya existe, falta confirmar si el subnav hoy hace scroll-to-anchor o show/hide real | Reestructurar en tabs reusando el subnav existente (si hoy es scroll-to-anchor, convertirlo a mostrar/ocultar panel real vía `@switch`), una sección = un `.bento-fill` por tab. Ya tiene deuda técnica conocida (bug de skeleton gap, fix-074) — conviene resolver junto con esa reestructuración | Alta |
| `/admin/alumnos/:id`, `/secretaria/alumnos/:id` | `AdminAlumnoDetalleComponent` (shared) | **⚠️ Verificado 2026-08-02 — la más grande y riesgosa del rollout: 1654 líneas.** Ya tiene ~20 líneas de comentario explicando por qué NO usa `--fill-screen` (CSS custom override documentado, líneas 828-850) — es una decisión deliberada y ya razonada, no un olvido. NO tiene tabs propias hoy (el `<app-tabs>` que usa es para elegir entre matrículas del alumno, no para las secciones ficha/pagos/documentos) — reestructurar en tabs significa CONSTRUIR la UI de tabs desde cero, no reusar algo existente | Reestructurar en tabs (Ficha/Matrículas/Pagos/Documentos/Clases) SIGUE siendo la recomendación bajo el criterio formal, pero es la página de mayor riesgo de todo el rollout (más tráfico + más código + CSS custom ya afinado). Recomiendo: última en ejecutarse, con su propia spec dedicada (no un fix rápido), y QA visual exhaustivo antes de cerrar | **Alta** (la más alta de todo el rollout) |
| `/admin/configuracion-web`, `/secretaria/configuracion-web` | `AdminConfiguracionWebComponent` (shared) | **Verificado 2026-08-02:** son 6 tabs (no 5) — `general/hero/cursos/promo/contacto/faqs` — cada una su PROPIO componente `*-tab.component.ts` separado, usando `<app-tabs>` (el shared `TabsComponent`, no hand-rolled). Base ideal para el patrón | `--fill-screen-kpi` alrededor de `<app-tabs>`; el panel de la tab activa → `bento-fill flex flex-col h-full` con scroll interno del form. Al ser 6 componentes separados, verificar cada uno individualmente por si alguno tiene su propia altura fija o estructura que rompa el fill (no revisados los 6 en esta ronda) | Media |

### Secretaria (rutas propias, no compartidas con admin)

| Ruta | Componente | Contexto | Recomendación | Complejidad |
|---|---|---|---|---|
| `/secretaria/dashboard` | `SecretariaDashboardComponent` | Mismo layout conceptual que `/admin/dashboard` (hero + KPIs + `app-live-classes-panel`), pero el root **no** tiene `--fill-screen-2` — el `.bento-fill` del panel ya existe pero no hace nada porque el padre no es fill-screen | Copiar literal el modificador `--fill-screen-2` que ya usa `DashboardComponent` de admin — patrón 100% resuelto, solo falta aplicarlo. Incluye portar `LayoutService`+`isDesktopTier`+`sliceByBudget` para `visibleActivities`/`visibleAlerts`/`liveClassesBudget` (hoy hardcodeado a `.slice(0,4)`/`.slice(0,3)`) | **Baja-Media** (subida 2026-08-02: los `computed()` de densidad que se portan necesitan `.spec.ts` propio, no existía antes en esta página) |
| `/secretaria/pagos` | `SecretariaPagosComponent` (casi duplicado línea-por-línea de `AdminPagosComponent`) | Igual que admin/pagos | Aplicar la misma solución que se diseñe para `/admin/pagos`, con sus propios tests | **Alta** (subida 2026-08-02, mismo motivo que admin/pagos) |
| `/secretaria/instructores` | `SecretariaInstructoresComponent` (casi duplicado línea-por-línea de `AdminInstructoresComponent`, mismo HTML/CSS, sin columna "Sede") | Igual que admin/instructores | Aplicar EXACTAMENTE la misma solución que `/admin/instructores` (ver detalle en esa fila) — mismo cambio, dos archivos, incluye su propio `.spec.ts` (misma lógica duplicada = mismo test duplicado, no se comparte por ser 2 componentes distintos) | **Baja-Media** (subida 2026-08-02, mismo motivo de tests que admin/instructores) |
| `/secretaria/profesional/notas` | `SecretariaProfesionalNotasComponent` | **Confirmado 2026-08-02:** casi clon exacto de `AdminProfesionalEvaluacionesComponent` (mismo CSS sticky inline, mismo modo dual landing/grilla) | Aplicar EXACTAMENTE la misma solución que se defina para `/admin/clase-profesional/evaluaciones` — mismo cambio, dos archivos | Alta |
| `/secretaria/profesional/archivo` | `SecretariaProfesionalArchivoComponent` (wrappea al de admin) | — | Se resuelve automáticamente al arreglar `AdminProfesionalArchivoComponent` (ahora Media, no Alta) | Media |
| `/secretaria/documentos` | `SecretariaDocumentosComponent` → `dms-list-content` (shared) | Igual que admin/documentos (mismo content) | Se resuelve junto con `/admin/documentos` | Media |
| `/secretaria/servicios-especiales` | `SecretariaServiciosEspecialesComponent` → `servicios-especiales-content` (shared) | Igual que admin | Se resuelve junto con `/admin/servicios-especiales` | Media |
| `/secretaria/contabilidad/liquidaciones` | → `liquidaciones-content` (shared) | Igual que admin | Se resuelve junto con `/admin/contabilidad/liquidaciones` | Media |
| `/secretaria/contabilidad/historial-cuadraturas` | → `historial-cuadraturas-content` (shared) | Igual que admin | Se resuelve junto con `/admin/contabilidad/historial-cuadraturas` | Media |
| `/secretaria/contabilidad/reportes` | → `reportes-contables-content` (shared) | Igual que admin | Se resuelve junto con `/admin/contabilidad/reportes` | Alta |
| `/secretaria/contabilidad/cuadratura` | → `cuadratura-content` (shared) | Igual que admin | Se resuelve junto con `/admin/contabilidad/cuadratura` | Alta |

### Instructor

| Ruta | Componente | Contexto | Recomendación | Complejidad |
|---|---|---|---|---|
| `/instructor/horario` | `InstructorHorarioComponent` | **Corregido 2026-08-02**: NO usa `agenda-semanal` (ese es el calendario operativo de staff) — usa `WeeklyScheduleGridComponent` (desktop, ya `card flex flex-col h-full` con body `flex-1 overflow-x-auto` y header `sticky`, listo para recibir `bento-fill`) / `DailyScheduleTimelineComponent` (mobile, `space-y-6` plano — correcto así, mobile no necesita fill) | Root `--fill-screen`. `.bento-banner` que envuelve ambos: `bento-fill flex flex-col h-full`. El wrapper `hidden md:block` → `hidden md:flex md:flex-col md:min-h-0`. `<app-weekly-schedule-grid>` necesita tratamiento "host como celda" (patrón spec 0031: `:host{display:flex;flex-direction:column;min-height:0}` en el componente) para que su `h-full` interno tenga de dónde heredar altura | Baja |
| `/instructor/ensayos-teoricos` | `InstructorEnsayosTeoricosComponent` | **Verificado 2026-08-02:** hero + 1 `.bento-banner` con 2 `<table>` hand-rolled (resultados/historial), sin paginación | `--fill-screen` singular, `.bento-fill` en la banner, cada tabla `flex-1 min-h-0 overflow-y-auto` si ambas caben, o evaluar si necesitan scroll independiente al implementar | Baja |
| `/instructor/notificaciones` | `InstructorNotificacionesComponent` | Lista corta de notificaciones (única página de notificaciones NO stub de los 4 portales) | Candidata de baja prioridad: la lista suele ser corta y no compite por alto; `--fill-screen` opcional | Baja |
| `/instructor/dashboard` | `InstructorDashboardComponent` | **Corregido 2026-08-02:** hero + 1 SOLA `.bento-banner` con grid Tailwind interno `lg:grid-cols-3` (Clases de Hoy `col-span-2` + sidebar `col-span-1`) — NO son celdas bento separadas | `--fill-screen` singular (no `-kpi`). La banner → `bento-fill flex flex-col h-full overflow-y-auto` (scroll compartido de todo el bloque — la lista "de hoy" suele ser corta, no justifica separar scrolls). ⚠️ Si más adelante se quiere scroll independiente por columna, hay que convertir el `grid` interno a `flex` (gotcha ya documentada: grid no propaga altura a hijos para su propio scroll, spec 0031) | Media |
| `/instructor/alumnos` | `InstructorAlumnosComponent` | **Verificado 2026-08-02:** paginación hand-rolled real (`PAGE_SIZE=9`, `pageStart/pageEnd`), cards en un `.bento-grid` ANIDADO dentro de la `.bento-banner` externa | `--fill-screen`. Banner externa → `bento-fill flex flex-col h-full`; el `.bento-grid` anidado de cards → `flex-1 min-h-0 overflow-y-auto` (es contenedor de cards, no necesita su propio `contain:size`). Sacar paginación → mismo patrón `sliceByBudget`+"Cargar más" mobile / todo+scroll desktop | **Media-Alta** (subida 2026-08-02: nuevo `.spec.ts` para la lógica de densidad) |
| `/instructor/liquidacion` | `InstructorLiquidacionComponent` | **Corregido 2026-08-02:** NO son 2 banners — es 1 SOLA `.bento-banner` con `flex flex-col gap-6` interno: chart de desglose (altura natural) + tabla de logs diarios (necesita scroll) | `--fill-screen` singular. Banner → `bento-fill flex flex-col h-full`; chart card → `shrink-0`; tabla de logs → `flex-1 min-h-0 overflow-y-auto` | Media |

### Alumno

> Portal usado mayoritariamente en mobile — el patrón app-like solo aporta en sesiones desktop/laptop, así que estas quedan con prioridad más baja en el rollout aunque técnicamente califiquen.

| Ruta | Componente | Contexto | Recomendación | Complejidad |
|---|---|---|---|---|
| `/alumno/horario` | `AlumnoHorarioComponent` | **Corregido 2026-08-02**: calendario de 7 días 100% hecho a mano (sin componente compartido), con hasta 4 celdas condicionales apiladas antes del calendario (hero, selector matrícula si 2+, "Próxima clase" si existe, calendario siempre, "Sin matrícula" si aplica) — pueden coexistir varias a la vez | Ningún modificador existente calza con "N filas auto variables + 1 fill". Reagrupar selector+próxima-clase+sin-matrícula dentro de UN wrapper `.bento-banner` (los `@if` quedan adentro, no como celdas de grid separadas) para que sea siempre 1 sola fila auto; el calendario semanal queda como única celda `.bento-fill` en `--fill-screen-kpi` | Media |
| `/alumno/pagos` | `AlumnoPagosComponent` | **Verificado 2026-08-02:** hero + selector-matrícula (opcional) + banner de estado (opcional, 1 de 2 variantes mutuamente excluyentes: aviso saldo pendiente Profesional / "matrícula al día") + "Historial de pagos" (siempre, salvo error). Mismo problema que alumno/horario: selector+banner-estado pueden coexistir = 2 filas auto antes del fill | Agrupar selector + banner-de-estado en un wrapper único (mismo fix que alumno/horario), historial-de-pagos como única celda `.bento-fill` en `--fill-screen-kpi` | Media |
| `/alumno/clases` | `AlumnoClasesComponent` | **Verificado 2026-08-02:** hero + selector-matrícula (opcional) + 1 card con TABS INTERNAS (Prácticas/Teoría, `activeTab` signal) + banner final condicional (probablemente empty-state) | `--fill-screen-kpi`: hero=auto, selector=auto, card-de-tabs=fill (`bento-fill flex flex-col h-full`). Verificar al implementar si el banner final (línea 265) es mutuamente excluyente con el contenido o se suma como 4ta fila — si se suma, agrupar como en alumno/horario | Media |
| `/alumno/pruebas-online` | `AlumnoPruebasOnlineComponent` | **Verificado 2026-08-02:** hero + banner con grid anidado de `bento-square` (stats) + banner con grid anidado de `bento-wide` (lista de simuladores) — encaja bien como KPI-row + contenido | `--fill-screen-kpi`: banner de stats=auto (fila KPI), banner de simuladores=fill | Baja-Media |
| `/alumno/dashboard` | `AlumnoDashboardComponent` | **Corregido 2026-08-02 — mucho más denso de lo que decía el audit:** hero + selector + 2 `bento-square` + columna izq/der 2 filas c/u (`bento-activity-lg`/`bento-alerts-lg`, esto SÍ confirma el patrón 2-col de admin/dashboard) + OTRA `.bento-banner` + 2 `bento-square` MÁS al final. Son ~9 celdas condicionales, no la versión simplificada del audit original | **Necesita una pasada dedicada aparte** — no alcancé a mapear las ~9 celdas en detalle en esta ronda. La base (2 columnas activity/alerts) sí reutiliza `--fill-screen-2` de admin/dashboard, pero hay que decidir qué pasa con las celdas extra (selector, 4 squares, banner final) antes de fijar el plan — mismo tipo de agrupamiento que alumno/horario probablemente aplique | **Alta** (subida desde Media) |
| `/instructor/alumnos/:id/ficha` | `InstructorFichaComponent` | **Verificado 2026-08-02:** 550 líneas (mucho más chica que la de admin/secretaria), 4 `.bento-banner` secuenciales + un `.bento-grid` ANIDADO dentro de una de ellas. Escala mucho menor que `AdminAlumnoDetalleComponent`, pero mismo problema de fondo (secciones secuenciales sin tabs) | Mismo patrón de tabs, pero al ser bastante más chica puede resolverse ANTES que la ficha admin/secretaria como piloto de bajo riesgo — probar el patrón de tabs acá primero y después aplicar el aprendizaje a la ficha grande, no al revés | Media (bajado desde Alta — es la piloto, no la definitiva) |
| `/alumno/pagar` | `AlumnoPagarComponent` | **Revisado 2026-08-02:** stepper hand-rolled (no PrimeNG), 3 pasos: resumen de saldo, confirmación, pago Webpay — contenido de cada paso es corto (cards de resumen, no formularios largos como matrícula) | **Posible reversión:** a diferencia de `matricula` (formularios extensos por paso), acá el contenido por paso probablemente nunca produce overflow real → podría calificar de nuevo por el criterio #1 ("contenido corto sin overflow") en vez de necesitar el patrón full-height de matrícula. Verificar el alto real de cada paso antes de decidir — si nunca scrollea, dejar como excepción y no tocarlo | Baja |

## No aplica — excepciones justificadas (⛔ 5 rutas)

> Cumplen alguno de los 3 criterios formales de `.claude/rules/visual-system.md` §"Cuándo NO
> aplica el patrón" (contenido corto sin overflow real / uso mobile-tablet-first por contexto
> físico / no es vista de navegación). Si alguno deja de cumplirlo (ej. el contenido crece), debe
> re-evaluarse.

| Ruta | Componente | Criterio | Motivo |
|---|---|---|---|
| `/admin/flota/hoja-de-ruta/:id` | `RouteSheetComponent` | #3 — no es vista de navegación | Hoja imprimible A4 con `@media print`, oculta el shell de la app |
| `/instructor/alumnos/:id/evaluacion/:sessionId` | `InstructorEvaluacionComponent` | #1 — contenido corto sin overflow | Un solo formulario reactivo corto de calificación; no hay contenido que "llenar la pantalla" |
| `/instructor/clase/:id` | `InstructorClaseDetailComponent` | #2 — uso real mobile/tablet-first | Detalle de clase en curso, se usa dentro del vehículo en tablet/móvil — el patrón optimiza desktop, que no es el caso de uso real acá |
| `/instructor/clase/iniciar` | `InstructorClaseComponent` | #2 — uso real mobile/tablet-first | Mismo contexto físico que el anterior |
| `/alumno/pagar/retorno` | `AlumnoPagarRetornoComponent` | #1 — contenido corto sin overflow | Pantalla de resultado centrada (`max-w-lg mx-auto`) tras volver de Webpay, intencionalmente angosta y corta |

## No aplica — pendientes de construir (⛔ 7 rutas)

> No son excepciones de diseño — son páginas sin construir. Cuando se implementen, deben
> evaluarse contra el patrón app-like como cualquier página nueva (probablemente candidatas, no
> excepciones).

| Ruta | Componente | Estado |
|---|---|---|
| `/admin/usuarios` | `AdminUsuariosComponent` | Stub "PLANO" — mockup pendiente de calcar, sin datos reales |
| `/admin/notificaciones` | `AdminNotificacionesComponent` | Stub "PLANO" |
| `/alumno/ayuda` | `AlumnoAyudaComponent` | Stub "PLANO" |
| `/alumno/notificaciones` | `AlumnoNotificacionesComponent` | Stub "PLANO" |
| `/secretaria/notificaciones` | `SecretariaNotificacionesComponent` | Stub "PLANO" |
| `/secretaria/comunicaciones` | `SecretariaComunicacionesComponent` | Placeholder "Próximamente" — módulo aún no construido |
| `/secretaria/asistencia/matriz` | `SecretariaAsistenciaMatrizComponent` | Placeholder "Próximamente" |

## Edge cases estresados (2026-08-02) — antes de convertir a ASGs

> Sesión de "grill" para encontrar puntos débiles no cubiertos en la auditoría inicial. Se agrega
> acá cada hallazgo con la decisión tomada, en vez de asumir que el documento de arriba ya es
> completo.

1. **Datasets grandes en listas "mostrar todo + scroll interno" (sin paginar).** Aplicado a ~10
   páginas (instructores, secretarias, servicios-especiales historial, liquidaciones, pagos,
   etc.) sin definir un techo. Riesgo: DOM gigante / scroll con jank si una escuela grande
   acumula cientos de filas, especialmente en modo admin "Todas las sedes" (multiplica el
   dataset).
   **Decisión (2026-08-02):** SÍ hay que resolverlo (no queda como deuda técnica ignorada), pero
   es una **tarea aparte que todavía requiere investigación** (elegir entre virtual scroll de
   PrimeNG, paginación real, u otro mecanismo — y definir el umbral real por página, no uno
   arbitrario) — **no se bloquea el rollout app-like por esto**, pero tampoco se cierra cada ASG
   individual sin dejar el hallazgo documentado.
   **Investigación completa (2026-08-03):** ver `docs/research/listas-grandes-virtual-scroll.md`
   (rama `claude/exciting-curie-2bdfdd`). De las ~10 páginas sospechadas, solo 2 (`ex-alumnos`,
   `servicios-especiales`) quedaron como acumulativas reales tras el estrés-test; el resto ya
   estaba resuelto o mal clasificado. Repartido en dos asignaciones: **ASG-b-087** (fix barato —
   límite en Deudores + filtro de período que búsqueda/export ignoran) y **ASG-b-088**
   (investigación empírica del umbral de virtual scroll, no bloquea la anterior). Este hallazgo
   ya no está pendiente de crear tarea — está cubierto, no volver a "descubrirlo".

2. **Manejo de `force-compact` (drawer abierto) verificado solo en 2-3 páginas de las ~30.**
   `LayoutService.tier()` ya mide `<main>` por contenedor, así que un drawer abierto SIEMPRE
   angosta el tier (esto ya funciona solo). Lo que puede faltar es la clase CSS `force-compact`
   en el grid de cada página para que no se vea apretado mientras el tier baja.
   **Decisión (2026-08-02):** es necesario en TODAS las páginas fill-screen que abren drawers
   (la mayoría). Se agrega como **ítem de checklist estándar en cada ASG individual** — no una
   auditoría aparte previa — verificar/agregar `force-compact` al mismo tiempo que se aplica
   `--fill-screen*`.

3. **Lógica nueva de densidad (`sliceByBudget`/`mobileShown`/`isDesktopTier`) sin tests
   contemplados en las estimaciones de complejidad.** `testing-tdd.md` exige `.spec.ts` para todo
   `computed()` con decisión en un Smart Component — la densidad adaptativa califica.
   **Decisión (2026-08-02):** tests obligatorios, sin excepción (no era una decisión a tomar, ya
   lo manda la regla del proyecto). Se ajustaron las etiquetas de complejidad de las páginas que
   agregan esta lógica por primera vez: `secretaria/dashboard`, `admin/instructores` +
   `secretaria/instructores`, `admin/pagos` + `secretaria/pagos`, `instructor/alumnos` — todas
   subieron un escalón. Páginas que ya tenían esa lógica (o nunca tuvieron paginación que sacar)
   no se tocaron.

4. **Radio de impacto de componentes `shared` (`dms-list-content`, `servicios-especiales-content`,
   `liquidaciones-content`, `historial-cuadraturas-content`, `ex-alumnos-profesional-content`,
   etc.).** Un ASG redactado pensando en la ruta admin toca el mismo archivo que sirve a
   secretaría (y a veces instructor) — si el QA de cierre solo verifica la ruta admin, la de
   secretaría puede quedar rota sin que nadie se entere (ej. `showSedeColumn()` cambia qué
   columnas se renderizan entre admin/secretaria, lo que puede cambiar si una fila desborda).
   **Decisión (2026-08-02):** cada ASG que toque un componente `shared` debe declarar TODAS las
   rutas consumidoras en su Definition of Done y verificar cada una con `/verify` antes de
   cerrar — no alcanza con la ruta principal.

5. **Altura mínima real de viewport (laptops ~768px de alto) sin validar.** El patrón usa
   `height: calc(100vh - 120px)` — en 1366×768 (hardware común de gama media/baja) deja ~648px
   para hero+contenido, bastante justo. Nunca se definió una altura mínima de referencia para QA.
   **Decisión (2026-08-02):** agregar 768px de alto como caso de prueba estándar en `/verify`
   para todas las páginas fill-screen del rollout (junto al ancho 390/1440 ya establecido). Zoom
   del navegador queda fuera de alcance salvo reporte real de un caso concreto.

6. **Reset de scroll por Realtime/SWR en listas que antes no tenían su propio scroll container.**
   Páginas con Realtime activo (agenda, pagos, notificaciones) usan `refreshSilently()` — si un
   admin está scrolleado a la mitad de una lista y llega un evento realtime, el array se
   reemplaza. El `track item.id` de Angular debería mantener el DOM estable y no resetear
   `scrollTop`, pero nunca se probó porque estas listas antes no tenían scroll propio (scrolleaba
   la página entera).
   **Decisión (2026-08-02):** agregar como caso de prueba explícito en `/verify` SOLO para las
   2-3 páginas de esta ronda con Realtime activo (agenda, pagos, notificaciones) — no en las ~30
   en general, sería desproporcionado. Se simula con 2 pestañas: una hace un cambio, la otra debe
   mantener su posición de scroll.

7. **Accesibilidad/teclado al pasar de scroll de página a scroll de contenedor anidado
   (`overflow-y-auto`).** El proyecto ya invirtió en a11y (fix-079-b). Cambia cómo `Ctrl+F` y la
   navegación por teclado/lector de pantalla interactúan con contenido fuera de vista dentro del
   `.bento-fill`.
   **Decisión (2026-08-03):** fuera del checklist obligatorio de `/verify` — es comportamiento
   nativo del navegador (`overflow-y-auto` CSS puro, sin JS custom de scroll), riesgo bajo a
   diferencia de los casos donde sí se introduce lógica nueva. Sí correr el guardrail a11y
   existente del proyecto una vez implementado cada página, sin agregar un caso de prueba nuevo
   dedicado.

8. **Estados vacíos y skeletons dentro de celdas `.bento-fill` ahora de altura variable/grande.**
   Antes vivían en cards de altura natural (~200-300px); ahora pueden ocupar "el resto del
   viewport" (500-600px+). Riesgo: `app-empty-state` centrado con demasiado espacio vacío
   alrededor, y skeletons con altura hardcodeada (ej. `height="300px"`) que dejan hueco entre el
   skeleton y el borde inferior de la card → posible salto de layout (CLS) al pasar a contenido
   real.
   **Decisión (2026-08-03):** definir el patrón estándar de entrada, no reactivo página por
   página — precedente directo: fix-078-b encontró 221 overlines ad-hoc por no fijar la regla
   desde el principio. **Regla nueva:** todo `app-empty-state`/skeleton dentro de un `.bento-fill`
   va en un wrapper `flex-1 flex items-center justify-center` para centrarse en el alto
   disponible sin verse hardcodeado. Aplicar proactivamente en cada ASG, no descubrir a mano.

9. **Secuencia contra la investigación de datasets grandes (punto 1) que corre en paralelo.**
   Riesgo de doble trabajo si se ejecutan ya las ~10 páginas "mostrar todo + scroll interno" y la
   investigación concluye que hace falta virtual scroll.
   **Decisión (2026-08-03):** NO pausar nada — la investigación decide CUÁNDO agregar virtual
   scroll/paginación encima del patrón fill-screen, no si el patrón en sí está bien. Fill-screen +
   scroll interno es la base necesaria para cualquier resultado de esa investigación (virtual
   scroll también requiere un contenedor de altura fija). El rollout sigue el orden ya definido
   sin esperar.
   **Resultado (2026-08-03):** investigación cerrada, ver punto 1 — quedó como ASG-b-087/ASG-b-088,
   no bloqueó ni bloquea ninguna pieza del rollout.

## Orden sugerido de rollout

Prioriza: (a) gaps triviales sobre patrones ya resueltos, (b) familias admin+secretaria casi
duplicadas que se resuelven en un solo esfuerzo, (c) menor complejidad primero.

1. **`/secretaria/dashboard`** — gap real de una sola línea (falta el modificador que ya usa
   `/admin/dashboard`; el `.bento-fill` del `live-classes-panel` ya está puesto y sin efecto).
2. **Familia "instructores"**: `/admin/instructores` + `/secretaria/instructores` — ambas ya
   tienen `dual-viewport-container` y `--hero-fit`, solo falta el shell fill-screen.
3. **`/admin/flota`** — mismo `dual-viewport-container` ya resuelto en `flota-list-content`.
4. **`/admin/secretarias`, `/admin/auditoria`** — tablas simples, ya `--hero-fit`, bajo esfuerzo,
   sirven de referencia rápida antes de atacar páginas con tabs.
5. **Familia "horario"**: `/instructor/horario` + `/alumno/horario` — copiar literal el patrón de
   `agenda-semanal`, ya validado en ambos portales de staff.
6. **Familia "documentos"**: `/admin/documentos` + `/secretaria/documentos` (`dms-list-content`,
   ya tiene tabs, solo falta el shell + `.bento-fill` por tab).
6b. **`/admin/configuracion-web` + `/secretaria/configuracion-web`** — mismo caso que documentos:
   5 tabs ya existentes, solo falta el shell `--fill-screen-kpi` alrededor.
7. **Familia "servicios especiales"**: `/admin/servicios-especiales` + `/secretaria/...`.
8. **Familia "liquidaciones" e "historial-cuadraturas"**: admin + secretaria de cada una
   (`liquidaciones-content`, `historial-cuadraturas-content`).
9. **Familia "pagos"**: `/admin/pagos` + `/secretaria/pagos` — requiere decidir tabs
   (Deudores/Pagos) antes de tocar código; alto tráfico, justifica el esfuerzo medio-alto.
10. **`/admin/flota/:id/mantenimientos`, `/admin/contabilidad/cursos`,
    `/admin/contabilidad/anticipos`** — candidatas sueltas de complejidad baja-media.
11. **`/instructor/dashboard`, `/instructor/alumnos`, `/instructor/liquidacion`,
    `/instructor/ensayos-teoricos`, `/instructor/notificaciones`** — portal instructor, tráfico
    medio, sin familias que compartir.
12. **`/alumno/clases`, `/alumno/pagos`, `/alumno/pruebas-online`, `/alumno/pagar`** — portal
    alumno, prioridad menor por ser mobile-first, pero de bajo-medio esfuerzo. `pagar` replica el
    patrón de wizard full-height de `matricula`.
13. **Familia "matriz de notas"**: `/admin/clase-profesional/evaluaciones` +
    `/secretaria/profesional/notas` (casi duplicados) y `/admin/clase-profesional/archivo` +
    `/secretaria/profesional/archivo` — alta complejidad, resolver ambos pares juntos porque
    comparten estructura.
14. **Familia "reportes contables"**: `/admin/contabilidad/reportes` + `/secretaria/...` y
    `/admin/contabilidad/cuadratura` + `/secretaria/...` — requieren rediseño con tabs antes del
    shell app-like; agrupar en un solo track porque comparten el mismo `*-content`.
15. **`/alumno/dashboard`** — reutiliza el layout de 2 columnas de `DashboardComponent` de admin,
    pero es portal de menor prioridad.
16. **Familia "fichas de detalle de alumno" — orden interno revisado 2026-08-02:** primero
    `/instructor/alumnos/:id/ficha` (`InstructorFichaComponent`, 550 líneas, 4 secciones) como
    **piloto de bajo riesgo** para probar el patrón de tabs recién construido desde cero. Recién
    después `/admin/alumnos/:id` + `/secretaria/alumnos/:id` (`AdminAlumnoDetalleComponent`, 1654
    líneas, la página más grande y riesgosa de todo el rollout — CSS custom ya documentado,
    máximo tráfico). Track propio y dedicado para la ficha grande, no un fix rápido.
17. **`/admin/libro-de-clases` + `/secretaria/libro-de-clases`** — el más costoso: exige
    reestructurar 6 secciones secuenciales en tabs antes de que el fill-screen tenga sentido.
    Conviene combinarlo con la resolución del bug de skeleton gap ya documentado (fix-074) para
    no tocar el componente dos veces.
