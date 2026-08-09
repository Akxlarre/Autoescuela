# Acceptance 0006-m — Matrícula de refuerzo Clase B (6 clases) sin romper el modelo de 12 prácticas

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-09
> **Verifier:** Claude · validado por m (QA visual en vivo contra Supabase producción)

---

## Resumen

- AC totales: 9 (AC1-AC6 + AC-E1, AC-E2, AC-E3)
- AC cumplidos: 9
- AC fallidos: 0
- AC con evidencia: 9 (código + tests unitarios + QA manual en vivo del owner)

**Veredicto final:** ✅ PASA

**Nota de proceso:** el QA en vivo (T6.4) encontró un bug real no cubierto por los tests
unitarios — `saveAssignment()` en `enrollment.facade.ts` tenía una whitelist de `courseType`
que excluía `'class_b_reinforcement'`, saltando en silencio el bloque que inserta
`class_b_sessions`. Corregido en sesión, con test de regresión nuevo, y re-verificado en vivo
por el owner (matrícula nueva con las 6 clases agendadas correctamente).

---

## Verificación por AC

### AC1 — "Refuerzo Clase B" aparece en el paso 1 del wizard con su propio precio

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Migración: `supabase/migrations/20260808120000_courses_is_reinforcement_and_refuerzo_b.sql`
    — inserta el curso por sede
  - Código: `enrollment.facade.ts` (`mapCourseToOption`, `courseTypeToLicenseClass`) — mapea
    `is_reinforcement=true` → `type='class_b_reinforcement'`
  - Test: `enrollment.facade.spec.ts` — describe "courseOptions — mapeo de Refuerzo Clase B"
    (2 casos)
  - QA manual: owner confirmó visualmente el curso "Refuerzo Clase B" en el wizard, matrícula
    #0017 creada con precio $90.000 (screenshot "¡Matrícula Exitosa!" 2026-08-09)

### AC2 — KPI de progreso muestra el total real del curso ("N/6"), no "N/12"

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `classCountFromPracticalHours()` (`core/utils/class-count.utils.ts`) generalizado
    en `admin-alumno-detalle.facade.ts`, `student-home.facade.ts`, `student-clases.facade.ts`,
    `student-horario.facade.ts`
  - Tests: casos "Refuerzo Clase B" + regresión AC-E1 en los 4 `.spec.ts` de esos facades
  - QA manual: owner confirmó "0 de 6 clases" en la ficha del alumno (screenshot detalle
    Arturo Vidal, 2026-08-09) y "portal alumno" en la lista de superficies verificadas

### AC3 — Elegibilidad del certificado usa la cantidad de clases del curso, no `12` literal

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `certificacion-clase-b.facade.ts` (`clasesTotales` dinámico) +
    `generate-certificate-b-pdf/index.ts` (`REQUIRED_PRACTICAS` dinámico vía join a
    `courses.practical_hours`)
  - Tests: `certificacion-clase-b.facade.spec.ts` — describe "fetchAlumnos — Refuerzo Clase B"
    (3 casos)
  - QA manual: owner confirmó "certificación" en la lista de superficies verificadas
  - **Pendiente de responsabilidad del owner:** el deploy de la Edge Function
    (`npx supabase functions deploy generate-certificate-b-pdf`) — código verificado por test,
    no por invocación HTTP directa en producción

### AC4 — Alumno de Refuerzo no aparece en el listado de certificación

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `certificacion-clase-b.facade.ts:fetchAlumnos()` — `.eq('courses.is_reinforcement', false)`
  - Test: `certificacion-clase-b.facade.spec.ts` — "filtra courses.is_reinforcement=false en la
    query de enrollments"
  - QA manual: owner confirmó "certificación" verificada

### AC5 — Sin selector de pago parcial para Refuerzo (fuerza pago total)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `secretaria-matricula.component.ts` (`isReinforcementCourse()` + `effect()` que
    fuerza `paymentMode='total'`) + `.html` (`[hidePaymentMode]`)
  - Test: `secretaria-matricula.component.spec.ts` — describe "Refuerzo Clase B sin pago
    parcial" (4 casos)
  - QA manual: owner confirmó "wizard" verificado, matrícula #0017 con `TOTAL PAGADO $90.000` /
    `SALDO PENDIENTE $0` (screenshot ficha de alumno)

### AC6 — Precio = mitad del `base_price` de Clase B estándar de la misma sede

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: migración `20260808120000` — `JOIN LATERAL` deriva `ROUND(cb.base_price / 2.0)`
  - QA manual: owner confirmó $90.000 en producción (Clase B de esa sede = $180.000)

### AC-E1 — Cero regresión para Clase B estándar (12 prácticas)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Tests de regresión explícitos en los 6 archivos tocados: `course-resolution.utils.spec.ts`,
    `enrollment.facade.spec.ts`, `certificacion-clase-b.facade.spec.ts`,
    `admin-alumno-detalle.facade.spec.ts`, `student-home.facade.spec.ts`,
    `student-clases.facade.spec.ts`, `student-horario.facade.spec.ts` — todos con fallback
    `|| 12` cuando `practical_hours` no está disponible
  - `npm run test:ci`: 1896/1896 tests verdes, 0 fallos
  - QA manual: owner no reportó regresión en Clase B estándar durante el QA

