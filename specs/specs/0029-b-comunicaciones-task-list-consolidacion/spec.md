# Spec 0029-b — Comunicaciones: consolidar 3 implementaciones + patrón dual (fill-screen desktop / densidad móvil)

> **Status:** done
> **Created:** 2026-07-12
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Continuación de la spec 0028 (layout responsive dual). Al revisar la página "Comunicaciones" para aplicarle el mismo patrón, se encontró que no es una sola página sino 3 implementaciones casi duplicadas.

**Persona afectada:** Admin, Secretaria, Instructor (los 3 roles que usan mensajería/tareas internas).

**Problema que resuelve:**
Existen 3 componentes casi idénticos (`AdminTareasComponent`, `SecretariaObservacionesComponent`, `InstructorTareasComponent`) que renderizan la misma lista de tareas/mensajes (`TasksFacade.tasks()`) con templates escritos a mano por separado. Ya divergieron: solo Admin usa `bento-grid--fill-screen` (modo app-like), los otros dos usan `bento-grid` plano con scroll natural. Los 3 renderizan el array completo sin ningún tope de densidad (`@for` sin `sliceByBudget`, sin paginación, sin "Cargar más"). Hoy no hay bug visual visible porque el seed de datos tiene pocos ítems (2-3 por tab), pero el riesgo es de escala: `TasksFacade.fetchData()` trae TODA tarea no completada más lo completado en los últimos 90 días, sin `.limit()`, y una escuela con semanas de uso real (admin↔secretaria↔instructor) puede acumular decenas o cientos de tareas por tab.

**Hipótesis de valor:**
Consolidar en un único Dumb Component reutilizable evita que la deuda de duplicación siga creciendo, y aplica el patrón dual (spec 0028) una sola vez para que los 3 roles queden protegidos contra el mismo colapso móvil que tuvimos en Inicio/Base Alumnos B, antes de que ocurra en producción.

---

## 2. User Stories

- **US1**: Como desarrollador, quiero un único `<app-task-list-content>` (Dumb, shared/) que reciba tabs/tasks/kpis por input, para no mantener 3 templates casi idénticos que ya divergieron.
- **US2**: Como admin/secretaria/instructor en **desktop**, quiero que la página de Comunicación sea app-like (sin scroll de página), igual que Inicio y Base Alumnos B, para consistencia visual y de uso.
- **US3**: Como admin/secretaria/instructor en **móvil**, quiero ver un número acotado de tareas/mensajes por tab con un mecanismo para cargar más, para no quedar ante una lista larga sin fin en una pantalla chica.
- **US4**: Como desarrollador, quiero que el fix de densidad quede escrito una sola vez en el Dumb compartido, para que futuras correcciones no requieran tocar 3 archivos.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given los 3 Smart Components (Admin/Secretaria/Instructor), When se revisa su template, Then los 3 renderizan la lista de tareas a través del mismo `<app-task-list-content>` compartido (sin duplicar el `@for`/tabs/densidad en cada uno).
- **AC2**: Given desktop 1440×900 en cualquiera de las 3 páginas, When se carga con datos, Then `.shell-content` no scrollea y la card de la lista llena el resto del viewport (`bento-grid--fill-screen` + `.bento-fill`, canon de la spec 0028).
- **AC3**: Given móvil 390×844 con más ítems que el presupuesto del tier, When se carga la página, Then se muestra un número acotado de `<app-task-card>` (a definir el número exacto en el plan, según altura real medida) + botón "Cargar más" que incrementa la cantidad visible.
- **AC4**: Given móvil, When se cambia de tab (Asignadas/Recibidas/Observaciones o equivalente), Then el contador de densidad se resetea al presupuesto base para el tab activo.
- **AC5**: Given drawer lateral abierto en desktop (contenedor angostado), When la página de Comunicación está activa, Then la densidad reacciona igual que en móvil (mismo mecanismo `LayoutService.tier()` de la spec 0028), sin recarga.
- **AC6**: Given las 3 páginas ya migradas, When se comparan visualmente Admin/Secretaria/Instructor, Then el hero y los KPIs de cada una mantienen su composición actual (Admin: KPIs en el hero; Secretaria/Instructor: KPIs como celdas `.bento-square` separadas) — la consolidación no fuerza una unificación visual del hero, solo de la lista+tabs+densidad.

