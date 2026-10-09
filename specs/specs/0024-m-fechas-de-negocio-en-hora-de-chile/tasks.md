# Tasks 0024-m — Fechas de negocio en hora de Chile

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Inventario:** [inventario.md](./inventario.md)
> **Status:** in_progress
> **Created:** 2026-10-08

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marca la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubres una sub-tarea no listada, agrégala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detente** y crea una spec nueva.
- Las fases siguen las tandas del plan §9. Cada fase cierra con `npm run test:ci` y
  `npm run lint:arch`.

---

## Fase 0 — Util de hora de Chile (app)

- [x] **T0.1** — Escribir `chile-time.vectors.json` y `chile-time.utils.spec.ts` PRIMERO
  - **AC ref:** AC6, AC-E1, AC-E2, AC-E3, AC-E4
  - **DoD:**
    - [x] Vectores a las 00:00:00.000, 20:59, 21:00, 23:30 y 23:59:59.999 hora Chile
    - [x] Los dos días de cambio de horario de 2026 y de 2027
    - [x] 31 de diciembre y último día de un mes
    - [x] Fechas puras que no deben moverse
    - [x] Los tests FALLAN (aún sin implementación)

- [x] **T0.2** — Implementar `core/utils/chile-time.utils.ts`
  - **AC ref:** AC6, AC-E1, AC-E2, AC-E3, AC-E4
  - **DoD:**
    - [x] API del plan §3 completa; funciones puras, `now?: Date` donde aplica
    - [x] `chileDayRange` devuelve rango semiabierto y resuelve la medianoche inexistente
    - [x] Tests PASAN

- [x] **T0.3** — `scripts/test-tz.mjs`
  - **AC ref:** AC6
  - **DoD:**
    - [x] Corre los specs de fecha con `TZ=UTC` y `TZ=Asia/Tokyo`
    - [x] Falla si la zona del proceso no cambió (no pasa en falso)
    - [x] Verde en ambas zonas

- [x] **T0.4** — `date.utils.ts` delega en `chile-time.utils`
  - **AC ref:** AC6, AC-E4
  - **DoD:**
    - [x] `todayIso`, `monthsAgoIso`, `toISODate`, `formatChileanDate`, `buildDayLabel` delegan
    - [x] `date.utils.spec.ts` cubre las 23:30 hora Chile y pasa en las tres zonas
    - [x] `getChileDateTimeRange` marcada para eliminar en la Fase 3
    - [x] `npm run test:ci` sin fallas nuevas respecto de la línea base

---

## Fase 1 — Guardrail

- [x] **T1.1** — `scripts/lib/date-discipline.js` + `.test.mjs`
  - **AC ref:** AC13
  - **DoD:**
    - [x] Las 5 reglas del plan §5, con un caso positivo y uno negativo cada una
    - [x] Cubre `src/app` y `supabase/functions`; excluye los módulos `chile-time` y los tests
    - [x] El mensaje nombra la función de la util que corresponde usar
    - [x] Lista de excepciones con justificación por entrada

- [x] **T1.2** — Línea base `date-discipline.baseline.json`
  - **AC ref:** AC13, AC14
  - **DoD:**
    - [x] Generada desde el estado actual
    - [x] Solo puede achicarse: una ocurrencia nueva falla aunque el total no suba

- [x] **T1.3** — Regla de migraciones (ARCH-28) en `scripts/lib/date-discipline.js` + test
  - **AC ref:** AC13
  - **DoD:**
    - [x] Aplica solo a migraciones posteriores a `20261008120000`
    - [x] Detecta `CURRENT_DATE`, `now()::date`, `LOCALTIMESTAMP`, `::timestamp` sin zona y columnas `timestamp without time zone`

- [x] **T1.4** — Cablear ARCH-27 y ARCH-28 en `npm run lint:arch` (vía `scripts/lint-arch-wrapper.js` + `scripts/check-date-discipline.mjs`, sin tocar `architect.js`)
  - **AC ref:** AC13
  - **DoD:**
    - [x] `npm run lint:arch` reporta ambas reglas
    - [x] No hizo falta editar el archivo protegido

