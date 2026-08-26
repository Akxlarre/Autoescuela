# Spec 0005-i — App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases`

> **Status:** draft
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

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US3**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC3**: …

### Edge cases obligatorios

- **AC-E1**: Given {{caso límite}}, When …, Then …
- **AC-E2**: …

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
- Ninguna prevista — trabajo de layout puro sobre el componente `shared` existente.

---

## 6. Datos y modelo (preliminar)

> No aplica — spec de layout, sin persistencia nueva.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/admin/libro-de-clases`, `/secretaria/libro-de-clases` (mismo
  componente `shared`, 2 rutas consumidoras).
- Flujo principal (happy path): usuario selecciona promoción+curso → cargan las 7 secciones →
  navega entre ellas por el subnav → cada sección ocupa el alto disponible sin hacer scrollear el
  documento, con su propio scroll interno si el contenido excede el alto.
- Estados especiales (loading, error, vacío): ya resueltos por fix-074 — verificar que la
  conversión a fill-screen no los rompa (checklist de cierre de la ASG).

---

## 8. Métricas de éxito post-launch

- N/A — spec interna de rollout, sin métrica de negocio directa.

---

## 9. Notas / decisiones abiertas

- [ ] Confirmar en `/spec-plan` si las 7 secciones necesitan `.spec.ts` nuevo para alguna lógica
      de densidad, o si al ser layout puro (sin `sliceByBudget`/`maxVisible`) no aplica.
- [ ] Checklist de cierre heredado de la ASG (además de lo normal de una spec):
      - [ ] `force-compact` verificado con drawer abierto
      - [ ] `/verify` en AMBAS rutas (admin y secretaria), 390×844, 1440×900 y 768 de alto, en
            CADA una de las 7 secciones
      - [ ] Ninguna de las 7 secciones perdió funcionalidad al pasar a fill-screen
- Originado de Asignación ASG-b-086 (specs/assignments/ASG-b-086-app-like-libro-de-clases.md).

---

## Changelog

- 2026-08-26 — draft inicial por i, reclamado desde ASG-b-086. Contexto corregido tras leer el
  código real: subnav ya es show/hide (no scroll-to-anchor) y fix-074 ya está resuelto — ambos
  puntos que la ASG daba como pendientes.
