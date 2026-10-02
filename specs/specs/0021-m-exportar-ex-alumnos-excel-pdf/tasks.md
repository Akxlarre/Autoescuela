# Tasks 0021-m — Exportar la lista de Ex-Alumnos B a Excel y PDF

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-10-02

---

## Fase 1 — Núcleo funcional

- [x] **T1.1** — `egresados-export.utils.spec.ts` primero (TDD) — AC2–AC6, AC-E2
- [x] **T1.2** — `egresados-export.utils.ts` con los tests en verde

## Fase 2 — UI y Facade

- [x] **T2.1** — `app-export-menu` (Dumb) — AC1, AC7, AC-E1
- [x] **T2.2** — `ExAlumnosFacade.exportEgresados()` + `isExporting` + spec — AC2, AC3, AC7, AC-E3
- [x] **T2.3** — `ex-alumnos-content`: menú en la barra, output con las filas filtradas + spec — AC4
- [x] **T2.4** — Smarts admin y secretaria cableados — AC8
- [x] **T2.5** — Base de Alumnos migrada a `app-export-menu` (D2)

## Fase 3 — PDF

- [x] **T3.1** — Decisión D1 del owner: Edge Function
- [x] **T3.2** — `_shared/table-pdf.ts` + test Deno (11 casos) + PDF de muestra revisado — AC3
- [x] **T3.3** — `export-table-pdf/index.ts` y llamada desde el Facade
- [x] **T3.4** — `export-table-pdf` desplegada (confirmado por el owner, 2026-10-02)
- [x] **T3.5** — "Exportar como PDF" probado contra la función desplegada: admin (16 filas) y
  secretaria (8 filas), respuesta 200 `application/pdf`, mismas filas que la pantalla, PDF abierto
  y revisado

## Fase 4 — Validación

- [x] **T4.1** — Caso T14 en `e2e/alumnos-b-ficha.spec.ts` (3 tests)
- [x] **T4.2** — `npx vitest run` en verde (3020)
- [x] **T4.3** — `npm run lint:arch` sin errores y sin sumar avisos (178)
- [x] **T4.4** — Revisión en el navegador (1600 px claro y oscuro, 375 px, ambas pantallas)

## Fase 5 — Cierre

- [x] **T5.1** — `acceptance.md`
- [x] **T5.2** — Índices y `npm run assignments:sync`
- [x] **T5.3** — Decisión T14 marcada como cerrada en `fix-264-m`; `specs/.active` de vuelta al
  track paraguas
- [x] **T5.4** — Visto bueno visual del owner (botón, menú y los dos archivos descargados), dado el 2026-10-02 → `done` en `ROADMAP.md`

## Tareas descubiertas durante la implementación

- [x] El PDF de `export-students` dibuja la cabecera de la tabla encima de la línea
  "Generado · Página" (queda tapada). En `table-pdf.ts` la cabecera va debajo del título. El de
  `export-students` no se tocó (archivo de `0009-i`).
