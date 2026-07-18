# Plan 0002-b — Instructor: Vista de Tareas con Diferenciación por Tipo

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-05-21

---

## 1. Resumen ejecutivo

Se modifica exclusivamente `InstructorTareasComponent` para agregar chips de filtro por tipo (`SelectButton` PrimeNG) con badges de conteo activo, y se reemplaza el KPI "Total recibidas" por "En progreso". Toda la lógica de filtrado y conteo vive en `computed()` locales del Smart Component, consumiendo `TasksFacade.receivedTasks()` que ya existe y expone los datos necesarios. Sin cambios en Facade, BD ni modelos.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/features/instructor/tareas/instructor-tareas.component.spec.ts` | Test (Smart Component) | Tests de los `computed()` de filtrado y conteo por tipo |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/instructor/tareas/instructor-tareas.component.ts` | Agregar `TaskTypeFilter`, signal `activeFilter`, computeds `filteredTasks`/`filterChips`/`inProgressCount`, chips `SelectButton`, empty state contextual, reemplazar KPI "Total recibidas" → "En progreso" | AC1–AC6, AC-E1, AC-E2, spec sección 7 (KPI) |

### Archivos a ELIMINAR

_(ninguno)_

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos

- `app-section-hero` — ya presente, sin cambio
- `app-kpi-card-variant` — existente, solo se cambia el label/valor de uno de los KPIs
- `app-task-card` — ya presente en la lista, sin cambio
- `app-empty-state` — ya presente, se parameteriza con mensaje contextual por tipo de filtro
- `PrimeNG SelectButton` — para los chips de filtro (disponible en PrimeNG, sin instalación adicional)
- `PrimeNG Badge` — para el conteo activo dentro de los chips (via slot de template de SelectButton)

### Facades/Services existentes que extendemos

- `TasksFacade.receivedTasks()` — ya expone `TaskRow[]` con el campo `type`. No se modifica el Facade.
- `TasksFacade.isLoading()`, `TasksFacade.pendingCount()` — ya expuestos y usados

### Componentes/Facades que NO existen y debemos crear

- **No hay nuevos** — toda la lógica de filtrado y conteo se implementa como `computed()` dentro del componente. Crear un Facade nuevo para esto sería burocracia innecesaria: son derivaciones síncronas de un signal ya cacheado.

---

## 4. Modelo de datos

**N/A** — Sin cambios en BD. La spec lo confirma explícitamente ("Sin cambios en BD ni modelos DTO").

El único tipo nuevo es local al componente:

```typescript
type TaskTypeFilter = 'all' | 'task' | 'question' | 'observation';
```

No sale a `core/models/` porque no es compartida por ningún otro componente.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
InstructorTareasComponent (Smart)
  │
  ├─ inject(TasksFacade)
  │     └─ receivedTasks(): TaskRow[]  ← ya existe, realtime incluido
  │
  ├─ signal: activeFilter: TaskTypeFilter = 'all'
  │
  ├─ computed: filteredTasks
  │     → receivedTasks().filter(t => activeFilter === 'all' || t.type === activeFilter)
  │
  ├─ computed: filterChips (opciones para SelectButton)
  │     → [{value:'all', label:'Todas', count: activeCount(all)},
  │        {value:'task', label:'Tareas', count: activeCount('task')},
  │        {value:'question', label:'Consultas', count: activeCount('question')},
  │        {value:'observation', label:'Observaciones', count: activeCount('observation')}]
  │     donde activeCount(type) = receivedTasks().filter(t => type==='all' || t.type===type)
  │                                              .filter(t => t.status !== 'completed').length
  │
  ├─ computed: inProgressCount   ← nuevo KPI "En progreso"
  │     → receivedTasks().filter(t => t.status === 'in_progress').length
  │
  └─ template
        ├─ p-select-button (chips de filtro) ← NUEVO
        ├─ app-kpi-card-variant "Pendientes"  (sin cambio)
        ├─ app-kpi-card-variant "En progreso" (reemplaza "Total recibidas")
        ├─ @for filteredTasks → app-task-card
        └─ @if filteredTasks.length === 0 → app-empty-state (mensaje contextual)
