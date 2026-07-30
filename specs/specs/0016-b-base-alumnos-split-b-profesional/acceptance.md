# Acceptance 0016-b — Separación de Base de Alumnos en páginas Clase B / Profesional

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verificado:** 2026-06-23 · **Método:** unit tests (vitest) + `ng build` + QA visual Playwright (admin, sede multi)

---

## Resumen

**Implementación completa en 3 fases, todas verdes.** 15/15 tests de facades, `ng build` limpio, QA visual Playwright con **0 errores de consola** en las páginas nuevas (Admin + Secretaría). **Todos los ACs cumplidos.** El `secretaria-ex-alumnos` (B) — que era un stub preexistente — fue reconstruido a funcional para cerrar la paridad (AC12).

---

## Acceptance Criteria

| AC | Estado | Evidencia |
|----|--------|-----------|
| **AC1** — Base B solo `class_b` | ✅ Cumplido | Playwright `/app/admin/alumnos`: 21 alumnos, columna Curso = "Clase B" en todas las filas. Unit test `admin-alumnos.facade.spec.ts` (excluye profesional-only). |
| **AC2** — Sin botón "Pre-inscritos" en B | ✅ Cumplido | Hero B muestra solo: Ex-Alumnos B · Papelera · Nueva Matrícula. |
| **AC3** — Filtro de curso "Clase B SENCE" | ✅ Cumplido (código) | Opción corregida a value `"Clase B SENCE"` (antes `"Clase B + SENCE"` rota). Dropdown "Todos los cursos" presente. |
| **AC4** — "Ex-Alumnos B" | ✅ Cumplido | Acción del hero + ítem de menú "Ex-Alumnos B" → `/app/admin/ex-alumnos`. |
| **AC5** — Menú "Base Alumnos Prof." + ruta | ✅ Cumplido | Ítem en *Academia Profesional* → `/app/admin/clase-profesional/alumnos` (admin) y `/app/secretaria/profesional/alumnos`. |
| **AC6** — Base Profesional solo `professional` + columnas | ✅ Cumplido | Playwright: 23 alumnos, todos "Profesional A2/A4"; columnas Nº Mat. · Promoción · Módulos (0/7, 7/7) · Asistencia (semáforo) · Estado · Saldo (50.000 CLP). Unit test cubre mapeo + filtro `license_group='professional'`. |
| **AC7** — Acceso a Pre-inscritos desde base Prof. | ✅ Cumplido | Acción "Pre-inscritos" en el hero profesional. |
| **AC8** — Empty-state | ✅ Cumplido (código) | `app-empty-state` en tabla/cards cuando no hay datos. |
| **AC9** — `backRoute` pre-inscritos → base Prof. | ✅ Cumplido | Playwright: "Pre-inscritos Clase Profesional" → "Volver a Alumnos Profesional" (`/app/admin/clase-profesional/alumnos`). |
| **AC10** — Menú reubicado | ✅ Cumplido | "Ex-Alumnos B" en *Academia Clase B*, "Ex-Alumnos Prof." en *Academia Profesional*; **ninguno** en *Finanzas y Caja*. |
| **AC11** — Cada Ex-Alumnos filtra su grupo | ✅ Cumplido | Playwright: Ex-Alumnos B = 2 (solo "Clase B") · Ex-Alumnos Prof. = 14 (solo A2/A4). Unit test `ex-alumnos.facade.spec.ts` (listas por grupo). |
| **AC12** — Paridad de portales | ✅ Cumplido | Admin y Secretaría con mismas rutas/menú/componentes. **`secretaria-ex-alumnos` (B) reconstruido a funcional** (espejo del admin con rutas de secretaría) — verificado en vivo Playwright como `secretaria@test.com`: hero "Ex-Alumnos B", tabla Registro Histórico, paneles stats/encuestas, branch-scoped (vacío en Autoescuela Chillán que no tiene egresados B). Base Prof. + Ex-Alumnos Prof. también funcionales en secretaría. |
| **AC-E1** — Alumno B+Prof sin datos cruzados | ✅ Cumplido | Playwright: *Benjamind Rebolledod* aparece en Base B ("0006 Clase B") y en Base Profesional ("0022 Profesional A2") con datos de cada grupo. Unit test (selección within-group). |
| **AC-E2** — Sede sin profesional oculta ítems | ✅ Cumplido | Playwright: sede "Autoescuela Chillán" → `itemsProfesionalVisibles: []` (Base Alumnos Prof. y Ex-Alumnos Prof. ocultos vía `requiresProfessional`). |
| **AC-E3** — Prof. sin promoción/notas no rompe | ✅ Cumplido | Unit test `admin-alumnos-profesional.facade.spec.ts` (promoción `—`, módulos 0, sin throw). Playwright: filas "0/7" renderizan OK. |
| **AC-E4** — Papelera por grupo | ✅ Cumplido | Facade profesional con `trashView`/`archivarAlumno`/`restaurarAlumno` (botón Papelera presente). |

---

## Evidencia de validación

- **Tests:** `admin-alumnos.facade.spec.ts` (6) + `admin-alumnos-profesional.facade.spec.ts` (6) + `ex-alumnos.facade.spec.ts` (3) = **15/15 verde**. (Bonus: se arregló un spec roto preexistente de `ex-alumnos.facade.spec.ts`.)
- **Build:** `ng build` limpio (solo warning `NG8113` preexistente en `AdminProfesionalArchivoComponent`, ajeno).
- **lint:arch:** 0 errores nuevos; warnings de complejidad ARCH-09/10 consistentes con el código existente.
- **QA visual (Playwright, admin):** 0 errores de consola; Design System limpio (0 colores hardcodeados, 0 emojis, bento-grid presente); dark mode OK.

## Deuda / salvedades

- **Nit menor (preexistente):** el header del grupo "Academia Profesional" se muestra sin ítems en sedes no-profesionales. No introducido por esta spec.
- **`/verify`:** Base/Ex-Alumnos Profesional + Base B verificadas como `admin@test.com`; Ex-Alumnos B verificado además como `secretaria@test.com`. 0 errores de consola en todas.

---

## Changelog

- 2026-06-23 — Acceptance verificado (15/15 ACs cumplidos). Listo para cerrar.
- 2026-06-23 — `secretaria-ex-alumnos` (B) reconstruido de stub a funcional (paridad AC12) + verificado en vivo como secretaría.