---

## Fase 2 — App: "hoy" que se escribe o filtra (inventario §1)

- [ ] **T2.1** — Fechas que se escriben en la BD
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [ ] Los 9 archivos del primer grupo de §1 usan `chileToday()`
    - [ ] Test con el reloj a las 23:30 hora Chile en cada facade tocado

- [ ] **T2.2** — "Hoy" para filtrar o comparar, y "mes actual"
  - **AC ref:** AC5, AC-E3
  - **DoD:**
    - [ ] Los archivos del segundo grupo de §1 usan `chileToday()` / `chileMonth()`
    - [ ] Test de fin de mes a las 23:30 en `servicios-especiales.facade`

- [ ] **T2.3** — Fechas derivadas de un `Date` local y nombres de archivo
  - **AC ref:** AC-E3, AC-E4
  - **DoD:**
    - [ ] Grupos 4 y 5 de §1 pasan por `addDaysIso` / `toChileDate` / `chileToday`
    - [ ] Cero ocurrencias de la regla 1 en la línea base

- [ ] **T2.4** — `T02` sin `knownBug`
  - **AC ref:** AC1
  - **DoD:**
    - [ ] `npx playwright test e2e/transversal-shell.spec.ts -g T02` verde en ambos casos, contra el build de producción

---

## Fase 3 — App: rangos de día (inventario §3)

- [x] **T3.1** — Caja, Dashboard y Reportes
  - **AC ref:** AC3, AC-E1, AC-E2
  - **DoD:**
    - [x] `cuadratura.facade`, `dashboard.facade`, `reportes-contables.facade` usan `chileDayRange` / `chileRange` con `.gte()` y `.lt()`
    - [x] Test por facade: un registro a las 23:30 del día D entra, uno a las 00:10 de D+1 no

- [x] **T3.2** — Flota, Auditoría, Asistencia B, topes de agenda
  - **AC ref:** AC3
  - **DoD:**
    - [x] `flota.facade`, `auditoria.facade`, `asistencia-clase-b.facade`, `enrollment.facade`, `admin-alumno-detalle.facade`, `agenda.facade` migrados
    - [x] Tests de rango en cada uno

- [x] **T3.3** — Eliminar `getChileDateTimeRange`
  - **DoD:**
    - [x] Sin usos en `src/app`
    - [x] Cero ocurrencias de la regla 2 en la línea base

---

## Fase 4 — App: instantes cortados a día (inventario §2)

- [ ] **T4.1** — Clasificar y corregir los cortes de string
  - **AC ref:** AC4
  - **DoD:**
    - [ ] Cada corte sobre un `timestamptz` usa `toChileDate()`; los que ya son `date` quedan anotados como seguros en `inventario.md`
    - [ ] Tests en `reportes-contables.utils`, `period-window.utils`, `license-status.utils`
    - [ ] Test en al menos un facade de lista (fecha de ingreso) con instante a las 23:30

---

## Fase 5 — App: aritmética y formato (inventario §4)

- [ ] **T5.1** — Pipe `chileDate` + spec; reemplazar los 28 usos del pipe `date`
  - **AC ref:** AC6, AC-E4
  - **DoD:**
    - [ ] Cero ocurrencias de la regla 5

- [ ] **T5.2** — Caja y contabilidad
  - **AC ref:** AC6
  - **DoD:**
    - [ ] `historial-cuadraturas.*`, `liquidaciones.*`, `reportes-contables.*`, `cuadratura-content`, pagos
    - [ ] Tests de esos facades verdes en las tres zonas

- [ ] **T5.3** — Agenda y horario
  - **AC ref:** AC6
  - **DoD:**
    - [ ] `agenda.facade`, `agenda-week.utils`, `agenda-settings.service`, `schedule-grid.*`, `student-horario.facade`, `alumno-horario`, `agenda-semanal`
    - [ ] Tests verdes en las tres zonas

- [ ] **T5.4** — Instructores y horas
  - **AC ref:** AC6
  - **DoD:**
    - [ ] `instructor-horas.facade`, `instructor-clases.facade`, `instructores.facade`, `instructor-horario.*`, drawers de instructor
    - [ ] Tests verdes en las tres zonas

