# Tasks 0020-m — Ordenar la tabla de la Base de Alumnos B por columna

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-10-02

---

## Fase 1 — Modelo y núcleo funcional

- [x] **T1.1** — Tipos `AlumnoSortField`, `AlumnoListSort`, `AlumnoListFilters.sort` y
  `AlumnoTableRow.fechaIngresoIso` en `alumno-table-row.model.ts`
  - **AC ref:** AC6, AC9
- [x] **T1.2** — `alumnos-sort.utils.spec.ts` primero (TDD)
  - **AC ref:** AC1, AC6, AC7, AC8, AC10, AC-E1, AC-E2
- [x] **T1.3** — `alumnos-sort.utils.ts` con los tests en verde

## Fase 2 — Facade

- [x] **T2.1** — `AdminAlumnosFacade` expone `fechaIngresoIso`; spec actualizado (`sort: null`
  en los filtros vacíos)
  - **AC ref:** AC6, AC9

## Fase 3 — UI

- [x] **T3.1** — `alumnos-list-content`: señal `sort`, `sortedAlumnos`, títulos de columna como
  botones con indicador y `aria-sort`, vuelta a la primera página
  - **AC ref:** AC1–AC5, AC10, AC-E3
- [x] **T3.2** — Control "Ordenar por" para la vista de tarjetas
  - **AC ref:** AC11
- [x] **T3.3** — `alumnos-list-content.component.spec.ts`
  - **AC ref:** AC5, AC9

## Fase 4 — Validación

- [x] **T4.1** — Casos G03 en `e2e/alumnos-b-lista.spec.ts` en verde (4 casos nuevos, 30/30)
- [x] **T4.2** — `npx vitest run` en verde (3003)
- [x] **T4.3** — `npm run lint:arch` sin errores y sin sumar avisos (178)
- [x] **T4.4** — Revisión en el navegador (tabla, tarjetas, modo oscuro, 375 px)

## Fase 5 — Cierre

- [x] **T5.1** — `acceptance.md` con evidencia por AC
- [x] **T5.2** — Índices (`npm run indices:sync`) y `npm run assignments:sync`
- [x] **T5.3** — Decisión G03 marcada como implementada en `fix-264-m`; `specs/.active` de
  vuelta al track paraguas
- [x] **T5.4** — Visto bueno visual del owner (incluye D1 y D2), dado el 2026-10-02 → spec `done` en `ROADMAP.md`

## Tareas descubiertas durante la implementación

- [x] El ícono de orden dentro del flujo ensanchaba la tabla y cortaba "Acciones" a 1600 px →
  ícono en `position: absolute`.
- [x] El botón de sentido desbordaba la tarjeta a 375 px → elemento aparte de la barra.
