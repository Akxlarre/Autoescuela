# Spec 0007-i — Consolidar Ex-Alumnos Clase B en un `*-content` compartido

> **Status:** draft
> **Created:** 2026-08-31
> **Owner:** i
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación de equipo `ASG-b-096` (`specs/assignments/ASG-b-096-ex-alumnos-b-content-unificado.md`), detectada por Benjamín al implementar la spec `0038-b`.

**Persona afectada:** Admin y Secretaria (ambos consumen la misma vista de Ex-Alumnos Clase B, hoy duplicada por rol).

**Problema que resuelve:**
`admin-ex-alumnos.component.ts` (622 líneas) y `secretaria-ex-alumnos.component.ts` (603
líneas) son ~93% código idéntico — un `diff` ignorando espacios da solo 77 líneas
distintas, y de esas la mayoría es formato. Las 4 diferencias reales son triviales
(selector, `basePath` de los `routerLink`, inyección de `BranchFacade` solo en admin, e
imports de drawers que secretaría alcanza por ruta relativa hacia la carpeta de admin —
señal de que ninguno de los dos es el dueño real de esos drawers). Hoy **todo cambio en
Ex-Alumnos B hay que hacerlo dos veces**, y cada vez que alguien lo hace una sola vez las
páginas divergen un poco más — la spec `0038-b` es el ejemplo en vivo de ese costo: agregó
el selector de período **duplicado a propósito** porque no había un componente compartido
donde ponerlo sin bloquear una P1.

**Hipótesis de valor:** Un solo componente compartido (`app-ex-alumnos-content`, precedente
ya validado en `0032-b-pre-inscritos-content-fill-screen`) elimina la duplicación futura —
cualquier cambio a Ex-Alumnos B se hace una sola vez, en un solo lugar.

---

## 2. User Stories

- **US1**: Como desarrollador, quiero un único `app-ex-alumnos-content` compartido para no
  tener que replicar cada cambio en dos archivos casi idénticos.
- **US2**: Como Admin, quiero seguir viendo el filtro de sede (`BranchFacade`) en mi vista
  de Ex-Alumnos B, sin que la consolidación se lo lleve por delante.
- **US3**: Como Secretaria, quiero que mis `routerLink` sigan apuntando a
  `/app/secretaria/alumnos/:id` (no a los de admin) después de la consolidación.
- **US4**: Como desarrollador, quiero que los drawers de Tasas y Comentarios vivan en un
  lugar que refleje que son compartidos, no importados por ruta relativa hacia la carpeta
  de otro portal.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un Admin navega a `/app/admin/ex-alumnos`, When la página carga, Then ve
  la misma tabla/buscador/filtros/KPIs que veía antes de la consolidación, con datos reales
  de `ExAlumnosFacade`.
- **AC2**: Given una Secretaria navega a `/app/secretaria/ex-alumnos`, When la página carga,
  Then ve la misma tabla/buscador/filtros/KPIs que veía antes, con `routerLink` apuntando a
  `/app/secretaria/alumnos/:id` (no a `/app/admin/...`).
- **AC3**: Given un Admin cambia de sede en el selector global, When el cambio se propaga,
  Then la lista de egresados se refiltra igual que antes de la consolidación (el `effect()`
  de `BranchFacade` sigue funcionando, ahora orquestado desde el Smart Component admin).
- **AC4**: Given una Secretaria (sin selector de sede), When abre Ex-Alumnos B, Then no se
  dispara ninguna lógica de cambio de sede ni se rompe la carga por su ausencia.
- **AC5**: Given cualquiera de los dos roles abre el drawer de "Tasas" o "Comentarios" de un
  egresado, When el drawer se abre, Then funciona igual que antes (mismos datos, misma
  interacción), ahora sirviéndose desde `shared/components/ex-alumnos-content/drawers/`.