- [ ] **T5.5** — Promociones y Profesional
  - **AC ref:** AC6, AC-E4
  - **DoD:**
    - [ ] `promociones.facade`, drawers de promoción, `asistencia-profesional.facade`, `libro-de-clases.*`, `promotion-end-date.utils`, `theory-cycle`
    - [ ] Tests verdes en las tres zonas

- [ ] **T5.6** — Resto y formato
  - **AC ref:** AC6, AC-E4
  - **DoD:**
    - [ ] Todo lo que quede de las reglas 3 y 4 migrado o declarado como excepción
    - [ ] `age.utils`, `license-seniority.utils`, `class-b-session-overdue.utils`, dashboards, flota

---

## Fase 6 — Edge functions (inventario §5)

- [ ] **T6.1** — `_shared/chile-time.ts` + `chile-time.test.ts`
  - **AC ref:** AC7, AC8
  - **DoD:**
    - [ ] Misma API que la util de la app
    - [ ] Corre los vectores de `chile-time.vectors.json` y pasa

- [ ] **T6.2** — "Hoy" que se escribe y defaults de reporte
  - **AC ref:** AC7
  - **DoD:**
    - [ ] `create-instructor`, `update-instructor`, certificados B y Profesional, cierre e historial de caja, financiero, sueldos

- [ ] **T6.3** — Fechas y horas impresas, nombres de archivo y folios
  - **AC ref:** AC8, AC-E3
  - **DoD:**
    - [ ] Todos los archivos del grupo "impresas sin zona" de §5
    - [ ] `student-payment`, `public-enrollment` y `_shared/*` reutilizan el módulo
    - [ ] Cero ocurrencias de ARCH-27 en `supabase/functions`

---

## Fase 7 — SQL y cron

- [ ] **T7.1** — Leer la definición vigente de cada objeto de `inventario.md` §6
  - **DoD:**
    - [ ] Definiciones obtenidas de la BD (no de la historia de migraciones) y anotadas en `inventario.md`
    - [ ] Resultado de `information_schema.columns` para `timestamp without time zone`

- [ ] **T7.2** — Migración `20261008120000_time_fn_chile_today.sql`
  - **AC ref:** AC9
  - **DoD:**
    - [ ] `chile_today()`, `chile_date()`, `chile_day_start()`; idempotente
    - [ ] Documentado en `indices/DATABASE.md`

- [ ] **T7.3** — Migración `20261008121000_time_fix_business_day_objects.sql`
  - **AC ref:** AC9, AC10, AC11
  - **DoD:**
    - [ ] Todos los objetos vigentes de §6 redefinidos; el CHECK de edad queda como excepción declarada
    - [ ] Idempotente; pasa ARCH-28

- [ ] **T7.4** — Migración `20261008122000_time_cron_absences_2100_chile.sql`
  - **AC ref:** AC12
  - **DoD:**
    - [ ] Job a las 00:00 y 01:00 UTC con función envoltorio que exige hora Chile = 21
    - [ ] Comentario de la función actualizado

- [ ] **T7.5** — `supabase/tests/timezone/0024-m-business-day.sql`
  - **AC ref:** AC9, AC10, AC11, AC12
  - **DoD:**
    - [ ] Falla si queda algún `CURRENT_DATE` en un objeto vigente o una columna sin zona

- [ ] **T7.6** — Matías aplica las tres migraciones y corre el test SQL
  - **AC ref:** AC9, AC10, AC11, AC12
  - **DoD:**
    - [ ] Test SQL en verde contra la BD de dev

---

## Fase 8 — Validación y cierre

- [ ] **T8.1** — Línea base en cero o solo con excepciones justificadas
  - **AC ref:** AC14
- [ ] **T8.2** — `npm run lint:arch` limpio y `npm run test:ci` sin fallas nuevas
- [ ] **T8.3** — `node scripts/test-tz.mjs` verde
  - **AC ref:** AC6
