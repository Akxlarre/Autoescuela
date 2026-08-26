# Tasks 0005-i — App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases`

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-26
> **Closed:** 2026-08-26 — confirmado por el usuario ("cierra la spec")

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Root fill-screen

- [x] **T1.1** — Aplicar `bento-grid--fill-screen-4` al root del componente
  - **AC ref:** AC1
  - **DoD:**
    - [x] `document.scrollHeight <= document.clientHeight` en desktop (≥1024px), verificado con
          `/verify` (Playwright, `getBoundingClientRect`, no solo captura visual)
    - [x] Ningún modificador `--fill-screen*` existente calzaba exacto (Riesgo #1 del plan) —
          se usó `--fill-screen-4` tal cual sin necesidad de tocar `_bento-grid.scss`; el
          subnav (fila 3, "variable") no se estiró de más en la práctica

## Fase 2 — Las 7 secciones a `.bento-fill`

- [x] **T2.1** — "Calendario de Clases" (la más atrasada, sin ningún `overflow` acotado antes)
  - **AC ref:** AC4
  - **DoD:** header `shrink-0` + tabla en `flex-1 min-h-0 overflow-y-auto`, validado con 30
        clases de datos reales — scroll interno confirmado sin scroll de documento
- [x] **T2.2** — "Cabecera" (la más compleja: grid 2 columnas + form SENCE/Horario)
  - **DoD:** mismo patrón, `app-async-btn` de Guardar sigue funcionando dentro del área scrolleable
- [x] **T2.3** — "Profesores por Módulo"
- [x] **T2.4** — "Lista de Clase"
- [x] **T2.5** — "Evaluaciones Clase Profesional"
- [x] **T2.6** — "Resumen Asistencia"
  - **AC ref (T2.2-T2.6):** AC2, AC5
  - **DoD:** las 6 secciones comparten exactamente el mismo wrapper
        (`bento-banner bento-fill card p-0 flex flex-col min-h-0`), confirmado consistente en
        `/verify` — mismo criterio de scroll interno en todas, ninguna solución ad-hoc

## Fase 3 — Paginación de Asistencia (Firma Diaria)

- [x] **T3.1** — Signals `selectedWeekIndex`/`totalWeeks`/`visibleWeek` + métodos
      `weekPrev()`/`weekNext()`
  - **AC ref:** AC3
  - **DoD:**
    - [x] Estado de UI puro en el Smart Component, sin tocar `LibroDeClasesFacade`
    - [x] Stepper prev/next (mismo patrón visual que `mesAnterior`/`mesSiguiente` de
          `historial-cuadraturas-content`), label "Semana X de Y"
    - [x] Solo se renderiza si `totalWeeks() > 1` (sin paginador ruidoso con 0-1 semanas)
- [x] **T3.2** — Reset de `selectedWeekIndex` al cambiar los datos de asistencia
  - **DoD:** `effect()` en el constructor que trackea `facade.asistenciaSemanal()` y resetea a 0
        — cubierto con test unitario (simula cambio de curso/promoción)
- [x] **T3.3** — Escribir `libro-de-clases.component.spec.ts` (TDD)
  - **DoD:**
    - [x] Tests PASAN (`npx vitest run` — 4/4 verdes)
    - [x] Cubre: semana correcta según índice, 0 semanas sin romper, bordes de
          weekPrev()/weekNext(), reset al cambiar datos
    - [x] Patrón `TestBed.runInInjectionContext(() => new Component())` (mismo que
          `admin-contabilidad-cuadratura.component.spec.ts`) — evita renderizar el template
          completo (PrimeNG + Dumb components no compilan en el pipeline de Vitest)

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` corre limpio
  - **DoD:** 0 errores, mismo baseline de 171 warnings (sin regresiones)
- [x] **T4.2** — `npx vitest run` (suite completa) corre verde
  - **DoD:** 2227 passed, 5 skipped, 1 failed (preexistente y no relacionado —
        `secretaria-contabilidad-cuadratura.component.spec.ts`, confirmado ya fallaba antes de
        esta sesión)
- [x] **T4.3** — `/verify` (Playwright MCP, admin real con datos reales)
  - **DoD:**
    - [x] Documento no scrollea en desktop (1280×800) en ninguna de las 7 secciones
    - [x] "Calendario de Clases" (30 clases) scrollea internamente, sin scroll de documento
    - [x] "Firma Diaria" pagina correctamente: Semana 1→2 de 6, label y contenido correctos
    - [x] 768px de alto (1440×768): layout usable, subnav con labels completos
    - [x] Mobile (390×844): stackeo nativo, sin fill-screen forzado
    - [x] Consola sin errores en ningún viewport
    - [ ] Ruta secretaria — bloqueada por `professionalBranchGuard` (fix-029, pre-existente,
          no relacionado a esta spec) redirigiendo la cuenta de prueba `secretaria@test.com`
          por no tener grant profesional en su sede; mismo componente `shared`, mismo fix
          aplica por construcción — ver Deuda técnica en `acceptance.md`
    - [ ] `force-compact` con drawer abierto — **N/A**, ver corrección de alcance en
          `acceptance.md` (esta página no abre ningún Drawer propio)

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/COMPONENTS.md` y `indices/APP-LIKE-ROLLOUT.md`
- [x] **T5.2** — Generar `acceptance.md` con evidencia
- [x] **T5.3** — Marcar spec como `done` en `ROADMAP.md` — confirmado por el usuario ("cierra la
      spec"), 2026-08-26.

---

## Tareas descubiertas durante implementación

- Ninguna fuera del alcance de la spec. Las 2 correcciones de contexto (subnav ya show/hide,
  fix-074 ya resuelto) se hicieron al reclamar la Asignación, antes de escribir `spec.md`.
