# Tasks 0002-b — Instructor: Vista de Tareas con Diferenciación por Tipo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-05-21

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Spec y tests (TDD)

- [x] **T1.1** — Escribir `instructor-tareas.component.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC6, AC-E1, AC-E2
  - **DoD:**
    - [ ] Test: filtro `'all'` → `filteredTasks` retorna todas las tareas
    - [ ] Test: filtro `'task'` → solo `type='task'`
    - [ ] Test: filtro `'question'` → solo `type='question'`
    - [ ] Test: filtro `'observation'` → solo `type='observation'`
    - [ ] Test: `filterChips[1].count` excluye status `'completed'` (badge count = activas)
    - [ ] Test: filtro `'question'` con 0 consultas → `filteredTasks` vacío, no crash
    - [ ] Test: cambio reactivo en `receivedTasks` → `filterChips` recalcula (AC-E2)
    - [ ] Test: `inProgressCount` cuenta solo `status='in_progress'`
    - [ ] Todos los tests FALLAN antes de modificar el componente

---

## Fase 2 — Lógica del componente

- [x] **T2.1** — Agregar tipo local y signals de filtro a `InstructorTareasComponent`
  - **AC ref:** AC1
  - **DoD:**
    - [ ] `type TaskTypeFilter = 'all' | 'task' | 'question' | 'observation'` definido en el archivo
    - [ ] `activeFilter = signal<TaskTypeFilter>('all')` agregado
    - [ ] `computed filteredTasks` implementado (filtra por `activeFilter` sobre `receivedTasks()`)
    - [ ] `computed inProgressCount` implementado (`status === 'in_progress'`)
    - [ ] `computed filterChips` implementado (4 opciones con `count = activas por tipo`)
    - [ ] `npm run test:ci` → tests de T1.1 PASAN

- [x] **T2.2** — Actualizar template: chips de filtro y KPI "En progreso"
  - **AC ref:** AC1, AC2, AC3, AC4, AC5
  - **DoD:**
    - [ ] `p-select-button` (PrimeNG) importado en `imports[]` del componente
    - [ ] Chips muestran: "Todas", "Tareas", "Consultas", "Observaciones"
    - [ ] Cada chip muestra badge con conteo de activas (≠ completed)
    - [ ] KPI "Total recibidas" reemplazado por "En progreso" (`inProgressCount`)
    - [ ] `@for` itera sobre `filteredTasks()` (no `receivedTasks()`)
    - [ ] Tokens semánticos usados (sin `text-red-500` ni colores hardcodeados)

- [x] **T2.3** — Empty state contextual por tipo de filtro
  - **AC ref:** AC6, AC-E1
  - **DoD:**
    - [ ] Filtro `'all'` sin tareas → mensaje: "Sin tareas asignadas"
    - [ ] Filtro `'task'` sin resultados → mensaje: "Sin tareas pendientes"
    - [ ] Filtro `'question'` sin resultados → mensaje: "Sin consultas pendientes"
    - [ ] Filtro `'observation'` sin resultados → mensaje: "Sin observaciones"
    - [ ] Todos usan `app-empty-state` con ícono contextual
    - [ ] No crashea con lista vacía (AC-E1)

---

## Fase 3 — Validación

- [x] **T3.1** — `npm run test:ci` corre verde (todos los tests de T1.1 en verde)
- [x] **T3.2** — `npm run lint:arch` — sin errores nuevos (20 errores pre-existentes, ninguno de esta spec)

- [ ] **T3.3** — QA manual en browser (pendiente usuario)
  - **DoD:**
    - [ ] Cargar vista con tareas de los 3 tipos → chips muestran conteos correctos
    - [ ] Clic en cada chip → lista se filtra visualmente
    - [ ] Cambiar estado de una tarea a `completed` → contador del chip baja sin recargar (AC-E2)
    - [ ] Vista sin ninguna tarea → empty state correcto en filtro `'all'`
    - [ ] Cambiar a filtro `'question'` sin consultas → empty state contextual correcto
    - [ ] Animación de bento grid funciona al cargar la vista

---

## Fase 4 — Cierre

- [x] **T4.1** — Actualizar `indices/COMPONENTS.md` si se agregaron nuevos imports relevantes
- [x] **T4.2** — Marcar spec 0002-b como `done` en `specs/ROADMAP.md`
- [x] **T4.3** — Limpiar `specs/.active` con `/spec-activate --clear`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
