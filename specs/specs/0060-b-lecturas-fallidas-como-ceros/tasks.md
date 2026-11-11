# Tasks 0060-b — Una lectura que falla se ve como error, no como ceros o "sin datos"

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-11-10

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y se termina en una sentada.
- Se marca `[x]` apenas pasa su DoD (no antes, no en bloque).
- Las fases son las etapas del plan: **cada fase es un PR** (la fase 2 son dos).
- Si aparece un facade que no está listado, se agrega a la fase que le corresponda antes de tocarlo.
- Algo fuera del alcance de la spec (Caja, Agenda, un wrapper, cálculo del cierre en el servidor)
  → **detenerse** y abrir asignación aparte.

## DoD común de las tareas de facade ("DoD-F")

Las tareas T1.x a T4.x migran un facade y sus pantallas. Todas cumplen esto, además de lo propio:

- [ ] Tests en rojo antes del cambio, en verde después: primera carga con `{ error }`, cambio de
  filtro o sede con `{ error }`, refresco con `{ error }`, reintento que sale bien, y una de
  varias consultas con `{ error }` (los que apliquen al facade)
- [ ] Toda lectura lanza: `assertReadOk(...)` o `if (error) throw error` antes de usar `data`
- [ ] Caso A: el facade deja `error()` con mensaje propio de la pantalla y los datos en estado
  inicial; la pantalla muestra `app-empty-state` con "Reintentar" en vez de lista y KPIs
- [ ] Caso B: un refresco que falla no borra lo visible; si la pantalla tiene una acción que guarda
  un valor calculado con esos datos, queda bloqueada y se muestra `app-alert-card`
- [ ] El chequeo `isCurrent()` del request guard sigue después del `throw`
- [ ] Botón "Reintentar" con `data-llm-action`
- [ ] Facade fuera de `PENDING` en `unchecked-reads.guard.spec.ts`
- [ ] Sus pantallas sin `knownBug` en el bloque X01 de `e2e/transversal-shell.spec.ts`
- [ ] Recorrido con red normal y cada rol que usa la pantalla: no aparece ningún error nuevo

---

## Fase 0 — Base (PR 1)

- [x] **T0.1** — `assertReadOk` en `core/utils/db-error.utils.ts`
  - **AC ref:** AC1
  - **DoD:**
    - [x] `db-error.utils.spec.ts` primero: con `error` lanza ese error; sin `error` devuelve `data`
      (8 casos nuevos en rojo antes del código, en verde después)
    - [x] Tipado: devuelve el tipo de `data` sin `null` solo donde la consulta lo garantiza (lista
      sin `null`, `maybeSingle()` con `null`, `any` sigue `any`; probado que el test de tipos
      falla con un tipo incorrecto)
    - [x] Documentado en `indices/UTILS.md`
  - **Resultado (2026-11-10):** `npm run test:ci` 4791 ✅, `lint:arch` 0 errores, `tsc` de specs
    sin errores nuevos (los 120 que reporta ya estaban en `main`).

- [x] **T0.2** — Detector de lecturas sin chequeo (`unchecked-reads.guard.spec.ts`)
  - **AC ref:** AC1
  - **DoD:**
    - [x] Tests del detector: F1 en una línea, F1 en varias líneas, F2 (`Promise.all` con `.data`
      sin `.error`), lectura con `error` capturado, lectura con `assertReadOk`, y no marca una
      escritura. Además: `await q` de un builder armado antes, renombres (`data: rows`,
      `error: e`), `throwOnError()`, patrones `{ data }` dentro de la tupla de un `Promise.all`,
      y que el chequeo de `.error` se busque solo dentro del mismo método (13 casos)
    - [x] Misma estructura que `unchecked-writes.guard.spec.ts`
  - **Límite conocido:** no ve una desestructuración anidada (`{ data: { session } }`, solo la
    usa `auth.getSession()`), ni que la pantalla muestre un error que el facade sí captura (F3).

- [x] **T0.3** — Lista `PENDING` con dueño por etapa
  - **AC ref:** AC1, AC9
  - **DoD:**
    - [x] Cada facade que el detector marca está en `PENDING` con la etapa que lo cubre (31)
    - [x] Test que falla si un facade en `PENDING` ya no tiene lecturas sin chequeo, y otro que
      falla si una entrada nombra un facade que no existe
    - [x] `cuadratura.facade.ts` y `agenda.facade.ts` pasan sin estar en la lista
    - [x] Si la lista difiere de §2 del plan, se actualiza el plan: se sumó `student-home`
      (etapa 3a); `reportes-contables` y `servicios-especiales` pasan el guard (son F3)
  - **Resultado (2026-11-10):** guard 78/78, `npm run test:ci` 4869 ✅, `lint:arch` 0 errores.

