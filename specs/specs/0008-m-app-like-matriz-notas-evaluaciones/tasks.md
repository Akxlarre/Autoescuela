# Tasks 0008-m — App-like: matriz de notas (Evaluaciones profesional)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-10

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Extracción del Dumb compartido (sin app-like todavía)

- [x] **T1.1** — Documentar el CSS custom sticky existente antes de tocar nada
  - **AC ref:** soporta AC2 (no regresión del scroll bidireccional)
  - **DoD:**
    - [x] Comentario ampliado en `evaluaciones-profesional-content.component.ts` explicando el
      header sticky y la columna de alumno sticky (ya existía parcial en admin, se preservó)
    - [x] Cero cambios de comportamiento en este paso

- [x] **T1.2** — Escribir `evaluaciones-profesional-content.component.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC-E1
  - **DoD:**
    - [x] 29 tests cubriendo `computed()` (promedioVariant, hero*), helpers de badge/estado,
      normalización de `onGradeChange`, y las acciones que emiten outputs
    - [x] Tests escritos antes del componente, verificados en rojo antes de implementar

- [x] **T1.3** — Crear `shared/components/evaluaciones-profesional-content/evaluaciones-profesional-content.component.ts`
  - **AC ref:** AC4, AC5
  - **DoD:**
    - [x] OnPush, solo `input()`/`output()` — sin `inject()` de Facades (solo
      `ConfirmModalService`/`GsapAnimationsService`, servicios transversales — mismo patrón que
      `cuadratura-content`/`user-panel`)
    - [x] Template y lógica movidos de `AdminProfesionalEvaluacionesComponent` tal cual, más 2
      fixes de paridad detectados en el camino: color de avatar (`text-brand`→`text-text-primary`,
      secretaria violaba la regla 3-2-1 de marca) y CTA "Crear promoción" en el estado vacío
      (existía en admin, faltaba en secretaria)
    - [x] 29/29 tests pasan
    - [x] Documentado en `indices/COMPONENTS.md` (pendiente de sync final, ver Fase 5)

- [x] **T1.4** — Convertir `AdminProfesionalEvaluacionesComponent` en wrapper delgado
  - **AC ref:** AC4
  - **DoD:**
    - [x] Inyecta `EvaluacionesProfesionalFacade` + `BranchFacade`, pasa signals como inputs
    - [x] Verificado visualmente con Playwright — idéntico a antes de la extracción
    - [x] `npm run test:ci` sigue verde (1936/1936)

- [x] **T1.5** — Convertir `SecretariaProfesionalNotasComponent` en wrapper delgado (mismo Dumb)
  - **AC ref:** AC4, AC5
  - **DoD:**
    - [x] Badge de estado ya no diverge — confirmado visualmente (ícono y texto separados)
    - [x] `confirmarNotas`/`ConfirmModalService`: **no había diferencia de permisos** — ambos
      componentes originales ya tenían el mismo método `confirmarNotas()` completo. No se ocultó
      ni deshabilitó nada.
    - [x] Comportamiento verificado visualmente equivalente a admin

---

## Fase 2 — Patrón app-like (ambos modos)

- [x] **T2.1** — Fill-screen en modo "aterrizaje" (grupos de promoción)
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] Todos los `@for` de grupos de promoción envueltos en un único wrapper
      `.bento-banner.bento-fill flex flex-col overflow-y-auto`
    - [x] **Desviación consciente del plan**: NO se usó `sliceByBudget`/`visibleWithLoadMore`.
      `indices/APP-LIKE-ROLLOUT.md:67` (la auditoría específica de esta página, más informada que
      la mención genérica del plan) ya prescribía "envolver TODOS los `@for` de promo-groups en un
      único wrapper `.bento-fill`" — sin paginación. El wrapper único con `overflow-y-auto` ya
      resuelve la densidad variable sin inventar un límite arbitrario de promociones visibles.
      Justificación registrada acá para trazabilidad.
    - [x] Desktop: shell 100vh sin scroll de documento, scroll interno del wrapper (verificado con
      probe JS: `documentScrolls: false`, `.bento-fill` con `contain: size`)
    - [x] Mobile (390×844): revierte a scroll nativo del shell (`.shell-content`,
      `scrollsInternally: true`) — verificado con Playwright
    - [x] Sin lógica de densidad nueva → no se extendió T1.2 (no aplica)

- [x] **T2.2** — Fill-screen en modo "grilla" sin romper el scroll bidireccional sticky
  - **AC ref:** AC2, AC3, AC-E2
  - **DoD:**
    - [x] Integrado con `--fill-screen` (no `-kpi`: el KPI strip vive dentro del wrapper único, no
      como fila top-level separada) + `.bento-fill`. `.gradebook-scroll` pasó de `max-height:62vh`
      fijo a `flex:1 1 auto` — llena el resto del espacio disponible en vez de un tope arbitrario
    - [x] Header sticky y columna de alumno sticky verificados con Playwright: `position: sticky`
      + `top:0`/`left:0` intactos tras el cambio
    - [x] Desktop: shell 100vh sin scroll de documento; Mobile: scroll nativo del shell
    - [x] `force-compact` no verificado explícitamente con drawer abierto en esta sesión — ver
      Deuda técnica en acceptance.md

---

## Fase 3 — Unificación de nombre y ruta

- [x] **T3.1** — Renombrar ruta de secretaria en `app.routes.ts`
  - **AC ref:** AC7
  - **DoD:**
    - [x] `profesional/notas` → `profesional/evaluaciones`
    - [x] Sin redirect (decisión del owner)
    - [x] Grep de `profesional/notas` fuera de `src/app/features` → solo referencias legítimas
      (import path del folder físico, que no se renombra por decisión out-of-scope; y
      documentación histórica en `specs/`/`indices/` que no se reescribe)

- [x] **T3.2** — Actualizar `menu-config.service.ts` y fallback de título
  - **AC ref:** AC6, AC8
  - **DoD:**
    - [x] Label secretaria: `'Calificaciones'` → `'Evaluaciones'` (verificado en vivo navegando
      con `secretaria2@test.com`)
    - [x] `routerLink` → `/app/secretaria/profesional/evaluaciones`
    - [x] Fallback de título ahora vive en el Dumb compartido (`heroTitle` computed) — ya decía
      `'Evaluaciones'` desde T1.3, no necesitó cambio adicional

---

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` corre limpio (encontró y corrigió 1 regresión real: ARCH-15
  pill ad-hoc en los badges de promedio — migrados a `<app-badge>`)
