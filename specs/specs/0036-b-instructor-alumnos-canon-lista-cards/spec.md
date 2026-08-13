# Spec 0036-b — "Mis Alumnos" (instructor) alineado al canon de Base Alumnos

> **Status:** done
> **Created:** 2026-08-12
> **Closed:** 2026-08-12
> **Owner:** b
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** QA manual del owner post-cierre de fix-139-b (ASG-b-078, rollout app-like
portal instructor), sesión 2026-08-11/12.

**Persona afectada:** Instructor.

**Problema que resuelve:**
`InstructorAlumnosComponent` (`/instructor/alumnos`) usa un `.bento-grid` propio de cards
siempre-cards, con densidad adaptativa recién agregada en fix-139-b (`sliceByBudget` +
"Cargar más"). El canon real del proyecto para listados de alumnos — usado en
`alumnos-list-content.component.ts` (Base Alumnos, admin/secretaria) — es un **dual
viewport**: tabla real (`<table>`) en desktop + cards apiladas en mobile/tablet, con
`container-type: inline-size` propio (no depende del tier global de `LayoutService`) y
clases `dual-viewport-container` / `hide-on-squeeze` / `show-on-squeeze`. El owner señaló
en QA que "Mis Alumnos" "difiere muchísimo del canon" frente a "Base Alumnos".

**Hipótesis de valor:**
Un instructor con muchos alumnos gana densidad de información real en desktop (tabla
escaneable con más alumnos visibles a la vez) en vez de cards grandes que desperdician
espacio horizontal; y se elimina una implementación de listado más para mantener (menos
superficie de deriva visual entre "Base Alumnos" y "Mis Alumnos").

---

## 2. User Stories

- **US1**: Como instructor con muchos alumnos asignados, quiero ver una tabla densa en
  desktop para encontrar y comparar alumnos rápido, en vez de scrollear cards grandes.
- **US2**: Como instructor en mobile, quiero seguir viendo cards (ya funciona hoy) — no
  perder la experiencia táctil actual en pantallas chicas.
- **US3**: Como instructor, quiero que "Ficha", buscador, filtros por estado y orden sigan
  funcionando igual que hoy, solo con el layout renovado.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given un instructor con 15+ alumnos en desktop (≥1024px), When abre
  `/instructor/alumnos`, Then ve una `<table>` con columnas Nombre/RUT/Curso/Progreso/
  Próxima clase/Acciones, con scroll interno (`.bento-fill`, patrón ya aplicado en
  fix-139-b), sin paginar (todos visibles + scroll).
- **AC2**: Given el mismo instructor en mobile/tablet (<1024px, o `<main>` angostado por
  drawer), When ve la misma ruta, Then ve cards apiladas con `sliceByBudget` + "Cargar
  más" — el comportamiento que fix-139-b ya implementó, sin regresión.
- **AC3**: Given el buscador ("nombre o RUT"), los 3 filtros de estado (Todos/Activos/
  Completados) y el sort (Nombre A-Z/Mayor Progreso/Próxima Clase), When se usan en la
  vista tabla, Then filtran/ordenan igual que en la vista cards (misma fuente
  `filteredStudents()`).
- **AC4**: Given un click en una fila de la tabla o en una card, When se activa, Then abre
  el mismo drawer `StudentDrawerDetailComponent` que hoy (sin cambios de comportamiento).
- **AC5**: Given el switch tabla↔cards, When el contenedor se angosta (`dual-viewport-
  container` + `@container`), Then el corte ocurre por ancho de contenedor (no viewport
  global) — mismo mecanismo que `alumnos-list-content`/`admin-instructores`.

### Edge cases obligatorios

- **AC-E1**: Given 0 alumnos totales, When se aplica el filtro/búsqueda, Then el
  empty-state actual (`app-empty-state` con "No se encontraron alumnos") se mantiene
  intacto en ambas vistas.
- **AC-E2**: Given un alumno sin `nextClassDate`, When se renderiza en la tabla, Then
  muestra "Sin agendar" igual que hoy en las cards (no debe romper el sort por
  "Próxima Clase", que ya maneja `null` al final).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Cambiar el modelo de datos (`InstructorStudentCard`) o el Facade
  (`InstructorAlumnosFacade`) — este spec es solo de presentación/layout.
- ❌ Extraer un componente `shared/` reutilizable entre "Base Alumnos" y "Mis Alumnos"
  (los modelos de datos son distintos — `AlumnoTableRow` vs `InstructorStudentCard` — y
  columnas/acciones difieren). Evaluar extracción en una spec futura SI surge una 3ª
  consumidora con el mismo patrón exacto — no se justifica una abstracción para 2.
  precedente: `secretaria-instructores` duplica el patrón de `admin-instructores` en vez
  de compartir componente, por la misma razón.
- ❌ Tocar `/instructor/alumnos/:id/evaluacion/:sessionId` (ver spec 0037-b, decisión
  separada) ni `/instructor/alumnos/:id/ficha`.
- ❌ Agregar columnas o datos que no existen hoy en `InstructorStudentCard` (ej. teléfono
  visible en tabla — el modelo lo tiene pero las cards actuales no lo muestran; decidir en
  `plan.md` si se agrega o se mantiene paridad exacta con las cards de hoy).

---

## 5. Dependencias

### Specs previas
- fix-139-b-app-like-portal-instructor-resto (`done`) — ya dejó `--fill-screen` +
  `sliceByBudget`/`mobileShown`/`maxVisible` funcionando en esta misma página; este spec
  los reutiliza, no los reemplaza.

### Capacidades del proyecto que se asumen existentes
- Patrón dual-viewport ya implementado 6+ veces (`alumnos-list-content`,
  `admin-instructores`, `secretaria-instructores`, `flota-list-content`, etc.) — copiar el
  patrón probado, no inventar uno nuevo.
- `InstructorAlumnosFacade.students()`/`kpis()` sin cambios.

### Capacidades nuevas requeridas
- Ninguna (es un refactor de presentación sobre datos y facade existentes).

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno — reutiliza `InstructorStudentCard`.
- RLS requerida: ninguna (sin cambios de acceso a datos).

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): `/instructor/alumnos` únicamente.
- Flujo principal (happy path): desktop → tabla densa con scroll interno; mobile/tablet →
  cards con "Cargar más" (sin cambios de comportamiento, solo de layout desktop).
- Estados especiales: loading (skeleton ya existe, adaptar a fila de tabla en vez de
  cards cuando corresponda), vacío (sin cambios), error (el facade no expone `error()`
  hoy para esta ruta — verificar en `plan.md` si hace falta agregarlo o si ya se maneja
  aguas arriba).

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- N/A — spec interna de consistencia de Design System, sin métrica de producto directa.

---

## 9. Notas / decisiones abiertas

- [ ] ¿La tabla desktop muestra teléfono/email (datos ya en el modelo pero no en las
      cards actuales) o mantiene paridad exacta con lo que se ve hoy? Definir en
      `/spec-plan`.
- [ ] ¿El botón "Ficha" de la card se traduce a una columna "Acciones" en la tabla, o el
      click en la fila entera abre el drawer (como ya hace la card completa)? Definir
      antes de implementar — impacta AC4.
- Originado de QA manual post-cierre de fix-139-b (sesión 2026-08-11/12), no de una
  Asignación (`ASG-`) formal — si el equipo quiere trackearlo en el tablero, correr
  `/assign-new` con este contexto antes de `/spec-activate`.

---

## Changelog

- 2026-08-12 — draft inicial por b, a partir de hallazgo de QA visual del owner.
