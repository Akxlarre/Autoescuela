# Fix: App-like — `/instructor/alumnos/:id/ficha` reestructurada en tabs (piloto ASG-b-084)
> id: fix-027-i-app-like-instructor-ficha-tabs
> refs: ASG-b-084
> status: done
> created: 2026-08-17

## Root Cause
[Heredado de ASG-b-084, corregido tras lectura del código real]: `InstructorFichaComponent`
(543 líneas) no sigue el patrón app-like — todo el contenido queda apilado en una sola columna
larga que crece sin límite (grid de 2 cards + tabla completa de clases prácticas + nota), sin
scroll interno independiente. Es el piloto de bajo riesgo del rollout app-like antes de aplicar
el mismo patrón a la ficha grande de admin/secretaria (ASG-b-085, 1654 líneas, máximo tráfico).

**Corrección de alcance vs. la ASG original:** la ASG describía "4 `.bento-banner` secuenciales
+ un `.bento-grid` anidado". Lectura completa del archivo confirma que esos 4 `.bento-banner`
son en realidad ramas mutuamente excluyentes de un `@if/@else if` (error / sin datos / cargando
/ cargado) — nunca coexisten. Una vez cargada la ficha hay **un solo** `.bento-banner` de
contenido real, con dos bloques lógicos internos (confirmado también visualmente con el
usuario): (1) grid de 2 cards (Info Personal + Progreso Clases Prácticas), (2) tabla "Ficha
Técnica — Clases Prácticas" + nota informativa. No hay `.bento-grid` anidado (es `flex flex-col
gap-6`). El alcance real es **2 tabs**, no 4.

## Decisiones de negocio (confirmadas con el usuario, 2026-08-17)
1. Reestructurar en 2 tabs: **"Datos"** (grid de 2 cards) y **"Ficha Técnica"** (tabla de clases
   + nota informativa).
2. El botón "Evaluar"/"Ver detalles" sigue navegando a la página de evaluación tal cual (sin
   cambios) — el usuario pidió cambiar eso a un Drawer, pero se separó a **ASG-b-093** (fuera de
   alcance de este fix) porque no hay asignación previa que lo cubra y es una decisión de UX
   distinta a la reestructuración app-like.
3. El Hero queda fuera de los tabs, siempre visible arriba (mismo criterio que Asistencia B).

## ACs Afectados
Ninguno — fix autónomo (rollout app-like, sin spec propia).

## Cambio
1. `InstructorFichaComponent`: agrega `TabsComponent` (`app-tabs`, `variant="segmented"`,
   mismo patrón que `AdminContabilidadAnticiposComponent`) con 2 tabs: `datos` y
   `ficha-tecnica`. Signal `activeTab = signal<'datos' | 'ficha-tecnica'>('datos')`.
2. El `.bento-banner` único de contenido se reemplaza por: `<app-tabs class="bento-banner" ...
   />` + un panel `.bento-banner.bento-fill.flex.flex-col.h-full` con `@switch (activeTab())`
   que renderiza el bloque de cards en `@case ('datos')` y la tabla+nota en
   `@case ('ficha-tecnica')`.
3. El root `.bento-grid` gana el modificador `--fill-screen` (o el que corresponda tras medir
   en `/verify`) para que el panel activo scrollee internamente en vez de la página completa.
4. Ninguna funcionalidad existente se pierde: los botones Evaluar/Ver/Ver Detalles del `@for`
   de `fichaTecnica` se mueven tal cual dentro del nuevo `@case ('ficha-tecnica')`.

## Test de Regresión
- No hay lógica nueva de negocio (solo reestructuración visual) — sin `.spec.ts` nuevo,
  consistente con la doctrina TDD del proyecto (Dumb/Smart sin `computed()` de negocio nuevo).
- `/verify` — cambiar entre tabs conserva los datos cargados (no re-fetch); tabla de clases
  prácticas totalmente funcional en el tab "Ficha Técnica" (Evaluar/Ver siguen navegando
  igual); `force-compact` con drawer abierto; 390×844, 1440×900 y 768 de alto; modo claro/oscuro.

## Archivos involucrados
- `src/app/features/instructor/ficha/instructor-ficha.component.ts`

## Resultado
`npm run test:ci`: 2088/2093 (5 skipped pre-existentes, sin regresiones). `npm run lint:arch`:
0 errores. `npx ng build`: limpio (solo warning de bundle budget, pre-existente).

`/verify` (Playwright, instructor, `/app/instructor/alumnos/115/ficha`):
- **1440×900:** grid mide `780px` de alto, filas `62px 40px 574px` (Hero/Tabs/Panel), panel
  `.bento-fill` con `contain:size` activo — confirmado con `getComputedStyle`. Tab "Datos"
  renderiza el grid de 2 cards; tab "Ficha Técnica" scrollea internamente (tabla
  `scrollHeight=831` vs `clientHeight=309`) mientras la nota informativa queda anclada abajo,
  siempre visible. La página (`document.documentElement`) NO scrollea — solo el panel interno.
- **390×844 (mobile):** vuelve a layout apilado normal, sin fill-screen (confirmado:
  `.bento-fill` no recibe `contain:size` bajo `lg`). El scroll real vive en `.shell-content`
  (contenedor del shell, no `document.body`) — verificado con `shell.scrollHeight=3206 >
  shell.clientHeight=768`. Tab "Ficha Técnica" en vista mobile (cards) confirmado
  scrolleando manualmente: se ven las 12 clases con sus badges de estado y CTAs correctos.
- **768 de alto:** panel se comprime y sigue scrolleando internamente sin desbordar ni cortar
  la nota informativa.
- **Modo oscuro:** contraste correcto en tabs, tabla, badges y alert-card informativo.
- **Funcionalidad preservada:** los links "Evaluar"/"Ver" de la tabla mantienen sus
  `routerLink` a `/app/instructor/alumnos/:id/evaluacion/:sessionId` intactos (verificado con
  snapshot de accesibilidad — hrefs correctos en ambas filas evaluadas).
- **`force-compact`:** cableado con el mismo binding `[class.force-compact]="drawer.isOpen()"`
  ya probado en `AdminContabilidadAnticiposComponent` — esta página no abre ningún drawer
  propio, así que no hay un trigger end-to-end dentro de la misma vista para forzarlo
  manualmente, pero el mecanismo es idéntico al de producción.

**Nota para ASG-b-085 (ficha grande, siguiente pieza del rollout):** el patrón replicado fue
`<app-tabs class="bento-banner" [tabs]="..." [activeId]="activeTab()" variant="segmented"
(activeIdChange)="setActiveTab($event)" />` seguido de un único panel
`.bento-banner.bento-fill.card.p-0.overflow-hidden.flex.flex-col.h-full` con `@switch
(activeTab())`. Ojo con los `@if (facade.detailLoading()) {...} @else if (studentDetail(); as
detail) {...}` — Angular no permite reusar un `as detail` bindeado en un bloque hermano
anterior, hay que re-bindearlo dentro de cada `@case` que lo necesite (aparece 2 veces en este
archivo, aparecerá más veces en la ficha grande si tiene más de 2 tabs).

**Ajuste post-QA #1 (feedback visual del usuario):** el tab "Datos" (solo 2 cards cortas) se
veía pegado arriba con un hueco vacío grande abajo, al forzar el panel a llenar toda la altura
disponible. Se agregó una clase `.ficha-datos-panel` con `display:flex; flex-direction:column;
justify-content:center` gateada tras `@container layoutmain (min-width: 1024px)` (mismo
mecanismo que ya usa este archivo para `.ficha-table-desktop/mobile`) para centrar
verticalmente las cards SOLO en desktop — mismo criterio que ya aplica el DS a
empty-states/skeletons dentro de un `.bento-fill` corto. El tab "Ficha Técnica" no lo necesita
porque su contenido sí llena naturalmente el espacio.

**Ajuste post-QA #2 (feedback visual del usuario, mobile):** el fix #1 aplicado sin gate de
breakpoint (con utilities Tailwind `flex flex-col justify-center` planas) también centraba en
mobile, donde el panel no tiene alto forzado — eso desplazaba el contenido hacia abajo y dejaba
el hueco arriba en vez de abajo (motivo del gate por `@container` de arriba). Pero además,
independiente del centrado, apareció un segundo hueco real: en mobile `.bento-grid` usa
`grid-auto-rows: minmax(var(--bento-row-min), ...)` con `--bento-row-min: 120px` — la fila de
`<app-tabs>` (¬50px de contenido real) quedaba forzada a 120px mínimo, dejando ~90px de espacio
vacío debajo de la barra de tabs (mismo síntoma ya documentado y resuelto en `fix-081` para
"barra de filtros de una sola línea"). Se agregó el modificador `.bento-grid--rows-fit`
(`grid-auto-rows: auto`, sin el piso de 120px) junto a `--fill-screen-kpi` en el grid raíz —
mismo combo ya usado en `AlumnoHorarioComponent`. Verificado que el fill-screen de desktop
sigue intacto (`grid-template-rows: 62px 40px 574px`, `contain:size` activo) porque
`--fill-screen-kpi` define `grid-template-rows` explícito solo bajo `@container (min-width:
1024px)`, que tiene prioridad sobre `grid-auto-rows` — `--rows-fit` solo afecta breakpoints
donde no hay `grid-template-rows` explícito (mobile).