- [x] **T4.2** — `npm run test:ci` corre verde (153 archivos / 1936 tests, 2 archivos / 5 tests
  skipped preexistentes, 0 fallos)
- [x] **T4.3** — QA manual (Playwright MCP)
  - **DoD:**
    - [x] Ambas rutas, ambos modos, en 390×844, 1280×800, 1440×900 y 1280×768
    - [x] Comparación lado a lado admin vs secretaria con el mismo dato (promoción 275, curso A2,
      1 alumno) — capturas idénticas, AC4 confirmado visualmente
    - [x] AC5 confirmado en secretaria (íconos y texto separados en todos los badges)
    - [x] AC6/AC7/AC8 confirmados navegando por el menú real como `secretaria2@test.com`
    - [x] Evidencia documentada en `acceptance.md`
    - **Bug real encontrado y corregido durante el QA**: la primera versión del wrapper
      `.bento-fill` (sin la clase `.bento-banner`) colapsaba a ~53px de ancho — sin
      `grid-column:1/-1` el elemento solo ocupaba 1 columna del grid en vez de todo el ancho.
      Corregido agregando `.bento-banner` junto a `.bento-fill` (mismo patrón ya usado en
      `pre-inscritos-content`).
- [x] **T4.4** — `/spec-verify` ejecutado — ver `acceptance.md`

---

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/` (`/sync-indices`): auto-indexer corrido (COMPONENTS,
  FACADES, STYLES, ROUTES, USAGE-MAP), + entradas manuales en `COMPONENTS.md` (nuevo Dumb
  compartido + los 2 wrappers actualizados) y `APP-LIKE-ROLLOUT.md` (familia "matriz de notas"
  marcada cerrada, par "archivo" señalado pendiente para ASG-b-081)
- [x] **T5.2** — Marcar spec como `done` en `ROADMAP.md` y en `spec.md`
- [x] **T5.3** — Limpiar `specs/.active`

**Rondas adicionales de QA visual con el owner (post-cierre inicial de Fase 4), antes del cierre
real de la spec:**
- Ronda 3: bug real de layout (cards de curso recortadas — `shrink-0` faltante en los wrappers de
  promoción dentro de `.bento-fill`)
- Ronda 4: skeleton no replicaba la cantidad real de promociones + poca fidelidad visual del
  skeleton de tarjeta de curso
- Ronda 5: paginación de 2 promociones a la vez en layout desktop (antes: scroll libre cortaba
  tarjetas contra el borde) — `p-paginator`, sin paginar en layout compacto (drawer abierto)
- Ronda 6: rediseño a una sola card contenedora (antes: cada promoción + el paginador eran
  bloques visualmente desconectados)
- Ronda 7: promociones activas (`in_progress`) siempre antes que planificadas; segunda fila de
  cabecera con cursos/alumnos totales (reemplaza intento previo de barra de progreso); botón
  "volver" migrado al hero (`backClickable`) en vez de un botón propio

---

## Tareas descubiertas durante implementación

- [x] Fix del bug real de ARCH-15 (pills ad-hoc de promedio) → migrado a `<app-badge>`,
  `promedioBadgeVariant()` reemplaza `getPromedioClasses()`
- [x] Fix de paridad: avatar `text-brand`→`text-text-primary` (regla 3-2-1 de marca)
- [x] Fix de paridad: CTA "Crear promoción" faltante en el estado vacío de secretaria
- [x] Fix estructural: wrapper `.bento-fill` sin `.bento-banner` colapsaba a 1 columna del grid
- [x] **Ronda 2 (revisión visual del owner)**: skeleton genérico sin relación con el contenido →
  reemplazado por 2 skeletons realistas (aterrizaje y grilla)
- [x] **Ronda 2**: bug de superposición aterrizaje+skeleton al hacer clic en un curso (condiciones
  `@if` independientes) → input `selectedCursoId` nuevo para distinguir los 2 estados de carga
- [x] **Ronda 2**: orden de cursos A3 antes que A2 (Supabase sin `.order()`) → ordenado en
  `buildLanding()` por `courseCode`, con test de regresión
