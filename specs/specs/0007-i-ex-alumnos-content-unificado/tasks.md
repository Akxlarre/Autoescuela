# Tasks 0007-i — Consolidar Ex-Alumnos Clase B en un `*-content` compartido

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-31

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Discovery y catálogo (antes de tocar código)

- [x] **T1.1** — Catalogar el 100% de diferencias reales entre los dos archivos actuales
  - **AC ref:** base para AC1-AC6 (no perder nada al consolidar)
  - **DoD:**
    - [x] Confirmado (ya hecho en `plan.md` §3 vía `diff -b`): 4 diferencias reales —
      selector, `basePath`/`routerLink`, `BranchFacade` (solo admin), imports de drawers
    - [x] Confirmar que `ExAlumnosFacade` es la MISMA instancia inyectada en ambos (ya
      verificado en `plan.md` §3 — `protected readonly facade = inject(ExAlumnosFacade)`
      idéntico en los dos archivos)
    - [x] Listar los 2 drawers + su sub-componente (`ex-alumnos-stats`) como el set exacto
      a mover (ya hecho en `plan.md` §2)

---

## Fase 2 — Extracción del Dumb/Organismo (TDD)

- [x] **T2.1** — Escribir `ex-alumnos-content.component.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC6, AC-E1
  - **DoD:**
    - [x] Test: filtrado por búsqueda encuentra un egresado sin importar el período activo
      (AC6 — mismo comportamiento que hoy, ASG-b-087)
    - [x] Test: sin búsqueda activa, el período filtra la lista (orden período→búsqueda)
    - [x] Test: paginación mobile (`mobileShown`/`CARDS_STEP`) incrementa correctamente
    - [x] Test: `requestReEnroll(egresado)` emite `reEnrollRequested` con el egresado
      completo (contrato ajustado — ver nota Architect Guard; el guard `branchId !== null`
      quedó en el Smart Component, cubierto en T3.1)
    - [x] `signal()` locales vía `Object.defineProperty` para stubear los `input()`
      (mismo patrón que `pre-inscritos-content.component.spec.ts` — los signal inputs no
      son escribibles directo en esta infra sin fixture)
    - [x] 8/8 tests en verde tras implementar T2.2

- [x] **T2.2** — Crear `shared/components/ex-alumnos-content/ex-alumnos-content.component.ts`
  - **AC ref:** AC1, AC2, AC6
  - **DoD:**
    - [x] Tests de T2.1 PASAN
    - [x] **Corrección de diseño (Architect Guard):** el Organismo NO inyecta
      `ExAlumnosFacade` — el hook bloquea cualquier `inject(...Facade)` en `shared/`, sin
      excepción. Queda Dumb puro: `input()` de `egresados`/`isLoading`, todo lo derivado
      (heroChips/heroKpis/availableYears) calculado desde `egresados()`, no desde una Facade
    - [x] `input()`: `egresados`, `isLoading`, `basePath = input<string>('/app/secretaria')`
    - [x] `output()`: `reEnrollRequested`, `requestVerTasas`, `requestComentario`
    - [x] Contenido HTML/lógica absorbido 1:1 desde `admin-ex-alumnos.component.ts` (tiene
      el superset: hero, búsqueda/período/paginación mobile, `initials`, `availableYears`,
      `clearFilters`) — `reEnroll()` y `handleHeroAction()` NO se mueven (necesitan
      `Router`/`ConfirmModalService`/`LayoutDrawerFacadeService`, prohibidos en `shared/`
      igual que las Facades) — quedan como handlers en cada Smart Component (T3.1/T3.2)
    - [x] `<app-period-selector>` + signal `periodWindow` + `computed hasActiveSearch` +
      `applyPeriodWindow()` absorbidos tal cual (sin reimplementar — AC6)
    - [x] Sin `backticks` en comentarios dentro del `template`/`styles` literal
    - [x] `OnPush`, sin inyección de ningún Facade/Service
    - [ ] Documentado en `indices/COMPONENTS.md` (T5.1)

- [x] **T2.3** — Corrección de alcance: drawers NO se mueven (bloqueado por Architect Guard)
  - **AC ref:** AC5, AC-E2
  - **DoD:**
    - [x] Los 2 drawers (`admin-ex-alumnos-tasas-drawer` /
      `admin-ex-alumnos-comentarios-drawer`) y su sub-componente
      (`admin-ex-alumnos-stats.component.ts`) inyectan `ExAlumnosFacade` — se quedan en
      `features/admin/alumnos/ex-alumnos/components/` (siguen siendo válidos ahí)
    - [x] AC-E2 se resuelve distinto: el import de secretaría pasa de ruta relativa
      (`../../admin/alumnos/ex-alumnos/components/...`) al alias
      `@features/admin/alumnos/ex-alumnos/components/...` (T3.2) — sin ruta relativa
      cruzada entre portales, sin mover archivos

---

## Fase 3 — Reducción de los Smart Components

- [x] **T3.1** — Reducir `AdminExAlumnosComponent` a Smart puro
  - **AC ref:** AC1, AC3, AC-E1
  - **DoD:**
    - [x] Sigue inyectando `ExAlumnosFacade` + `BranchFacade` + `LayoutDrawerFacadeService` +
      `ConfirmModalService` + `Router`/`ActivatedRoute` — **corrección respecto al diseño
      original**: `reEnroll()`/`handleHeroAction()` (drawers) se quedan en el Smart, no en
      el Organismo (necesitan servicios prohibidos en `shared/`)
    - [x] `effect()` de recarga por cambio de sede se mantiene sin cambios
    - [x] `reEnroll(egresado)` escucha `(reEnrollRequested)` del Organismo — el guard
      `branchId !== null` antes de `branchFacade.selectBranch()` se mantiene igual que hoy
    - [x] Renderiza `<app-ex-alumnos-content basePath="/app/admin"
      (reEnrollRequested)="reEnroll($event)" (requestVerTasas)="..."
      (requestComentario)="..." />`
    - [x] Archivo bajó de 622 a 82 líneas

- [x] **T3.2** — Reducir `SecretariaExAlumnosComponent` a Smart puro
  - **AC ref:** AC2, AC4
  - **DoD:**
    - [x] Inyecta `ExAlumnosFacade` (para `ngOnInit(): loadEgresados()`) +
      `LayoutDrawerFacadeService` + `ConfirmModalService` + `Router`/`ActivatedRoute` — sin
      `BranchFacade`
    - [x] `reEnroll(egresado)` propio (idéntico al de admin salvo el `selectBranch()`) —
      sigue siendo ~15 líneas casi duplicadas, aceptado en el plan (ver plan.md §3,
      corrección del Architect Guard)
    - [x] Import de los 2 drawers vía alias `@features/admin/alumnos/ex-alumnos/
      components/...` en vez de ruta relativa cruzada (AC-E2)
    - [x] Renderiza `<app-ex-alumnos-content basePath="/app/secretaria" ... />`
    - [x] Archivo bajó de 603 a 79 líneas

---

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` corre limpio (sin warnings nuevos atribuibles a esta spec)
  — exit 0. Único hallazgo nuevo: ARCH-09 (componente >200 líneas, 539 líneas) — no
  bloqueante, mismo patrón que otros `*-content` ya existentes (`flota-list-content` 581
  líneas, `ex-alumnos-profesional-content` 517 líneas)