- [x] **T0.4** — Bloque "X01. Pantallas sin red" en `e2e/transversal-shell.spec.ts`
  - **AC ref:** AC8
  - **DoD:**
    - [x] Corta `rest/v1` y `functions/v1` con `page.route(... abort)` y navega por el menú (SPA).
      La red se corta recién cuando el ítem del menú ya está visible: los de Clase Profesional
      aparecen después de una consulta y, cortando antes, nunca aparecían
    - [x] Una fila por pantalla de la tabla X01 de `fix-190-b` (secretaria sede 2), más Clase
      Profesional y Anticipos (admin): 22 pantallas.
      **Quedan fuera:** los portales de instructor y alumno (no hay cuentas E2E de esos roles) y
      Relatores y Asistencia Prof. (ocultos en el menú por el recorte del piloto). Sus facades
      siguen cubiertos por el guard; su pantalla se verifica a mano en su etapa
    - [x] Agenda y Caja Diaria pasan; las no migradas quedan como `knownBug`
    - [x] Corre contra el build de producción (`ng serve -c production`)
  - **Resultado (2026-11-10):** 48/48 con `--repeat-each=2`. Sin marcas
    (`E2E_SHOW_KNOWN_BUGS=1`) las 12 marcadas fallan por no mostrar "Reintentar".
    **10 pantallas ya cumplen**, varias por tracks posteriores a X01: Agenda, Caja Diaria,
    Dashboard, Servicios especiales, Alumnos, Ex-Alumnos, Documentos (`fix-473-m`), Flota,
    Promociones y Base Alumnos Prof.
    **12 quedan marcadas:** Pagos, Reportes, Liquidaciones, Anticipos (etapa 1); Cursos
    singulares, Certificados (etapa 2); Asistencia, Instructores, Comunicación (etapa 3a);
    Certificados Prof., Archivo, Libro de Clases (etapa 3b).
  - **Para correrlo:** contra el build de producción en un puerto libre; si el 4200 lo ocupa otro
    checkout, Playwright lo reutiliza y prueba otro código.

- [x] **T0.5** — Corregir `swr-pattern.md` y `facades.md`
  - **AC ref:** AC2
  - **DoD:**
    - [x] El ejemplo de `refreshSilently()` no es un `catch` vacío y el de `fetchData()` revisa
      `error` (con `assertReadOk`). `initialize()` además marca `_initialized` solo si la carga
      salió bien, para que una primera carga fallida se reintente con skeleton
    - [x] Los casos A y B quedan enunciados como regla, con su criterio de aplicabilidad: "¿lo que
      está en pantalla responde a la misma pregunta que la consulta que falló?"
    - [x] Corrige además el typo del ejemplo (`refreshSilently(): {Promise<void>`)
    - [x] Pasa el Harness Gate (sin citar tracks: la regla se sostiene sola)
  - **Resultado (2026-11-10):** `swr-pattern.md` gana la sección "Errores de carga" (3 reglas,
    pantalla, cuándo agregar `_refreshFailed`) y dos prohibiciones; `facades.md` §4 muestra la
    lectura con su error y remite a `swr-pattern.md`.

- [x] **T0.6** — Gotcha e índices
  - **DoD:**
    - [x] Gotcha nuevo en `indices/DOMAIN-GOTCHAS.md`, par de DG-103: una lectura que falla no
      lanza (DG-123, con las dos formas: el Facade descarta el error / la pantalla no lo muestra)
    - [x] `npm run lint:arch` (0 errores) y `npm run test:ci` en verde (4869). Una primera corrida
      dio 1 falla que no se repitió en dos corridas más: test intermitente ajeno a esta etapa
  - **Etapa 0 cerrada (2026-11-10).**

---

## Fase 1 — Dinero (PR 2)

> Antes de empezar: avisar a Ignacio por `fix-073-i` y partir de `main` con sus PR mergeados.

- [ ] **T1.1** — `pagos.facade.ts` + `admin-pagos` y sus drawers
  - **AC ref:** AC3–AC7
  - **DoD:** DoD-F, más:
    - [ ] Las 8 lecturas (KPIs, deudores, recientes, desglose) lanzan; una que falle hace fallar la carga
    - [ ] `refreshSilently()` deja de tragar el error

- [ ] **T1.2** — `reportes-contables.facade.ts` + reportes de admin y secretaria
  - **AC ref:** AC3, AC4, AC6
  - **DoD:** DoD-F, más:
    - [ ] Encontrada la causa F3 (por qué mostró "Sin ingresos en este período" en X01)
    - [ ] Cambio de período que falla no deja el reporte del período anterior

