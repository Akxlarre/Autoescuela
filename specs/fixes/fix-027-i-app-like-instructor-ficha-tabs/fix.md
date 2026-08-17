# Fix: App-like — `/instructor/alumnos/:id/ficha` reestructurada en tabs (piloto ASG-b-084)
> id: fix-027-i-app-like-instructor-ficha-tabs
> refs: ASG-b-084
> status: active
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
   cambios) — el usuario pidió cambiar eso a un Drawer, pero se separó a **ASG-b-092** (fuera de
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
_Pendiente._
