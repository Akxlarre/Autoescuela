# Spec 0005-i — App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases`

> **Status:** approved
> **Created:** 2026-08-26
> **Owner:** i
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-b-086` (specs/assignments/ASG-b-086-app-like-libro-de-clases.md),
último paso (17) del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`).

**Persona afectada:** Admin y Secretaria (componente `shared`, mismas 2 rutas consumidoras).

**Problema que resuelve:**
`LibroDeClasesComponent` (874 líneas, `src/app/features/libro-de-clases/libro-de-clases.component.ts`)
tiene 7 secciones (`cabecera`, `profesores`, `alumnos`, `asistencia`, `calendario`, `evaluaciones`,
`resumen`) navegadas por `<app-libro-de-clases-subnav>`. El root usa `<div class="bento-grid"
appBentoGridLayout>` **sin ningún modificador `--fill-screen`** — la página no sigue el patrón
app-like del resto del rollout (documento no ocupa 100vh en desktop, sin scroll interno por
sección).

**Corrección sobre el contexto heredado de la ASG (confirmada con el owner el 2026-08-26,
verificando el código real antes de generar esta spec):**
1. La ASG asumía que el subnav podía estar haciendo *scroll-to-anchor* en vez de *show/hide*
   real — **falso**: el componente ya usa `@if (activeSection() === 'x') { ... }` por sección
   (líneas 195, 292, 322, 369, 451, 492, 558 de `libro-de-clases.component.ts`). Solo se ve una
   sección a la vez, ya sin necesidad de convertir nada — el trabajo real es envolver la sección
   activa en `.bento-fill` para que ocupe el alto disponible con scroll interno, no cambiar su
   mecanismo de visibilidad.