- [ ] **T1.3** — `liquidaciones.facade.ts` + liquidaciones de admin y secretaria
  - **AC ref:** AC3, AC4, AC7
  - **DoD:** DoD-F, más:
    - [ ] `hoursRes`, `advancesRes` y `paymentsRes` se revisan (hoy solo `instrRes`)
    - [ ] "Registrar pago" queda bloqueado si las horas o los anticipos no cargaron

- [ ] **T1.4** — `dashboard.facade.ts` + `secretaria-dashboard`
  - **AC ref:** AC3, AC5
  - **DoD:** DoD-F

- [ ] **T1.5** — `enrollment-payment.facade.ts` y `anticipos.facade.ts`
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F

- [ ] **T1.6** — Validación de la etapa
  - **DoD:**
    - [ ] `/verify`: casos A y B en claro y oscuro; la página sigue app-like con el aviso visible
    - [ ] X01 de las pantallas de la etapa en verde contra el build de producción
    - [ ] `npm run lint:arch`, `npm run test:ci`, `node scripts/test-tz.mjs` de los specs tocados

---

## Fase 2 — Lecturas que alimentan una escritura o decisión (PR 3 y PR 4)

- [ ] **T2.1** — `enrollment.facade.ts` (PR 3, solo)
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F, más:
    - [ ] Las 22 lecturas clasificadas en `tasks.md` antes de tocarlas: bloquea el paso / aviso
    - [ ] Una lectura que decide un precio, un cupo o un horario detiene el paso con error
    - [ ] Suite E2E de matrícula presencial completa en verde

- [ ] **T2.2** — `enrollment-documents`, `public-enrollment`, `student-enrollment-context`, `admin-pre-inscritos`
  - **AC ref:** AC3
  - **DoD:** DoD-F, más:
    - [ ] Matrícula pública: el error se ve sin sesión iniciada

- [ ] **T2.3** — `admin-alumno-detalle.facade.ts` + ficha del alumno
  - **AC ref:** AC3, AC5, AC7
  - **DoD:** DoD-F, más:
    - [ ] La grilla de "Reprogramar" no dice "Sin disponibilidad" ante un error (pendiente de `fix-189-b`)

- [ ] **T2.4** — `cursos-singulares.facade.ts` y `servicios-especiales.facade.ts`
  - **AC ref:** AC3, AC4
  - **DoD:** DoD-F, más:
    - [ ] Encontrada la causa F3 de Servicios especiales (sus lecturas ya lanzan)

- [ ] **T2.5** — `certificacion-clase-b.facade.ts` + Certificados
  - **AC ref:** AC3
  - **DoD:** DoD-F

- [ ] **T2.6** — Validación de la etapa
  - **DoD:** igual que T1.6

---

## Fase 3 — Gestión Clase B (PR 5)

- [ ] **T3.1** — `asistencia-clase-b.facade.ts` + Asistencia
  - **AC ref:** AC3, AC5
  - **DoD:** DoD-F
- [x] **T3.2** — `admin-alumnos.facade.ts` y `ex-alumnos.facade.ts`
  - **AC ref:** AC3
  - **DoD:** DoD-F, más:
    - [x] Los KPIs del hero no dicen 0 cuando la lista muestra error
  - **Avance (2026-11-11):** Migrados `admin-alumnos.facade.ts`, `ex-alumnos.facade.ts` y `convalidation.utils.ts` junto con `alumnos-list-content`, `admin-alumnos`, `secretaria-alumnos`, `ex-alumnos-content`, `admin-ex-alumnos`, `secretaria-ex-alumnos`, `ex-alumnos-profesional-content`, `admin-ex-alumnos-profesional`, `secretaria-ex-alumnos-profesional` y los drawers `tasas` y `comentarios`. Hero KPIs y chips se ocultan en Caso A; Caso B preserva datos y reintenta silenciosamente. `admin-alumnos.facade.ts` fuera de PENDING en `unchecked-reads.guard.spec.ts`. Verde en `test:ci` (4994 passed / 5 skipped), `test-tz.mjs` (UTC, Asia/Tokyo, America/Santiago), `lint:arch`, `ngc --noEmit` y Playwright X01 en `/app/secretaria/alumnos` y `/app/secretaria/ex-alumnos` (drawers y `/ex-alumnos-profesional` sin X01 directo; validados en Vitest).
  - **Cerrada (2026-11-11):** prueba manual en navegador contra la BD real como secretaria
    (alumnos, ex-alumnos, opiniones): carga real, caso B con datos y aviso, "Reintentar" del aviso
    sin pérdida de datos y recuperación. La prueba mostró que en prod la columna es
    `student_surveys.comments`: el cambio a `comment` de la segunda pasada se basó en las
    migraciones (dos crean la tabla con `CREATE TABLE IF NOT EXISTS` y columnas distintas) y dejaba
    las opiniones en error; se volvió a `comments` y el mock del test ahora rechaza `comment`.
