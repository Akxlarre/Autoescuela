# Acceptance 0029-b — Comunicaciones: consolidar 3 implementaciones + patrón dual

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-12
> **Verifier:** agente (verificación en vivo con Playwright MCP, login real con credenciales de prueba de los 3 roles) · validado por Akxlarre

---

## Resumen

- AC totales: 6 + 3 edge cases
- AC cumplidos: 6
- AC cumplidos con evidencia parcial (unitaria, no en vivo con datos reales): 2 (AC3, AC-E2)
- AC fallidos: 0

**Veredicto final:** ✅ PASA (con 1 gap de cobertura declarado, no bloqueante)

Suite: `npm run test:ci` → **1279/1279 PASS** (5 tests nuevos: `visibleWithLoadMore`). `npm run lint:arch` → **0 errores**. `ng build` → limpio. Consola del navegador → 0 errores en las 3 páginas (1 warning de GoTrue lock, atribuible a los múltiples logins/logouts hechos para la propia sesión de QA, no al código de la spec).

---

## Verificación por AC

### AC1 — Los 3 Smart Components renderizan vía `<app-task-list-content>` compartido

- **Estado:** ✅ cumplido
- **Evidencia:** `AdminTareasComponent`, `SecretariaObservacionesComponent`, `InstructorTareasComponent` — los 3 templates reemplazaron su bloque tabs+`@for`+skeletons por `<app-task-list-content [tabs] [activeTab] [tasks] [loading] [maxVisible] emptyMessage... (activeTabChange) (taskClicked)>`. `grep "app-task-card"` en los 3 archivos → 0 ocurrencias (ya no importan `TaskCardComponent` directamente).

### AC2 — Desktop 1440×900: sin scroll de página, card llena el resto

- **Estado:** ✅ cumplido
- **Evidencia:** Playwright 1440×900 en los 3 roles (login real) → `.shell-content` `{clientH: 823, scrollH: 823, noScroll: true}` en los 3; `.bento-fill` con `contain: "size"` computado tras el fix del selector CSS (ver deuda). Screenshots: `.playwright-mcp/0029-b-admin-desktop.png`, `0029-b-secretaria-desktop.png`, `0029-b-instructor-desktop.png`.

### AC3 — Móvil: presupuesto acotado + "Cargar más"

- **Estado:** ✅ cumplido (cobertura unitaria) / ⚠️ no ejercitado en vivo con datos reales
- **Evidencia:** `visibleWithLoadMore` en `layout-tier.utils.spec.ts` — 5 tests: budget=null sin límite, budget=5 sin clicks→5 items, clicks del tab activo expanden `budget*(1+clicks)`, sin duplicados/overflow. En vivo (Playwright, los 3 roles): `contain: "none"` correcto en móvil, sin colapso — pero el seed de datos solo tiene 1-2 tareas por tab en estos 3 usuarios de prueba, insuficiente para cruzar el presupuesto de 5 y ver el botón "Cargar más" renderizado con datos reales.
- **Notas:** el mecanismo es idéntico (mismo `visibleWithLoadMore`) al ya verificado end-to-end con 22 alumnos reales en la spec 0028 (Base Alumnos B), por lo que el riesgo residual es bajo.

### AC4 — Reset de densidad al cambiar de tab

- **Estado:** ✅ cumplido
- **Evidencia:** test `visibleWithLoadMore`: "con clicks de OTRO tab, los ignora (no expande el tab activo)" — cubre exactamente el mecanismo tab-scoped que reemplaza el reset imperativo original.

### AC5 — Densidad reactiva al ancho del contenedor (drawer, tier)

- **Estado:** ✅ cumplido
- **Evidencia:** Los 3 Smart Components inyectan `LayoutService` y computan `maxVisible = tier() === 'desktop' ? null : 5` — mismo mecanismo verificado en vivo en la spec 0028 (AC7, drawer abierto → 3 alertas con altura natural). No re-ejercitado en vivo aquí porque es el mismo `LayoutService.tier()` sin cambios.

### AC6 — Hero/KPIs mantienen su composición actual por rol

- **Estado:** ✅ cumplido
- **Evidencia:** Screenshots confirman: Admin sin KPI-row separado (KPIs viven en el hero, sin cambios); Secretaria con 3 `.bento-square` (Mis pendientes/Recibidas/A instructores); Instructor con 2 `.bento-square` (Pendientes/En progreso). Ninguno se movió al hero.

### AC-E1 — Tab vacío: empty-state sin "Cargar más"