### AC-E2 — Sesiones de Refuerzo no violan `chk_class_b_sessions_class_number_range`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Decisión de diseño (plan.md §4): `class_number` 1-6 para Refuerzo, dentro del mismo rango
    permitido `BETWEEN 1 AND 12` — sin cambio de constraint
  - Bug encontrado y corregido en el camino: `saveAssignment()` no reconocía
    `courseType='class_b_reinforcement'` en su whitelist, saltando el insert de sesiones por
    completo (no era un problema del constraint, sino de una whitelist de tipo de curso
    incompleta) — corregido, test de regresión agregado
    (`enrollment.facade.spec.ts` — "saveAssignment — Refuerzo Clase B")
  - QA manual: owner re-verificó con una matrícula nueva tras el fix — **las 6 clases quedaron
    agendadas correctamente**, sin error de constraint

### AC-E3 — Sesiones de Refuerzo no descuadran reportes/KPIs agregados de Clase B

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `admin-alumnos.facade.ts` revisado (T6.1): `cursoCompletoPendienteEgreso` exige
    `practiceCounts >= 12` **y** un `certificates.type='class_b'` existente — Refuerzo nunca
    genera certificado (AC4), así que ese flag queda excluido por construcción sin tocar código
  - `student-home/clases/horario.facade.ts` generalizados (ver AC2) — cubre los KPIs de avance
    del portal alumno

---

## Out-of-scope respetado

- ❌ Emitir certificado/constancia para Refuerzo — confirmado: no se implementó
- ❌ Chequeo de elegibilidad/historial previo en el wizard — confirmado: cualquier alumno puede
  matricularse directo, sin validación nueva
- ❌ Precio por clase suelta — confirmado: paquete cerrado de 6, precio fijo
- ❌ Pestaña de Configuración para editar precios de todos los cursos — confirmado: no se tocó,
  documentado como requerimiento futuro en spec.md §1
- ❌ Generalizar el gate/KPIs para Profesional u otros dominios — confirmado: acotado a Clase B
  estándar + Refuerzo
- ❌ Migración retroactiva de matrículas existentes — confirmado: no se tocó

---

## Deuda técnica detectada

- **Flujo público de auto-inscripción** (`public-enrollment.facade.ts`, 7 call-sites con el
  mismo patrón `.find()` ambiguo por `license_class` que tenía el wizard interno antes de esta
  spec): no se corrigieron los call-sites — se aisló el riesgo en la capa RLS
  (`select_courses_anon` excluye `is_reinforcement=true`, migración `20260808130000`), decisión
  explícita del owner en sesión. Si algún día Refuerzo se ofrece por el flujo público, esos 7
  call-sites necesitan el mismo fix de desambiguación que ya tiene `enrollment.facade.ts`.
- **ASG-m-001** (creada en esta sesión, fuera de esta spec): 3 bugs del sistema de `audit_log`
  detectados durante el QA (query rota "relation students does not exist", FK `theory_cycle_id`
  sin humanizar, ruido de campos técnicos en el feed de actividad). No bloquean esta spec —
  quedan documentados para quien reclame la Asignación.

---

## Cambios en índices

- `indices/DATABASE.md` — `courses.is_reinforcement` documentada + policy `select_courses_anon`
  actualizada
- `indices/UTILS.md` — `class-count.utils.ts` nuevo, `course-resolution.utils.ts` y
  `carnet-menu.util.ts` extendidos con las nuevas opciones

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el patrón `isSence` ya existente en
  `findCourseByLicenseClass()` resultó ser el molde exacto para `isReinforcement` — evitó
  inventar un mecanismo nuevo de desambiguación de cursos.
- **Qué fricciones encontramos:** el discovery inicial subestimó el alcance real dos veces
  seguidas — primero la colisión de `license_class` en el wizard, después el descubrimiento
  (durante el QA, no durante el plan) de que `saveAssignment()` tenía su propia whitelist de
  `courseType` separada de `mapCourseToOption()`/`findCourseByLicenseClass()`. El grep de T6.1
  buscó `license_class`/`license_group`, pero no cubrió comparaciones directas de `courseType`
  contra un literal de string — ese patrón quedó fuera del grep hasta que el QA en vivo lo
  atrapó.
- **Qué cambiaríamos en el siguiente ciclo SDD:** al introducir un `CourseType` nuevo, agregar
  al checklist de T6.1 un grep explícito de `courseType ===` / `courseType.startsWith` además
  de `license_class`/`license_group` — son 3 patrones de discriminación de curso distintos que
  coexisten en este código base y ninguno garantiza cubrir a los otros dos.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (1896/1896)
- [x] `lint:arch` limpio
- [x] Sin deuda crítica abierta (deuda documentada, no bloqueante)

**Cerrado por:** m
**Fecha:** 2026-08-09