- [ ] **T3.3** — `dms.facade.ts` y `dashboard-alerts.facade.ts`
  - **AC ref:** AC3, AC5
  - **DoD:** DoD-F, más:
    - [ ] Una alerta que no cargó no se muestra como "sin alertas"
- [x] **T3.4** — `instructores.facade.ts`, `flota.facade.ts`, `tasks.facade.ts`
  - **AC ref:** AC3
  - **DoD:** DoD-F
  - **Resultado (2026-11-10):** Migrados `instructores.facade.ts`, `flota.facade.ts` y `tasks.facade.ts` junto con sus pantallas (`admin-instructores`, `flota-list-content`, `admin-flota`, `secretaria-observaciones`, `admin-tareas`, `instructor-tareas`). Lecturas con `assertReadOk` o `if (error) throw error`. Manejo de Caso A (empty state con botón Reintentar y sin ceros en KPIs) y Caso B (alert card de datos desactualizados con Reintentar). Fuera de PENDING en `unchecked-reads.guard.spec.ts` y sin knownBug en X01 de `e2e/transversal-shell.spec.ts`. Verde en tests de unidad, test-tz (UTC, Asia/Tokyo, America/Santiago) y E2E X01.
- [x] **T3.5** — Portales: `instructor-alumnos`, `instructor-clases`, `student-clases`, `student-home`
  - **AC ref:** AC3
  - **DoD:** DoD-F
  - **Avance (2026-11-10):** Migrados `instructor-alumnos.facade.ts`, `instructor-clases.facade.ts`, `student-clases.facade.ts` y `student-home.facade.ts` junto con sus pantallas y drawers (`instructor-alumnos`, `instructor-ficha`, `instructor-dashboard`, `instructor-clase`, `instructor-clase-detail`, `instructor-evaluacion`, `alumno-clases`, `alumno-dashboard`, `alumno-pruebas-online`). Fuera de PENDING en `unchecked-reads.guard.spec.ts`. Verde en tests de unidad, componentes y `test-tz.mjs`; sin cuenta E2E de instructor/alumno; prueba manual pendiente.
  - **Cerrada (2026-11-11):** prueba manual en navegador contra la BD real, con los portales
    desbloqueados solo en local (están bloqueados en `pilot-phase.config.ts`) y las lecturas
    cortadas en la pestaña. Instructor (dashboard, Mis Alumnos, ficha, iniciar/clase en curso) y
    alumno con dos matrículas (dashboard, Mis Clases, Pruebas online): caso A sin KPIs en 0, caso B
    con datos y aviso, cambio de matrícula como caso A, y "Reintentar" del aviso sin skeleton ni
    pérdida de datos. La prueba destapó una lectura rota desde abril
    (`v_professional_attendance.semaphore`, columna inexistente) que con `assertReadOk` dejaba en
    error permanente el resumen de todo alumno Profesional; se corrigió leyendo `attendance_flag`.
    X01 no cubre los portales (sin cuentas E2E de esos roles).
- [ ] **T3.6** — Validación de la etapa
  - **DoD:** igual que T1.6

---

## Fase 4 — Clase Profesional (PR 6)

- [ ] **T4.1** — `asistencia-profesional.facade.ts` (12 lecturas, casi todas F2)
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F
- [ ] **T4.2** — `certificacion-profesional.facade.ts` y `archivo-profesional.facade.ts`
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F
- [ ] **T4.3** — `admin-alumnos-profesional`, `libro-de-clases`, `promociones`, `relatores`
  - **AC ref:** AC3
  - **DoD:** DoD-F
- [ ] **T4.4** — Validación de la etapa
  - **DoD:** igual que T1.6

---

## Fase 5 — Cierre

- [ ] **T5.1** — `PENDING` vacío y X01 sin `knownBug`
  - **AC ref:** AC8, AC9
  - **DoD:**
    - [ ] Un facade que no se migró tiene su excepción escrita con motivo
    - [ ] Revisados los `catch` vacíos que queden en los facades: cada uno es un refresco en
      segundo plano que deja el aviso, o tiene un comentario que explica por qué no avisa
- [ ] **T5.2** — `/spec-verify` y `acceptance.md` con evidencia por AC
- [ ] **T5.3** — Índices (`FACADES.md`, `SERVICES.md`, `COMPONENTS.md`), `ROADMAP.md` a Done,
  ASG-b-102 completada (`npm run assignments:sync`) y `specs/.active` limpio
- [ ] **T5.4** — Asignaciones aparte para lo que quedó fuera: cierre de caja calculado en el
  servidor, y las 2 lecturas de `core/services/ui/` (impresión)