2. La ASG pedía resolver el bug de skeleton gap (fix-074) "en el mismo track" — **ya resuelto**:
   `fix-074-b-skeletons-agenda-libro-clases` (commit `4df36216`, "cerrar gap de skeleton vacío en
   Libro de Clases (H-007)") ya está en el código — ver el comentario explicativo en
   `libro-de-clases.component.ts:108-112` (unión de `isLoading()` + `isLoadingSections()`). No
   forma parte del alcance de esta spec.

**Hipótesis de valor:**
Alinear la última página pendiente del rollout con el resto del patrón app-like — documento sin
scroll en desktop, cada sección con su propio scroll interno acotado a la altura disponible.

---

## 2. User Stories

- **US1**: Como admin/secretaria, quiero que el Libro de Clases ocupe toda la pantalla sin que
  el documento scrollee, para que se sienta como el resto de las páginas app-like ya migradas.
- **US2**: Como admin/secretaria, quiero que la sección "Control de Asistencia (Firma Diaria)"
  esté paginada por semana en vez de mostrar todas las semanas apiladas, para no tener que
  scrollear una tabla interminable cuando el curso lleva muchas semanas.
- **US3**: Como admin/secretaria, quiero que la sección "Calendario de Clases" tenga el mismo
  tratamiento app-like que el resto (scroll interno acotado, no scroll de documento), porque hoy
  es la única que ni siquiera tiene un `overflow` acotado — crece libremente con la página.
- **US4**: Como admin/secretaria, quiero que las 7 secciones se comporten de forma **consistente**
  entre sí — si una tabla crece mucho (muchos alumnos, muchas evaluaciones, muchas semanas), el
  comportamiento de scroll/paginación debe sentirse igual en todas, no distinto sección por
  sección.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

**Contexto verificado en el código antes de escribir estos AC:** las 7 secciones
(`cabecera`, `profesores`, `alumnos`, `asistencia`, `calendario`, `evaluaciones`, `resumen`)
siguen HOY el mismo patrón sin excepción — `<section class="bento-banner card p-6">` con una
tabla en `overflow-x-auto` (solo scroll horizontal), sin `.bento-fill`, sin tope de alto, sin
scroll vertical interno. El documento completo crece con el contenido. Ninguna sección pagina
nada. Esto confirma la US4: el problema es uniforme en las 7, no una excepción a corregir.

- **AC1**: Given el usuario abre `/admin/libro-de-clases` o `/secretaria/libro-de-clases` en
  desktop (≥1024px), When la página termina de cargar, Then el documento **no scrollea**
  (`document.scrollHeight <= document.clientHeight`) — el shell sigue el patrón
  `bento-grid--fill-screen*` como el resto de páginas migradas del rollout.
- **AC2**: Given cualquiera de las 7 secciones está activa, When su contenido (tabla) excede el
  alto disponible, Then el scroll ocurre **dentro de la card de la sección** (`.bento-fill` con
  `overflow-y-auto`), nunca en el documento — verificado con `getBoundingClientRect`/
  `scrollHeight` de la card, no solo a simple vista.
- **AC3**: Given la sección "Control de Asistencia (Firma Diaria)" tiene 2+ semanas de datos,
  When el usuario la abre, Then ve **una semana a la vez con paginación** (ej. `p-paginator` o
  patrón equivalente ya usado en el proyecto — ver `indices/COMPONENTS.md`), no todas las
  semanas apiladas verticalmente como hoy.
- **AC4**: Given la sección "Calendario de Clases" tiene una lista larga de clases, When el
  usuario la abre, Then la tabla scrollea internamente dentro de su card (mismo tratamiento que
  el resto), en vez de crecer libremente con la página como hoy (única sección sin ningún tope).
- **AC5**: Given las 7 secciones ya migradas, When se comparan entre sí con contenido que excede
  el alto disponible, Then el comportamiento (dónde scrollea, cómo se ve el scrollbar, si pagina
  o no) es **consistente** — mismo criterio de "cuándo paginar vs. cuándo solo permitir scroll
  interno" aplicado por igual, no una solución ad-hoc por sección.

### Edge cases obligatorios

- **AC-E1**: Given otro drawer está abierto encima (ej. desde una acción dentro de una sección),
  When el drawer angosta `<main>`, Then el layout aplica `force-compact` igual que el resto de
  páginas del rollout — verificado con el drawer realmente abierto, no solo el modificador CSS
  presente.
- **AC-E2**: Given el viewport es mobile (<640px), When el usuario navega el Libro de Clases,
  Then el documento vuelve a scroll nativo (sin fill-screen forzado) y el subnav/paginación de
  Asistencia siguen siendo usables sin recortes.
- **AC-E3**: Given una sección tiene pocos datos (ej. 1 semana de asistencia, 3 clases en el
  calendario), When se muestra, Then NO aparece scrollbar interno innecesario ni espacio vacío
  forzado — el `.bento-fill` no debe verse "hueco" cuando el contenido es corto (ver
  `visual-system.md` §Patrón App-like sobre estados vacíos/skeletons dentro de `.bento-fill`).
- **AC-E4**: Given la altura de viewport es baja (768px), When se navega por las 7 secciones,
  Then ninguna queda inutilizable — headers de tabla, paginador de Asistencia y acciones siguen
  visibles/alcanzables.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Fix del skeleton gap (fix-074) — ya resuelto, no forma parte de este track.
- ❌ Rediseño del mecanismo de navegación del subnav (ya es show/hide real, no scroll-to-anchor).
- ❌ {{otra cosa que NO va}}

---

## 5. Dependencias

### Specs previas
- Ninguna formal — es el último paso (17) del rollout app-like (`ASG-b-065` a `ASG-b-086`), no
  depende técnicamente de las anteriores pero comparte el mismo patrón/checklist de cierre.

### Capacidades del proyecto que se asumen existentes
- `BentoGridLayoutDirective` + modificadores `--fill-screen*` (`src/styles/layout/_bento-grid.scss`).
- `app-libro-de-clases-subnav` (`shared/components/libro-de-clases-subnav/`) — ya resuelve la
  navegación entre secciones vía `activeId`/`sectionChange`.
- `LibroDeClasesFacade` — sin cambios de estado previstos (solo layout/CSS).

### Capacidades nuevas requeridas
- **Paginación de "Asistencia (Firma Diaria)" por semana** — hoy `facade.asistenciaSemanal()`
  expone todas las semanas en un array y el template las itera todas con `@for`. Se necesita
  un signal de índice de semana activa (ej. `selectedWeekIndex`) en el componente (estado de UI
  puro, no requiere tocar el Facade si el dato ya viene completo) + control de paginación
  (`p-paginator` u otro patrón ya usado en el proyecto — revisar `indices/COMPONENTS.md` antes
  de decidir cuál).

---

## 6. Datos y modelo (preliminar)

> No aplica — spec de layout, sin persistencia nueva.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/admin/libro-de-clases`, `/secretaria/libro-de-clases` (mismo
  componente `shared`, 2 rutas consumidoras).
- Flujo principal (happy path): usuario selecciona promoción+curso → cargan las 7 secciones →
  navega entre ellas por el subnav → cada sección ocupa el alto disponible sin hacer scrollear el
  documento, con su propio scroll interno si el contenido excede el alto. En "Asistencia" navega
  además entre semanas con el paginador, en vez de scrollear una lista de semanas apiladas.
- Estados especiales (loading, error, vacío): ya resueltos por fix-074 — verificar que la
  conversión a fill-screen no los rompa (checklist de cierre de la ASG).

---

## 8. Métricas de éxito post-launch

- N/A — spec interna de rollout, sin métrica de negocio directa.

---

## 9. Notas / decisiones abiertas

- [x] Confirmado con el owner (2026-08-26): las 7 secciones necesitan el mismo tratamiento
      fill-screen sin excepción, "Asistencia (Firma Diaria)" necesita paginación por semana en
      vez de listar todas apiladas, y "Calendario de Clases" es la que más urge por no tener hoy
      NI SIQUIERA un `overflow` acotado (crece libre con el documento).
- [ ] Confirmar en `/spec-plan` si las 7 secciones necesitan `.spec.ts` nuevo para alguna lógica
      de densidad, o si al ser layout puro (sin `sliceByBudget`/`maxVisible`) no aplica —
      **excepto** la paginación por semana de Asistencia, que si usa `computed()` para derivar
      "semana visible" de un índice sí necesita test (regla de `.claude/rules/testing-tdd.md`
      §"testea decisiones, no bindings").
- [ ] Checklist de cierre heredado de la ASG (además de lo normal de una spec):
      - [ ] `force-compact` verificado con drawer abierto
      - [ ] `/verify` en AMBAS rutas (admin y secretaria), 390×844, 1440×900 y 768 de alto, en
            CADA una de las 7 secciones
      - [ ] Ninguna de las 7 secciones perdió funcionalidad al pasar a fill-screen
      - [ ] Paginación de Asistencia probada con 1 semana (sin paginador visible o deshabilitado)
            y con varias semanas (paginador funcional, semana correcta se muestra)
- Originado de Asignación ASG-b-086 (specs/assignments/ASG-b-086-app-like-libro-de-clases.md).

---

## Changelog

- 2026-08-26 — draft inicial por i, reclamado desde ASG-b-086. Contexto corregido tras leer el
  código real: subnav ya es show/hide (no scroll-to-anchor) y fix-074 ya está resuelto — ambos
  puntos que la ASG daba como pendientes.
- 2026-08-26 — User Stories y AC completados con feedback directo del owner tras revisar el
  código real de las 7 secciones (todas comparten hoy el mismo patrón sin fill-screen, sin
  scroll interno, sin paginación). Agregado AC3 (paginación de Asistencia por semana), AC4
  (Calendario necesita el mismo tratamiento — es la sección más atrasada, sin ningún tope de
  alto hoy) y AC5 (consistencia entre las 7). Nueva capacidad requerida: signal de semana activa
  + control de paginación para Asistencia.
