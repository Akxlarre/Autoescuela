# Tasks 0006 — Matrícula de refuerzo Clase B (6 clases) sin romper el modelo de 12 prácticas

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress (pendiente solo deploy manual de la Edge Function + QA visual en vivo)
> **Created:** 2026-08-08

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marca la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubres una sub-tarea no listada, agrégala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detente** y crea spec nueva.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Migración `courses.is_reinforcement` + 2 filas "Refuerzo Clase B"
  - **AC ref:** AC1, AC6
  - **DoD:**
    - [x] `supabase/migrations/20260808120000_courses_is_reinforcement_and_refuerzo_b.sql`
      creado, `ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_reinforcement BOOLEAN NOT NULL
      DEFAULT false` + `COMMENT ON COLUMN`
    - [x] INSERT usa `JOIN LATERAL` para derivar `base_price = ROUND(cb.base_price / 2.0)` del
      curso Clase B estándar (no SENCE, no reforzado) de la misma sede — sin valor hardcodeado
    - [x] `practical_hours = 4.5`, `license_class = 'B'`, `type = 'class_b'`,
      `is_reinforcement = true`
    - [x] Idempotente: `NOT EXISTS (... WHERE branch_id = b.id AND is_reinforcement = true)`
    - [ ] `npx supabase db reset` corre sin error — **pendiente, el usuario despliega
      manualmente**
    - [ ] Verificar con SQL directo: 1 fila por sede activa, `base_price` = mitad exacta del
      Clase B de esa sede — **pendiente de QA en vivo**
    - [ ] Documentado en `indices/DATABASE.md` (columna nueva + filas del catálogo) — Fase 7

- [x] **T1.2** — DTO `core/models/dto/course.model.ts`: agregar `is_reinforcement`
  - **DoD:**
    - [x] `is_reinforcement: boolean` agregado a la interface `Course`
    - [x] Sin otros cambios de forma

- [x] **T1.3** — UI Model `core/models/ui/enrollment-personal-data.model.ts`: `CourseType`
  - **AC ref:** AC1
  - **DoD:**
    - [x] `CourseType` agrega `'class_b_reinforcement'`
    - [x] `CourseOption` sin cambios de forma (reutiliza `type`)

---

## Fase 2 — Núcleo funcional (utils puros)