- [x] **T4.2** — `npm run test:ci` corre verde — 2260/2262 tests (2 fallas preexistentes sin
  relación: `student-horario.facade.spec.ts` por DST y
  `secretaria-contabilidad-cuadratura.component.spec.ts` referenciando un método no tocado
  por esta spec). 18/18 tests de los archivos afectados por 0007-i en verde.
- [x] **T4.3** — `/verify` en ambas rutas
  - **AC ref:** AC1-AC6, AC-E1, AC-E2
  - **DoD:**
    - [x] `/app/admin/ex-alumnos`: hero + chips + 2 KPIs + búsqueda + período + tabla/tarjetas
      idénticos a antes, con datos reales de `ExAlumnosFacade` (2 egresados, sede "Todas")
    - [x] `/app/secretaria/ex-alumnos`: ídem, filtrado por su propia sede (0 egresados —
      empty-state correcto, no error); `routerLink` verificado en admin →
      `/app/admin/alumnos/:id` con `?from=ex-alumnos`
    - [x] Ambos drawers (Tasas, Comentarios) abren y muestran datos reales desde **los 2
      portales** (admin y secretaría probados por separado)
    - [x] Selector de período visible y funcional ("Últimos 12 meses", igual que antes)
    - [x] Consola sin errores en ninguna de las 2 rutas (0 errores, 0 warnings en todas las
      verificaciones)
    - [x] Contrato app-like preservado: `documentScrolls===false` en desktop,
      `.bento-fill` con `contain:size`; `documentScrolls===true` en mobile (375px, scroll
      nativo correcto)
    - [x] Modo oscuro: contraste correcto en hero, badges y cards
    - [x] Auditoría de imports (AC-E2): `grep -rn "\.\./\.\./admin"
      src/app/features/secretaria/ex-alumnos/` → 0 imports reales (solo aparece dentro de
      un comentario explicando el "antes")
    - [x] Cambio de sede (admin) refiltra la lista: "Todas las sedes" (2 egresados) →
      "Autoescuela Chillán" (0, empty-state correcto) → "Conductores Chillán" (2, mismos
      egresados) → confirmado en las 3 direcciones, consola limpia en cada cambio

---

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/COMPONENTS.md`
  - **DoD:**
    - [x] Fila de `app-ex-alumnos-content` agregada (inputs/outputs, ubicación)
    - [x] Filas de `AdminExAlumnosComponent`/`SecretariaExAlumnosComponent` actualizadas
      para reflejar que ahora son wrappers delgados
    - [x] Filas de los 2 drawers actualizadas (se quedan en `features/admin/`, nota del
      alias `@features/` para el import de secretaría)
    - [x] Limpieza de paso: fila stale "Stub PLANO" duplicada de
      `/app/secretaria/ex-alumnos` (línea 312, contradecía la fila real ya documentada)
      eliminada

- [x] **T5.2** — `specs/ROADMAP.md`: mover de Backlog a Done

- [x] **T5.3** — `/spec-verify` y cierre formal
  - **DoD:**
    - [x] Todos los AC (AC1-AC6, AC-E1, AC-E2) verificados con evidencia — 8/8 cumplidos
    - [x] `acceptance.md` generado
    - [x] `specs/.active` limpiado

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