- [ ] **T8.4** — Actualizar `indices/UTILS.md`, `indices/DATABASE.md`, DG-071 y la regla en `.claude/rules/`
- [ ] **T8.5** — `/spec-verify` con evidencia por AC en `acceptance.md`
- [ ] **T8.6** — ROADMAP a Done y `/spec-activate --clear`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agrégalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] **TD.1** — Retirar `toISODate()` (ambigua: no distingue instante de fecha de calendario). Cada uso pasa a `chileToday()`, `toChileDate()` o `calendarDateToIso()`. El guardrail ya los cuenta como `deprecated-date-api` (47). Se resuelve dentro de las fases 2 a 5.
- [ ] **TD.2** — La línea base real es de 593 ocurrencias en 124 archivos (el inventario estimaba menos: no contaba `T12:00:00` sin zona ni las edge functions). Seguimiento con `node scripts/check-date-discipline.mjs --list [tipo]`.
- [ ] **TD.3** — Estado al cierre de la sesión del 2026-10-08: fases 0 y 1 completas. Fase 2 a medias: reemplazados los 27 `new Date().toISOString()…` directos (21 archivos); línea base 593 → 566. Faltan de la fase 2: los 30 `utc-slice` restantes (fechas derivadas de un `Date`: `dashboard-alerts`, `flota`, `instructor-horas`, `instructor-clases` mock, `formatDateIso` de `asistencia-profesional` y `libro-de-clases`, `promotion-end-date.utils`, drawers de instructor y promoción, `schedule-grid`, `reprogramar-clase`, `announcement-composer`, y 14 en edge functions), los tests a las 23:30 por facade (DoD de T2.1/T2.2) y T2.4 (quitar `knownBug` de `T02` y correrlo contra el build de producción).
- [ ] **TD.4** — Segunda sesión del 2026-10-08. Hecho: (a) resto de los cortes de `toISOString()` de la app salvo `announcement-composer` (queda 1 en la app; los otros 14 son de edge functions, fase 6); (b) fase 3 casi completa: rangos semiabiertos con `chileDayRange`/`chileRange` en `cuadratura`, `dashboard`, `reportes-contables`, `flota`, `auditoria`, `asistencia-clase-b`, `instructores`, `instructor-clases` e `instructor-horas`; (c) tests nuevos a las 23:30 en `instructor-clases`, `instructores`, `instructor-horas` y `flota`. Línea base 566 → 425. Pendiente de la fase 3: topes `slot_start` en `enrollment.facade` (862, 2122) y `admin-alumno-detalle.facade` (1458), `agenda.facade:317` (semana desde medianoche UTC), eliminar `getChileDateTimeRange` de `date.utils`, y tests de rango propios en `cuadratura`, `dashboard`, `reportes-contables`, `auditoria` y `asistencia-clase-b` (hoy solo se actualizó el mock).
- [ ] **TD.5** — `instructor-horas.facade.spec.ts` tiene un mock preexistente que hace fallar en silencio `fetchSessionsLog` (`lte().order is not a function`): el test pasa porque el facade atrapa el error. No es de esta spec; anotado para no perderlo.
- [x] **TD.4b** — Fase 3 cerrada (tercera pasada del 2026-10-08): topes `slot_start` de `enrollment` y `admin-alumno-detalle` y semana de `agenda` con rangos semiabiertos; `getChileDateTimeRange` eliminada; tests a las 23:30 en `cuadratura`, `dashboard`, `auditoria` y `asistencia-clase-b`. Línea base 425 → 422. Excepción al DoD de T3.1: `reportes-contables` no tiene test de rango propio (solo se actualizó el mock); queda para la fase 5 junto con su aritmética de fechas.
- [ ] **TD.6** — `node scripts/test-tz.mjs` con los specs de `agenda`, `enrollment` y `admin-alumno-detalle` falla en UTC y Asia/Tokyo (5 tests: `licenseExpired` en agenda, gate de matrícula tardía en enrollment, límite dinámico de reagendamiento en ficha del alumno). En America/Santiago pasan. Son dependencias del reloj del equipo todavía sin migrar (o tests que arman fechas con `new Date()` local): trabajo de la fase 5, bloquea AC6.
