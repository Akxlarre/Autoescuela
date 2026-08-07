# Spec 0005 — Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede

> **Status:** done
> **Created:** 2026-08-05
> **Closed:** 2026-08-05
> **Owner:** m
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-064 (`specs/assignments/ASG-b-064-facades-sin-guard-respuesta-stale.md`), detectada en la misma auditoría "qué pasa si un usuario usa la app de la peor forma posible" que originó ASG-b-063.

**Problema que resuelve:**
Ninguno de los Facades del proyecto (grep en `core/` de `AbortController`, `requestId`/
`requestToken`, `switchMap`, `debounceTime` — cero resultados salvo un `AbortController` de
timeout en `libro-de-clases.facade.ts:674`, que no es esto) protege contra respuestas
"out-of-order": si un usuario cambia de sede, rango de fechas o filtro dos veces seguidas y la
primera consulta (a la sede/filtro viejo) tarda más en responder que la segunda, el resultado
que gana en pantalla es el **viejo** — sin error, sin indicio visual de que los datos no
corresponden al filtro actualmente seleccionado.

Es fácil de gatillar: `BranchFacade.selectedBranchId()` dispara recargas vía `effect()` en
cada Facade branch-scoped (`AdminAlumnosFacade`, `DashboardFacade`, `FlotaFacade`, etc. — ver
`.claude/rules/facades.md` §7), así que un usuario "clickeando rápido" el selector de sede en
el topbar ya alcanza para reproducirlo, sin necesidad de red lenta artificial (aunque en red
lenta/móvil la ventana de la condición de carrera es mucho más ancha).

**Hipótesis de valor:**
Un patrón compartido (guard de `requestId`) que descarte respuestas fuera de orden evita que
una secretaria tome una decisión sobre datos de la sede equivocada tras cambiar de filtro
rápido.

---

## 2. User Stories

- **US1**: Como Secretaria/Admin que cambia de sede o filtro rápidamente (dos clicks
  seguidos en el selector de sede, o cambio de rango de fechas antes de que cargue el
  anterior), quiero que la pantalla siempre termine mostrando los datos del filtro
  **actualmente** seleccionado, para no tomar una decisión operativa sobre datos de la
  sede/filtro equivocado sin darme cuenta.
- **US2**: Como desarrollador que crea o mantiene un Facade branch-scoped, quiero un
  patrón/utilidad reutilizable para descartar respuestas fuera de orden, para no tener que
  reinventar la lógica de `requestId` en cada Facade nuevo ni dejarla inconsistente entre
  los ~5 Facades ya branch-scoped.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given `AdminAlumnosFacade` con una fetch en curso para Sede A que tarda más en
  responder, When el usuario cambia a Sede B antes de que la respuesta de Sede A llegue,
  Then solo el resultado de Sede B se aplica al signal de estado — la respuesta de Sede A
  se descarta sin tocar `_data`/`_isLoading`/`_error`.
- **AC2**: Given el guard de `requestId` integrado en un Facade, When solo hay una fetch en
  vuelo por vez (caso normal, sin cambios rápidos de filtro), Then el comportamiento es
  idéntico al actual — cero regresión funcional ni visual.
- **AC3**: Given la utilidad compartida ya implementada, When se integra en un Facade nuevo
  o existente, Then la integración requiere un cambio acotado y mecánico (crear el guard,
  incrementarlo antes de la fetch, chequear vigencia antes de aplicar el resultado) — no
  lógica ad-hoc distinta por Facade.
- **AC4**: Given los Facades branch-scoped que siguen el patrón
  `initialize()`/`fetchXxxData()`/`refreshSilently()` (`AdminAlumnosFacade`,
  `DashboardFacade`, `FlotaFacade`, `DmsFacade`), Then todos aplican el guard tras el spike
  inicial en `AdminAlumnosFacade`. **`EnrollmentFacade` queda fuera de esta primera pasada**
  (decisión de plan.md §3 — es un wizard de un solo draft, no sigue el mismo esqueleto de
  re-fetch; si se confirma que también corre el mismo riesgo, se resuelve en spec/fix aparte).

### Edge cases obligatorios

- **AC-E1**: Given 3+ cambios de filtro/sede disparados en rápida sucesión (no solo 2) con
  tiempos de respuesta variables e impredecibles entre ellos, Then únicamente el resultado
  de la fetch **más reciente disparada** se aplica al signal de estado, sin importar el
  orden real de llegada de las demás.