### Edge cases obligatorios

- **AC-E1**: Given un tab sin tareas, Then se muestra el empty-state existente, sin botón "Cargar más".
- **AC-E2**: Given un tab con menos ítems que el presupuesto, Then no aparece "Cargar más".
- **AC-E3**: Given loading, Then los skeletons de `<app-task-card [loading]="true">` respetan el mismo presupuesto que la vista cargada (no muestran más ni menos placeholders que ítems reales esperados).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Unificar el hero/KPIs visualmente entre los 3 roles (se mantiene la composición actual de cada uno).
- ❌ Paginación/`.limit()` server-side en `TasksFacade.fetchData()` — la query sigue trayendo todo; el recorte es 100% client-side (mismo patrón que Base Alumnos B). Si el volumen real se vuelve un problema de performance de red, es spec aparte.
- ❌ Cambios al modelo de datos de `tasks`/`task_replies` o a las políticas RLS.
- ❌ Rediseño del contenido de `<app-task-card>` (mismos campos, mismo componente).
- ❌ El stub `SecretariaComunicacionesComponent` ("Próximamente") — no está relacionado, sigue como está.

---

## 5. Dependencias

### Specs previas
- **0028** (`done`) — provee el canon `.bento-fill`, `LayoutService.tier()`, `sliceByBudget` que esta spec reutiliza directamente.

### Capacidades del proyecto que se asumen existentes
- `TasksFacade` (`core/facades/tasks.facade.ts`) — sin cambios.
- `TaskCardComponent`, `TabsComponent`, `EmptyStateComponent` — reutilizados tal cual.
- `_bento-grid.scss` con `.bento-fill` y el checklist de migración (README).
- `core/utils/layout-tier.utils.ts` (`widthToTier`, `sliceByBudget`).
- `core/services/ui/layout.service.ts` (`LayoutService.tier()`).

### Capacidades nuevas requeridas
- `shared/components/task-list-content/task-list-content.component.ts` (Dumb nuevo).

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: posible interfaz de `TaskListTab` si no se reutiliza el tipo existente de `TabsComponent`.
- RLS requerida: no aplica (sin cambios de BD).

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/app/admin/tareas`, `/app/secretaria/observaciones`, `/app/instructor/tareas`.
- Flujo principal (happy path): cada Smart Component sigue resolviendo su propio hero/KPIs/tabs (según su lógica actual de negocio — quién puede enviar a quién, qué tabs le corresponden) y delega la lista+densidad al Dumb compartido.
- Estados especiales: loading (skeletons acotados), vacío (empty-state existente sin "Cargar más"), con datos (lista + "Cargar más" si excede presupuesto).

---

## 8. Métricas de éxito post-launch

- Cero divergencia visual entre los 3 roles en la parte de lista/densidad (un solo componente = imposible que diverjan de nuevo).
- En móvil, ninguna lista de tareas queda sin límite de altura/densidad, sin importar cuántas tareas acumule la sede.

---

## 9. Notas / decisiones abiertas

- [x] Prioridad confirmada por el owner → P1.
- [x] Presupuesto de densidad móvil: propuesta preliminar (5-6 tarjetas) aprobada, a afinar con medición real en el plan.
- [x] Secretaria/Instructor SÍ migran a `bento-grid--fill-screen` (confirmado por el owner, 2026-07-12).

---

## Changelog

- 2026-07-12 — draft inicial (agente, tras análisis de la página Comunicaciones solicitado por el owner)
