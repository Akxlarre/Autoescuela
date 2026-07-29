# Spec 0002-b — Instructor: Vista de Tareas con Diferenciación por Tipo

> **Status:** approved
> **Created:** 2026-05-21
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Análisis UX post-QA del módulo de tareas multi-rol (fix-001..005)

**Persona afectada:** Instructor

**Problema que resuelve:**
El instructor ve todas sus tareas recibidas en una lista plana sin ninguna diferenciación
por tipo. Una `observation` (solo leer), una `task` (completar manualmente) y una `question`
(responder por escrito) requieren acciones completamente distintas, pero el instructor no
puede saberlo sin abrir cada tarjeta. Esto genera fricción innecesaria y riesgo de ignorar
tareas que requieren respuesta activa.

**Hipótesis de valor:**
Si el instructor puede filtrar sus tareas por tipo desde la vista principal, reducirá el
tiempo de procesamiento y las tareas pendientes acumuladas.

---

## 2. User Stories

- **US1**: Como instructor, quiero ver mis tareas separadas por tipo (Todas / Tareas / Consultas / Observaciones) para saber de un vistazo qué requiere mi atención.
- **US2**: Como instructor, quiero ver un badge numérico en cada filtro para saber cuántas tareas pendientes tengo por tipo sin abrirlas.
- **US3**: Como instructor, quiero que las observaciones sin leer se destaquen visualmente para no pasarlas por alto.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given el instructor está en `/app/instructor/tareas`, When carga la vista, Then ve chips o tabs de filtro: "Todas", "Tareas", "Consultas", "Observaciones".
- **AC2**: Given hay tareas de distintos tipos, When el instructor hace clic en "Tareas", Then solo ve ítems con `type='task'`.
- **AC3**: Given hay tareas de distintos tipos, When el instructor hace clic en "Consultas", Then solo ve ítems con `type='question'`.
- **AC4**: Given hay tareas de distintos tipos, When el instructor hace clic en "Observaciones", Then solo ve ítems con `type='observation'`.
- **AC5**: Given hay tareas `pending` o `in_progress`, When el instructor mira el chip de filtro, Then el chip muestra un badge con el conteo de tareas activas (status ≠ completed) para ese tipo.
- **AC6**: Given el filtro activo es "Todas", When no hay ninguna tarea, Then se muestra el empty state correspondiente.

### Edge cases obligatorios

- **AC-E1**: Given el instructor no tiene tareas de un tipo (ej. ninguna `question`), When está en el filtro "Consultas", Then muestra empty state (no crashea).
- **AC-E2**: Given hay nuevas tareas en realtime mientras el instructor tiene la vista abierta, When llega una tarea nueva, Then los conteos de los chips se actualizan sin recargar.

---

## 4. Out of scope

- ❌ Capacidad del instructor de crear tareas o preguntas (es receptor puro en v1)
- ❌ Ordenamiento manual de la lista (se mantiene orden por `created_at DESC`)
- ❌ Filtro por estado (pending / in_progress / completed) — eso es scope de una spec futura
- ❌ Rediseño del `TaskCardComponent` compartido

---

## 5. Dependencias

### Specs previas
- `0001-sistema-de-tareas-multi-rol` — debe estar `done` ✅

### Capacidades del proyecto que se asumen existentes
- `TasksFacade` con `receivedTasks()`, `pendingCount()`, realtime vía Supabase
- `TaskCardComponent` en `shared/components/task-card/`
- `TaskDetailModalComponent` + drawer de detalle

### Capacidades nuevas requeridas
- Ninguna en infraestructura — solo cambios en `InstructorTareasComponent`

---

## 6. Datos y modelo (preliminar)

- Sin cambios en BD ni modelos DTO
- Nuevo tipo local en el componente: `type TaskTypeFilter = 'all' | 'task' | 'question' | 'observation'`

---

## 7. UX y flujos (preliminar)

- **Pantalla afectada:** `src/app/features/instructor/tareas/instructor-tareas.component.ts`
- **Flujo principal:** Instructor abre la vista → ve chips de filtro arriba de la lista → clic en chip filtra la lista → badge muestra conteo activo por tipo
- **Estado vacío:** Empty state genérico con mensaje contextual al tipo seleccionado
- **KPIs:** Reemplazar "Total recibidas" (confuso — incluye completadas) por "En progreso" (status = in_progress) para celebrar el trabajo activo

---

## 8. Métricas de éxito post-launch

- El instructor puede identificar qué tipo de tarea tiene pendiente sin abrir ninguna tarjeta
- Reducción de tareas `question` acumuladas en `in_progress` sin respuesta del instructor

---

## 9. Notas / decisiones abiertas

- [x] **Chips vs tabs** → Chips (`SelectButton` de PrimeNG). Más compacto, no ocupa fila completa, deja más espacio a la lista.
- [x] **Badge count** → Tareas activas (`status !== 'completed'`), no solo `pending`. Una `question` en `in_progress` sin respuesta del instructor sigue requiriendo acción.

---

## Changelog

- 2026-05-21 — draft inicial por Akxlarre