- **AC-E2**: Given una fetch descartada por stale, When esa misma fetch hubiera fallado
  (error de red/Supabase), Then el guard no debe enmascarar el error real de la fetch
  **vigente** — el `catchError` de la fetch vigente sigue corriendo normalmente; solo se
  descarta la aplicación de resultados de la fetch obsoleta.
- **AC-E3**: Given `refreshSilently()` (patrón SWR) disparado en paralelo con un cambio de
  filtro, Then el guard también protege ese camino — un refresh silencioso viejo no debe
  pisar el resultado de un cambio de filtro más reciente.

---

## 4. Out of scope

- ❌ Cancelar la request HTTP/Supabase real en curso (`AbortController`/cancelación de red)
  — el guard descarta el **resultado** al aplicarlo, no cancela la conexión. Si el spike
  revela que esto no basta (ej. costo de red innecesario), se evalúa aparte.
- ❌ `GlobalSearchFacade` y cualquier Facade que filtre en memoria sobre datos ya cargados
  (no golpea Supabase por keystroke, no tiene el problema).
- ❌ Extender el patrón a los ~95 Facades no branch-scoped del proyecto en esta primera
  pasada — el alcance se acota a los 5 de `.claude/rules/facades.md` §7 hasta validar el
  spike; extender al resto queda para una spec/fix posterior si se decide.

---

## 5. Dependencias

### Specs previas
- ninguna

### Capacidades del proyecto que se asumen existentes
- `.claude/rules/facades.md` §7 (Facades Multi-Sede) — lista de Facades branch-scoped
- `.claude/rules/swr-pattern.md` — patrón SWR/Realtime existente (no cubre orden de llegada)

### Capacidades nuevas requeridas
- Utilidad pura en `core/utils/` (Núcleo Funcional, ver `.claude/rules/architecture.md`) que
  encapsule el guard de `requestId`: crear/incrementar un token por fetch, y verificar si un
  token sigue siendo el más reciente antes de aplicar su resultado.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna (es un patrón de capa Facade, no de BD)
- Modelos UI nuevos: ninguno — es una utilidad de control de flujo, no de datos
- RLS requerida: ninguna

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): las que consumen los Facades branch-scoped priorizados
  (Alumnos admin/secretaria, Dashboard, Flota, DMS, Matrícula/Enrollment).
- Flujo principal (happy path): usuario cambia de sede/filtro → Facade descarta cualquier
  fetch anterior aún en vuelo → solo se renderiza el resultado del filtro vigente.
- Estados especiales: sin cambio visual nuevo — no hay indicador de "descartando
  respuesta vieja", es invisible para el usuario (el objetivo es que nunca vea el dato
  incorrecto, no que vea el proceso de descarte).

---

## 8. Métricas de éxito post-launch

- Cero reportes de "vi datos de la sede equivocada tras cambiar de filtro rápido" en los
  Facades branch-scoped priorizados, post-launch.

---

## 9. Notas / decisiones abiertas

- [ ] Vale la pena spikear el patrón en UN Facade primero (sugerido: `AdminAlumnosFacade`, el
  más simple de los branch-scoped) antes de comprometerse a aplicarlo a los ~100 Facades del
  proyecto — puede que el alcance real termine siendo "solo los branch-scoped", no todos.
- [ ] No confundir con debounce de input de búsqueda — `GlobalSearchFacade` ya está bien
  resuelto (filtra en memoria, no golpea Supabase por keystroke) y no necesita este fix.
- Originado de Asignación ASG-b-064 (specs/assignments/ASG-b-064-facades-sin-guard-respuesta-stale.md)

---

## Changelog

- 2026-08-05 — draft inicial por m, generado desde ASG-b-064 vía `/assign-claim`.
- 2026-08-05 — User Stories, AC (4) y edge cases (3) completados a partir del contexto ya
  detallado en la Asignación (guard de `requestId` en core/utils/, primera pasada acotada a
  los 5 Facades branch-scoped de `facades.md` §7).
- 2026-08-05 — approved por m.
- 2026-08-05 — AC4 acotado a 4 Facades tras `/spec-plan` (se excluye `EnrollmentFacade`, ver
  plan.md §3).
- 2026-08-05 — done: 7/7 AC ✅ PASA. `createRequestGuard()` (`core/utils/request-guard.utils.ts`)
  integrado en `AdminAlumnosFacade`, `DashboardFacade`, `FlotaFacade`, `DmsFacade`. 1742/1742
  test:ci, `lint:arch` limpio. Ver acceptance.md.
