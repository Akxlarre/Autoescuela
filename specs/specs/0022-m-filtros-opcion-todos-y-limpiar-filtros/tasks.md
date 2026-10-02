# Tasks 0022-m — Opción "Todos" en los filtros y botón compartido "Limpiar filtros"

- [x] T1 — `withAllOption()` en `core/utils/filter-options.utils.ts` + tests.
- [x] T2 — `app-clear-filters-button` (Dumb, OnPush, `display: contents`).
- [x] T3 — Base de Alumnos B: opción "todos" en Curso/Estado/Expediente, botón, `resetFilters()` vuelve a la página 1; tests.
- [x] T4 — Alumnos Profesional, Ex-Alumnos Profesional (incluye período), Ex-Alumnos B (buscador + período), Pre-inscritos (reemplaza su "Limpiar" propio).
- [x] T5 — Flota, Secretarias, Relatores, Promociones (sin `showClear`), Contabilidad de cursos.
- [x] T6 — Auditoría, Pagos admin y secretaria migran al componente compartido.
- [x] T7 — Pagos recientes (el buscador ahora refleja el estado), Historial de ventas (sin `showClear`, incluye período).
- [x] T8 — Agenda semanal, Asistencia Clase B (incluye botones de estado), Certificación B y Profesional.
- [x] T9 — Nuevo comunicado: opción "Todas las sedes / Todos / Cualquiera", sin botón.
- [x] T10 — Tests de `hasActiveFilters`/limpiar en las pantallas con spec existente; `ng build`, `npm run test:ci`, `npm run lint:arch`.
- [x] T11 — `/verify` en Base de Alumnos B y Flota.
- [x] T12 — `indices/COMPONENTS.md`, `indices/UTILS.md` (indices:sync).
