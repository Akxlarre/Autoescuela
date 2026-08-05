# Spec 0005 — Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede

> **Status:** draft
> **Created:** 2026-08-05
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

- **US1**: {{completar}}
- **US2**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: {{completar}}
- **AC2**: …

### Edge cases obligatorios

- **AC-E1**: {{completar}}

---

## 4. Out of scope

- ❌ {{cosa que NO va}}

---

## 5. Dependencias

### Specs previas
- ninguna

### Capacidades del proyecto que se asumen existentes
- `.claude/rules/facades.md` §7 (Facades Multi-Sede) — lista de Facades branch-scoped
- `.claude/rules/swr-pattern.md` — patrón SWR/Realtime existente (no cubre orden de llegada)

### Capacidades nuevas requeridas
- {{completar}}

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna (es un patrón de capa Facade, no de BD)
- Modelos UI nuevos: {{completar}}
- RLS requerida: ninguna

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): {{completar — priorizar Facades branch-scoped}}
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

- {{métrica 1}}

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