- [x] **T2.1** — `core/utils/class-count.utils.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC2, AC3, AC-E1
  - **DoD:**
    - [x] Casos: `9.0h → 12`, `4.5h → 6`, redondeo (`Math.round`) con horas no exactas,
      `null`/`0` → `0`
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T2.2** — Implementar `core/utils/class-count.utils.ts`
  - **AC ref:** AC2, AC3, AC-E1
  - **DoD:**
    - [x] `classCountFromPracticalHours(practicalHours: number | null, sessionMinutes = 45):
      number`, función pura sin dependencias de Angular
    - [x] Misma fórmula que ya usa `secretaria-matricula.component.ts:176,239`
      (`practicalHours * 60 / sessionMinutes`, redondeada)
    - [x] Tests de T2.1 PASAN (`npm run test:ci`) — 6/6
    - [ ] Documentado en `indices/UTILS.md` — Fase 7

- [x] **T2.3** — Extender `core/utils/course-resolution.utils.spec.ts` (TDD)
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] Caso nuevo: sede con Clase B estándar + Refuerzo + SENCE simultáneos,
      `isReinforcement: true` resuelve el curso correcto sin cruzarse con los otros 2
    - [x] Caso de regresión: `isReinforcement` omitido/`false` sigue resolviendo el Clase B
      estándar igual que antes (AC-E1)
    - [x] Tests nuevos FALLAN antes de tocar la implementación

- [x] **T2.4** — Extender `findCourseByLicenseClass()` en `course-resolution.utils.ts`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] Nuevo parámetro `isReinforcement?: boolean` en `options`, mismo patrón que `isSence`
      (filtra por `c.is_reinforcement` en vez de parsear `code`)
    - [x] Tests de T2.3 PASAN — 9/9

---

## Fase 3 — Capa Facade

- [x] **T3.1** — `enrollment.facade.spec.ts`: casos nuevos PRIMERO (TDD)
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] `mapCourseToOption()` con `is_reinforcement=true` → `type='class_b_reinforcement'`,
      `category='non-professional'`
    - [x] `mapCourseToOption()` con `is_reinforcement=false` (o SENCE) sigue igual que antes
      (regresión, AC-E1)
    - [x] `courseOptions()` con Clase B + Refuerzo + SENCE en la misma sede no duplica ni
      confunde entradas
    - [x] Tests FALLAN antes de tocar la implementación

- [x] **T3.2** — Implementar cambios en `enrollment.facade.ts`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] `mapCourseToOption()`: cuando `lc === 'B'`, chequea `course.is_reinforcement` **antes**
      que `isSence` → `type = 'class_b_reinforcement'`
    - [x] `iconMap`/`colorMap` agregan entrada para `'class_b_reinforcement'`
    - [x] `courseTypeToLicenseClass()` agrega `class_b_reinforcement → 'B'`
    - [x] Los 5 call-sites de `findCourseByLicenseClass()`/`.find()` inline (`_requiredSlotCount`,
      `studentSummary`, `sidebarSummary`, `savePersonalData`, `resolveCourseId`) pasan
      `isReinforcement: pd.courseType === 'class_b_reinforcement'`
    - [x] Tests de T3.1 PASAN — 64/64 (sin regresión)
    - [ ] Documentado en `indices/FACADES.md` — Fase 7

- [x] **T3.3** — `certificacion-clase-b.facade.spec.ts`: casos nuevos PRIMERO (TDD)
  - **AC ref:** AC3, AC4, AC-E1, AC-E3
  - **DoD:**
    - [x] Un enrollment con curso `is_reinforcement=true` nunca aparece en `_alumnos()`
      resultante de `fetchAlumnos()`
    - [x] `clasesTotales` de un enrollment Clase B estándar sigue siendo `12` (AC-E1, regresión)
    - [x] `clasesTotales` deriva correctamente vía `classCountFromPracticalHours()`
    - [x] Tests FALLAN antes de tocar la implementación

- [x] **T3.4** — Implementar cambios en `certificacion-clase-b.facade.ts`
  - **AC ref:** AC3, AC4, AC-E1, AC-E3
  - **DoD:**
    - [x] `enrollmentQuery` en `fetchAlumnos()` excluye `courses.is_reinforcement = true`
    - [x] `clasesTotales: 12` reemplazado por `classCountFromPracticalHours(...)  || 12`
    - [x] `clasesCompletadas` usa el mismo total dinámico en el `Math.min(...)`
    - [x] Tests de T3.3 PASAN — 23/23
    - [ ] Documentado en `indices/FACADES.md` — Fase 7

---

## Fase 4 — Capa UI (wizard, sin componentes nuevos)

- [x] **T4.1** — `secretaria-matricula.component.spec.ts`: casos nuevos PRIMERO (TDD)
  - **AC ref:** AC5
  - **DoD:**
    - [x] `isReinforcementCourse()` retorna `true` solo cuando
      `pd.courseType === 'class_b_reinforcement'`
    - [x] `paymentMode` queda `'total'` aunque no se haya interactuado con el selector
    - [x] Tests FALLAN antes de tocar la implementación

- [x] **T4.2** — Implementar en `secretaria-matricula.component.ts` + `.html`
  - **AC ref:** AC1, AC5
  - **DoD:**
    - [x] Computed `isReinforcementCourse()` agregado
    - [x] `paymentMode` se fuerza a `'total'` para Refuerzo vía `effect()` en el constructor
      (no solo se oculta la UI, se fija el valor en el facade)
    - [x] `<app-assignment-step [hidePaymentMode]="isReinforcementCourse()" ...>` en el HTML
    - [x] Tests de T4.1 PASAN — 7/7
    - [x] `npx tsc --noEmit` limpio

---

## Fase 5 — Edge Function (gate server-side)

- [x] **T5.1** — Generalizar `REQUIRED_PRACTICAS` en `generate-certificate-b-pdf/index.ts`
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [x] Join a `courses.practical_hours` por `enrollment_id`
    - [x] `REQUIRED_PRACTICAS = 12` reemplazado por `Math.round(practicalHours * 60 / 45)`,
      fallback 12 si falta el dato
    - [x] Mensaje de error sigue funcionando igual para Clase B estándar (AC-E1)
    - [ ] `npx supabase functions deploy generate-certificate-b-pdf` — **el usuario despliega
      manualmente, ver resumen final**
    - [ ] Prueba directa post-deploy — **pendiente de QA en vivo del usuario**

---

## Fase 6 — Auditoría y validación

- [x] **T6.1** — Grep final de `license_class`/`license_group` fuera de los archivos ya tocados
  - **DoD:**
    - [x] `license_class` revisado en `src/` completo
    - [x] `license_group`/`'class_b'` revisado en `core/facades/`
    - [x] Hallazgos agregados a "Tareas descubiertas" y corregidos (ver abajo)

- [x] **T6.2** — `npm run lint:arch` corre limpio (exit 0, solo warnings preexistentes no
  relacionados a esta spec)

- [x] **T6.3** — `npm run test:ci` corre verde — **1896/1896 tests, 151 archivos, 0 fallos**
  (2 archivos / 5 tests skip preexistentes, no relacionados)

- [ ] **T6.4** — QA manual completo contra Supabase local
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC6, AC-E1, AC-E2, AC-E3
  - **Bloqueado:** requiere `npx supabase db reset` + deploy de la Edge Function, que el
    usuario ejecuta manualmente. Checklist queda igual, pendiente de evidencia en
    `acceptance.md` tras el deploy:
    - [ ] "Refuerzo Clase B" aparece en el wizard en ambas sedes con precio = mitad de Clase B
    - [ ] Selector Total/Parcial oculto para Refuerzo; `payment_mode='total'` en BD
    - [ ] Alumno de Refuerzo con 6 sesiones completadas NO aparece en certificación
    - [ ] Alumno de Clase B estándar: cero regresión
    - [ ] `enrollments.license_group='class_b'` y numeración compartida con Clase B estándar
    - [ ] Edge Function rechaza un enrollment de Refuerzo llamado directamente
    - [ ] Curso "Refuerzo Clase B" NO aparece en el flujo público de auto-inscripción (RLS)
    - [ ] Ficha de alumno (admin/secretaría): grilla de 6 casilleros, KPI "Progreso Práctico"
      6, menú "Carnet" solo muestra la sección de 6 clases
    - [ ] Portal alumno (dashboard, Mis Clases, Mi Horario): KPIs muestran "/6", no "/12"

- [ ] **T6.5** — Ejecutar `/spec-verify` — pendiente hasta después del QA en vivo (T6.4)

---

## Fase 7 — Cierre

- [ ] **T7.1** — Actualizar `indices/` (`/sync-indices`): `DATABASE.md`, `MODELS.md`,
  `FACADES.md`, `UTILS.md` con lo nuevo de esta spec
- [ ] **T7.2** — Marcar spec `0006-m` como `done` en `specs/ROADMAP.md` (recién tras T6.4/T6.5)
- [ ] **T7.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agrégalo acá.
> Si está fuera de scope, crea spec nueva.

- [x] **Flujo público de auto-inscripción** — `select_courses_anon` dejaba pasar "Refuerzo
  Clase B" a visitantes anónimos (mismo `active=true`/`is_convalidation=false` que cualquier
  curso). Confirmado con el usuario: Refuerzo nunca debe ofrecerse por ese canal. Corregido en
  `supabase/migrations/20260808130000_courses_hide_reinforcement_from_public_rls.sql` —
  la policy ahora excluye `is_reinforcement=true`. No se tocaron los 7 call-sites de
  `public-enrollment.facade.ts` (decisión: aislar en RLS es más seguro que replicar el fix de
  desambiguación en un flujo público no auditado en esta spec).
- [x] **Ficha de alumno (admin/secretaría)** — `admin-alumno-detalle.facade.ts` tenía su propio
  hardcodeo `PRACTICAS_REQUERIDAS_B = 12` (KPI "Progreso Práctico" + grilla `_clasesPracticas`
  de 12 casilleros), no cubierto por el plan original. Generalizado vía
  `classCountFromPracticalHours()`. Confirmado con el usuario que el carnet de 6 clases SÍ
  debe poder generarse para Refuerzo (idéntico al de Clase B estándar) — solo se oculta la
  sección del carnet de 12 (`carnet-menu.util.ts`, nuevo flag `isReinforcement`), ya que ese
  nunca aplica.
- [x] **Portal alumno — 3 facades adicionales** con el mismo patrón de "12" hardcodeado, todos
  dentro de la superficie que AC2 nombra explícitamente ("dashboard/portal alumno"):
  `student-home.facade.ts` (KPI "Prácticas" del dashboard + límite de sesiones en timeline),
  `student-clases.facade.ts` (KPI "Prácticas" de "Mis Clases" — el suffix `/12` en
  `alumno-clases.component.ts:335` también estaba hardcodeado, corregido a `/${totalPractices}`),
  `student-horario.facade.ts` (`hasRemainingToSchedule`, determina si se muestra el botón
  "Agendar" en "Mi Horario"). Los 3 generalizados con el mismo util, con test de regresión
  AC-E1 en cada uno.
- [x] **`admin-alumnos.facade.ts`** (Base de Alumnos) — revisado, NO requiere cambios: el flag
  `cursoCompletoPendienteEgreso` exige `practiceCounts >= 12` **y** un `certificates` con
  `type='class_b'`; como Refuerzo nunca genera certificado (AC4), el segundo gate ya lo excluye
  por construcción sin tocar código.