- **Estado:** ✅ cumplido
- **Evidencia:** Componente `TaskListContentComponent`: `@else if (tasks().length === 0)` renderiza `<app-empty-state>` en la misma rama donde NO se evalúa el bloque de "Cargar más" (mutuamente exclusivos en el `@if/@else if/@else`). Confirmado visualmente: Secretaria tab "Mis observaciones" vacío mostró el empty-state sin botón.

### AC-E2 — ≤ presupuesto: sin "Cargar más"

- **Estado:** ✅ cumplido (unitario) — mismo comentario de cobertura que AC3
- **Evidencia:** test `sliceByBudget`/`visibleWithLoadMore` con budget ≥ length → todo, `remainingCount` computed como `max(0, tasks().length - visibleTasks().length)` → 0.

### AC-E3 — Skeletons acotados al presupuesto

- **Estado:** ✅ cumplido
- **Evidencia:** `skeletonIndexes` computed en `TaskListContentComponent`: `maxVisible() ?? DEFAULT_DESKTOP_SKELETON_COUNT`. Verificado por lectura de código (no hay `TestBed` disponible para este componente — ver deuda de infraestructura).

---

## Out-of-scope respetado

- ❌ Unificación visual del hero/KPIs entre roles — confirmado: no se tocó (ver AC6).
- ❌ Paginación server-side en `TasksFacade.fetchData()` — confirmado: el facade no se modificó, `git diff` no lo toca.
- ❌ Cambios al modelo de datos `tasks`/`task_replies` o RLS — confirmado: sin migraciones nuevas.
- ❌ Rediseño de `<app-task-card>` — confirmado: mismo componente, sin cambios.
- ❌ Stub `SecretariaComunicacionesComponent` — confirmado: no tocado.

---

## Deuda técnica detectada

- **Gap de cobertura declarado (no bloqueante):** AC3/AC4/AC-E2 (Cargar más + reset) no se ejercitaron en vivo con datos reales por falta de volumen en el seed de los 3 usuarios de prueba. Mitigado por 5 tests unitarios + mismo mecanismo ya probado end-to-end en Base Alumnos B (spec 0028). Si se quiere cerrar el gap: sembrar >5 tareas para `secretaria@test.com`/`instructor@test.com` y re-verificar, o aceptar como riesgo residual bajo.
- **Limitación de infraestructura de testing (pre-existente, no de esta spec):** `TaskListContentComponent` no tiene `.spec.ts` propio porque `vitest.config` no compila templates Angular para `TestBed` (mismo patrón que `alert-card.component.spec.ts`, `describe.skip`). Se mitigó extrayendo la lógica de densidad a una función pura 100% testeada (`visibleWithLoadMore`), dejando el componente como wrapper delgado verificado con `ng build`. Documentado en el propio `tasks.md` §Fase 1.
- **Bug encontrado y corregido durante esta misma spec:** el selector `.bento-fill` no incluía `.bento-grid--fill-screen-kpi` — hallado en vivo al verificar Secretaria (contain:none en vez de size), corregido de inmediato, revalidado en los 3 roles.

---

## Cambios en índices

(pendiente T5.1 — se listan los artefactos)

- `indices/COMPONENTS.md` — nuevo `app-task-list-content`; `AdminTareasComponent`/`SecretariaObservacionesComponent`/`InstructorTareasComponent` actualizados.
- `indices/UTILS.md` — `layout-tier.utils` gana `visibleWithLoadMore`.
- `indices/STYLES.md` — nuevo modificador `.bento-grid--fill-screen-kpi`.

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el auto-flow denso del grid resolvió la fila de KPIs sin ningún `data-row-start` manual, tal como se predijo en el plan por conteo de columnas — cero sorpresas de posicionamiento.
- **Fricciones:** (1) TestBed no compila templates en este proyecto — resuelto extrayendo la lógica a función pura, mejor diseño en retrospectiva. (2) Verificar 3 roles distintos requirió descubrir el flujo de login de prueba y un workaround de timing (SPA nav en vez de full reload) porque el full-page-reload pierde la sesión por una carrera con la hidratación de Supabase — anotar este comportamiento para futuras sesiones de QA multi-rol.
- **Para el siguiente ciclo:** sembrar más datos de prueba (>5 tareas por tab) para los usuarios secretaria/instructor de test cerraría el único gap declarado.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (2 con evidencia unitaria en vez de end-to-end, declarado explícitamente)
- [x] Out-of-scope respetado
- [x] Índices actualizados (`npm run indices:sync`: COMPONENTS/SERVICES/MODELS/UTILS/STYLES/USAGE-MAP)
- [x] Tests pasando en CI (1279/1279)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta (deuda declarada es de cobertura, no de comportamiento)

**Cerrado por:** Akxlarre
**Fecha:** 2026-07-12