```

### Capas tocadas

- **Smart**: `src/app/features/instructor/tareas/instructor-tareas.component.ts`
- **Dumb**: ninguno nuevo
- **Facade**: ninguno (solo consumo de señales existentes)
- **Service**: ninguno
- **Migration**: ninguna

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush ya activo, se agregan signals y computed, sin inyección nueva de Supabase
- [ ] `facades.md` — No se toca ningún Facade
- [ ] `models.md` — No se crea ningún modelo nuevo
- [x] `visual-system.md` — SelectButton con tokens semánticos, sin colores hardcodeados; bento grid se mantiene
- [x] `swr-pattern.md` — `TasksFacade` ya maneja SWR + Realtime; AC-E2 (conteos actualizados en realtime) se satisface gratis porque `filteredTasks` y `filterChips` son `computed()` sobre `receivedTasks()` que ya es reactivo
- [ ] `notifications.md` — No hay toasts ni notificaciones nuevas
- [x] `testing-tdd.md` — Smart Component con `computed()` con lógica → `.spec.ts` obligatorio
- [ ] `ai-readability.md` — No hay nuevos botones de mutación (instructor es receptor puro)

---

## 7. Plan de testing

### Tests unitarios (`instructor-tareas.component.spec.ts`)

Cubrir los siguientes casos con señales mock de `TasksFacade`:

| Test | AC verificado |
|------|---------------|
| Filtro 'all' muestra todas las tareas | AC1 |
| Filtro 'task' muestra solo type='task' | AC2 |
| Filtro 'question' muestra solo type='question' | AC3 |
| Filtro 'observation' muestra solo type='observation' | AC4 |
| `filterChips` badge count excluye status='completed' | AC5 |
| Filtro 'question' con 0 tasks → `filteredTasks` vacío (no crash) | AC-E1 |
| Cambiar `receivedTasks` → `filterChips` recalcula automáticamente | AC-E2 |
| `inProgressCount` cuenta solo status='in_progress' | Spec sección 7 (KPI) |

### QA manual (golden path + edge cases)

- Cargar vista con tareas de los 3 tipos → chips muestran conteos correctos
- Clic en cada chip → lista se filtra visualmente
- Completar una tarea → contador del chip baja (realtime)
- Llegar a la vista sin ninguna tarea → empty state genérico con filtro 'all'
- Cambiar a filtro 'question' sin consultas → empty state contextual

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `SelectButton` de PrimeNG no soporta templates custom en slots para badge | Media | Si el slot no funciona, usar `[label]` con string concatenado (ej. `"Tareas (3)"`) como fallback; o componer badge con CSS |
| Iconos de filtro chips necesitan registro en `app.config.ts` | Baja | Solo usar texto en los chips (sin ícono extra); Lucide solo se usa si se decide agregar ícono por tipo, que está fuera del scope |
| `SelectButton` requiere import PrimeNG no registrado | Baja | Verificar `import { SelectButtonModule } from 'primeng/selectbutton'` en imports del componente |

---

## 9. Orden de implementación

1. Escribir `instructor-tareas.component.spec.ts` con todos los tests en rojo
2. Agregar `type TaskTypeFilter`, `activeFilter` signal y los tres `computed()` al componente
3. Actualizar template: agregar chips `p-select-button`, cambiar KPI, parametrizar empty state
4. Correr `npm run test:ci` → verde
5. QA manual en browser con `ng serve`
6. Actualizar `specs/ROADMAP.md` (mover 0002-b a "En progreso")

---

## 10. Estimación

**S** — 1 archivo modificado + 1 spec nuevo. ~1-2h.

---

## Changelog

- 2026-05-21 — plan inicial