- **AC6**: Given el selector de período (`app-period-selector`, agregado en `0038-b`), When
  se usa en cualquiera de los dos portales, Then su comportamiento (signal `periodWindow`,
  `computed hasActiveSearch`, `applyPeriodWindow()`) es idéntico al que tenía duplicado
  antes de la consolidación — se **absorbe**, no se reimplementa.

### Edge cases obligatorios

- **AC-E1**: Given un egresado con `branchId === null`, When el Admin hace clic en su fila
  (selección de sede automática), Then no se dispara `branchFacade.selectBranch()` (mismo
  guard que existe hoy).
- **AC-E2**: Given ambos portales corriendo, When se audita el árbol de imports, Then
  ninguno de los dos importa un drawer por ruta relativa hacia la carpeta del otro portal.

---

## 4. Out of scope

- ❌ Cambiar el comportamiento del selector de período o su lógica (`0038-b` ya cerrada) —
  solo se mueve/absorbe, no se rediseña.
- ❌ Aplicar app-like/fill-screen — se evalúa como oportunidad, no como requisito; si infla
  el track se documenta como asignación aparte.
- ❌ Tocar `ExAlumnosFacade` — ya es compartida entre ambos portales, no requiere cambios
  para esta consolidación.
- ❌ Rediseñar el contenido/UX de los drawers de Tasas o Comentarios — solo se relocalizan.

---

## 5. Dependencias

### Specs previas
- `0032-b-pre-inscritos-content-fill-screen` (patrón de referencia, ya `done`).
- `0038-b-filtro-periodo-listas-sin-techo` (ya `done` — dejó el selector de período
  duplicado a propósito, que esta spec absorbe).

### Capacidades del proyecto que se asumen existentes
- `ExAlumnosFacade` (ya compartida por ambos portales).
- `BranchFacade` (para el filtro de sede, solo lado admin).
- `LayoutDrawerFacadeService` (apertura de los drawers de Tasas/Comentarios).
- Patrón `basePath = input<string>(...)` (precedente en `alumnos-list-content`,
  `alumnos-profesional-list-content`, `flota-list-content`, `dms-list-content`).
- Patrón de drawers hermanos en `shared/components/<x>-content/drawers/` (precedente:
  `servicios-especiales-content/drawers/`).

### Capacidades nuevas requeridas
- Ninguna — es una extracción/consolidación, no una feature de negocio nueva.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno (se reutilizan los tipos ya expuestos por `ExAlumnosFacade`).
- RLS requerida: sin cambios.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/app/admin/ex-alumnos`, `/app/secretaria/ex-alumnos`.
- Flujo principal (happy path): sin cambios visibles para el usuario final — es una
  extracción interna, no un rediseño.
- Estados especiales (loading, error, vacío): deben preservarse 1:1 respecto al
  comportamiento actual de cada Smart Component.

---

## 8. Métricas de éxito post-launch

- Reducción de líneas duplicadas: de ~573 líneas idénticas a 0 (queda 1 sola fuente de
  verdad en `app-ex-alumnos-content`).
- Próximo cambio a Ex-Alumnos B se hace en 1 archivo, no en 2.

---

## 9. Notas / decisiones abiertas

- [ ] Confirmar nombres exactos de inputs/outputs al planificar (`plan.md`) — propuesta
  inicial discutida con el owner: `egresados`, `isLoading`, `basePath`,
  `showBranchFilter` (o equivalente), outputs para abrir los 2 drawers.
- [ ] Decidir si el `effect()` de `BranchFacade` se queda enteramente en
  `AdminExAlumnosComponent` (Smart) o si se expone como output que el Smart escucha —
  ambas opciones respetan `facades.md` (prohibido `effect()` para auto-recargar dentro de
  una Facade branch-scoped, pero esto es un componente Dumb/Smart, no una Facade — definir
  en `plan.md`).
- Originada de Asignación ASG-b-096 (specs/assignments/ASG-b-096-ex-alumnos-b-content-unificado.md).

---

## Changelog

- 2026-08-31 — draft inicial por i, vía /assign-claim de ASG-b-096
