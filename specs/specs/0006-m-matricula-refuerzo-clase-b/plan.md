# Plan 0006 — Matrícula de refuerzo Clase B (6 clases) sin romper el modelo de 12 prácticas

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-08
> **Talla:** L — confirmada con el usuario tras 2 rondas de discovery que revelaron riesgos reales
> (colisión de `license_class` en el wizard, CHECK constraint + 2 funciones SQL atadas a
> `license_class = 'B'` como booleano). Revisar bien antes de implementar.

---

## 1. Resumen ejecutivo

Se agrega el curso **"Refuerzo Clase B"** (6 clases, `practical_hours = 4.5`) a `courses`,
insertado **2 veces** (una por sede existente), manteniendo `license_class = 'B'` para heredar
gratis la numeración de matrícula y el `license_group = 'class_b'` correctos (sin tocar SQL de
numeración/CHECK/RLS). Se distingue del Clase B estándar con una columna nueva
`courses.is_reinforcement BOOLEAN`, siguiendo el mismo patrón que ya existe para SENCE
(`findCourseByLicenseClass(..., { isSence })` en `course-resolution.utils.ts`) — se extiende esa
misma utilidad con `isReinforcement`. Se generaliza la cantidad de clases requeridas para el gate
del certificado y los KPIs de avance, reemplazando el hardcodeo de `12` por la fórmula que el
wizard ya usa (`practical_hours * 60 / 45`), en 2 puntos: `certificacion-clase-b.facade.ts` y la
Edge Function `generate-certificate-b-pdf`. El wizard fuerza pago total (sin parcial) para
Refuerzo reutilizando el input `hidePaymentMode` que `app-assignment-step` ya expone (hoy usado
por el drawer de reagendar horarios). El precio (`base_price`) se resuelve en la propia migración
como la mitad del `base_price` vigente de Clase B por sede — sin placeholder pendiente. Orden:
migración SQL → utilidad de resolución → `enrollment.facade.ts` (tipo/mapeo) → wizard step 1
(curso + `hidePaymentMode`) → gate/KPIs certificación → QA.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/YYYYMMDDHHMMSS_courses_is_reinforcement_and_refuerzo_b.sql` | Migration | Columna `courses.is_reinforcement` + INSERT de 2 filas "Refuerzo Clase B" (una por sede) |
| `src/app/core/utils/class-count.utils.ts` | Util (Núcleo Funcional) | `classCountFromPracticalHours(practicalHours: number, sessionMinutes = 45): number` — misma fórmula que ya usa el wizard, extraída para reutilizar en el gate/KPIs |
| `src/app/core/utils/class-count.utils.spec.ts` | Test | Casos: 9.0h→12, 4.5h→6, redondeo, `null`/`0` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/utils/course-resolution.utils.ts` | `findCourseByLicenseClass()` acepta `isReinforcement?: boolean` (mismo patrón que `isSence`, filtra por `c.is_reinforcement` en vez de parsear `code`) | Único punto de resolución de curso por `license_class` + sede — ya soporta desambiguar SENCE, se extiende para Refuerzo |
| `src/app/core/utils/course-resolution.utils.spec.ts` | Casos nuevos: resolver "Refuerzo Clase B" de la sede correcta, no confundir con el Clase B estándar ni con SENCE | AC-E1 (regresión Clase B estándar) |
| `src/app/core/models/dto/course.model.ts` | Agregar `is_reinforcement: boolean` al DTO `Course` | Nueva columna de BD |
| `src/app/core/models/ui/enrollment-personal-data.model.ts` | `CourseType` agrega `'class_b_reinforcement'`; `CourseOption` sin cambios de forma (ya tiene `type`) | Nuevo tipo de curso distinguible en el wizard |
| `src/app/core/facades/enrollment.facade.ts` | `mapCourseToOption()`: cuando `lc === 'B'`, chequear `course.is_reinforcement` **antes** que `isSence` → `type = 'class_b_reinforcement'`; agregar entradas en `iconMap`/`colorMap` para el tipo nuevo. `courseTypeToLicenseClass()`: agregar `class_b_reinforcement → 'B'`. Los 4 call-sites de `findCourseByLicenseClass()` (líneas ~145, ~251, ~548, ~2107) y el `.find()` inline de `sidebarSummary` (línea ~274) pasan `isReinforcement: pd.courseType === 'class_b_reinforcement'` (mismo patrón que `isSence`, línea ~2106) | AC1, AC-E1 — evita que el `.find()` por `license_class='B'` resuelva al curso equivocado |
| `src/app/core/facades/enrollment.facade.ts` (spec) | Tests nuevos: `mapCourseToOption()` mapea `is_reinforcement=true` a `type='class_b_reinforcement'`; `courseOptions()` no duplica ni confunde Clase B estándar con Refuerzo en la misma sede | `testing-tdd.md` — Facade obligatorio |
| `src/app/core/facades/certificacion-clase-b.facade.ts` | `fetchAlumnos()`: el `enrollmentQuery` excluye cursos `is_reinforcement=true` (join a `courses!inner(..., is_reinforcement)` + filtro `.eq('courses.is_reinforcement', false)` o post-filtro en memoria); `clasesTotales: 12` hardcodeado (líneas 508-509) → `classCountFromPracticalHours(e.courses.practical_hours)` | AC4 (Refuerzo no aparece en el listado de certificación), AC3 |
| `src/app/core/facades/certificacion-clase-b.facade.ts` (spec) | Tests nuevos: enrollment de Refuerzo nunca aparece en `_alumnos`; `clasesTotales` refleja `practical_hours` del curso, no `12` fijo | `testing-tdd.md` |
| `supabase/functions/generate-certificate-b-pdf/index.ts` | `REQUIRED_PRACTICAS = 12` (línea 123) → leer `practical_hours` del curso de la matrícula (join a `courses`) y aplicar la misma fórmula de conversión (reimplementada en Deno — no puede importar el util de Angular) | AC3, AC-E1 |
| `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` | `totalSessions` ya deriva de `practicalHours` sin cambios (líneas 174-176, 236-239). Nuevo: computed `isReinforcementCourse()` (`pd?.courseType === 'class_b_reinforcement'`); al setear `paymentMode` forzar `'total'` cuando es Refuerzo (mismo patrón que `admin-reagendar-horarios-drawer.component.ts:106`, "fijo para no bloquear `canContinue()`") | AC1, AC5 |
| `src/app/features/secretaria/matricula/secretaria-matricula.component.html` | `<app-assignment-step [hidePaymentMode]="isReinforcementCourse()" ...>` | AC5 |
| `src/app/shared/components/matricula-steps/assignment/assignment.component.ts` (spec) | Caso nuevo: `hidePaymentMode=true` no renderiza el selector Total/Parcial (probablemente ya cubierto por el spec existente del drawer de reagendar — solo verificar, no crear si ya hay cobertura) | AC5 |
| `src/app/core/facades/admin-alumnos.facade.ts`, `admin-alumno-detalle.facade.ts` | Revisar usos de `/12` encontrados en discovery — confirmar si aplican a KPIs de avance visibles para Refuerzo; ajustar si asumen 12 fijo | AC2, AC-E3 |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- Wizard de nueva matrícula (`secretaria-matricula.component.ts`) — el paso 1 y el cálculo de
  sesiones ya son genéricos por `practical_hours`, no requieren componente nuevo.
- `certificacion-clase-b-content` (admin + secretaría) — se reutiliza tal cual; el filtro de
  exclusión de Refuerzo va en el Facade, no en la UI.

### Facades/Services existentes que extendemos
- `EnrollmentFacade` — `mapCourseToOption()`, `courseTypeToLicenseClass()`, y los call-sites de
  `findCourseByLicenseClass()`.
- `certificacion-clase-b.facade.ts` — `fetchAlumnos()`.

### Utilidades existentes que extendemos (Núcleo Funcional)
- `findCourseByLicenseClass()` (`core/utils/course-resolution.utils.ts`) — ya resuelve el mismo
  problema para SENCE (`isSence`), se extiende con `isReinforcement` en vez de crear una función
  nueva.

### Componentes/Facades que NO existen y debemos crear
- `classCountFromPracticalHours()` — no existe una utilidad pura compartida para la fórmula
  `practicalHours * 60 / sessionMinutes`; hoy está duplicada inline en 2 lugares del wizard
  (`secretaria-matricula.component.ts:176,239`) y el gate/KPIs la reinventan como literal `12`.
  Se extrae para tener un único punto de verdad (`core/utils/`, Núcleo Funcional puro,
  testeable sin Angular).

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_courses_is_reinforcement_and_refuerzo_b.sql

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_reinforcement BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN courses.is_reinforcement IS
  'true = curso de refuerzo (6 clases prácticas, no candidato a certificado Clase B). '
  'Comparte license_class=''B'' con el Clase B estándar (12 prácticas) para heredar la '
  'numeración de matrícula y license_group=''class_b'' sin tocar triggers/RLS existentes; '
  'se distingue vía esta columna, mismo patrón ya usado para SENCE (courses.code).';

-- Una fila por sede existente — NO hardcodear branch_id, iterar branches activas.
-- Precio: mitad del base_price vigente de Clase B estándar (no SENCE, no reforzado) de la
-- MISMA sede al momento de correr la migración — valor fijo desde ahí, no recalculado luego.
INSERT INTO courses (code, name, type, license_class, branch_id, practical_hours,
                      theory_hours, base_price, is_reinforcement, active)
SELECT
  'refuerzo_b_' || b.id,
  'Refuerzo Clase B',
  'class_b',
  'B',
  b.id,
  4.5,   -- 6 clases × 45 min
  0,
  ROUND(cb.base_price / 2.0),
  true,
  true
FROM branches b
JOIN LATERAL (
  SELECT base_price FROM courses c
  WHERE c.branch_id = b.id
    AND c.license_class = 'B'
    AND c.is_reinforcement = false
    AND c.code NOT ILIKE '%sence%'
  LIMIT 1
) cb ON true
WHERE b.active = true
  AND NOT EXISTS (
    SELECT 1 FROM courses c WHERE c.branch_id = b.id AND c.is_reinforcement = true
  );
```

### RLS

Sin cambios. `auth_can_enroll_course_type()` filtra por `courses.type` (columna de texto libre,
no el `CourseType` de TS) — "Refuerzo Clase B" usa `type = 'class_b'` igual que el estándar, así
que hereda automáticamente el mismo acceso (secretaría sede 1 y 2 pueden matricular). `courses`
ya tiene policy `select_courses` abierta a cualquier usuario autenticado — sin cambios.

### Modelos UI/DTO

- `core/models/dto/course.model.ts` — agregar `is_reinforcement: boolean`.
- `core/models/ui/enrollment-personal-data.model.ts` — `CourseType` agrega
  `'class_b_reinforcement'`. Sin nuevo modelo UI dedicado — `CourseOption` ya cubre el caso (solo
  cambia el valor de `type`).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Secretaria → SecretariaMatriculaComponent (Smart, paso 1)
               └─ EnrollmentFacade.courseOptions()  [computed]
                     └─ mapCourseToOption(course)
                           if license_class==='B':
                             is_reinforcement? → type='class_b_reinforcement'
                             isSence?          → type='class_b_sence'
                             else              → type='class_b'
               └─ selección → pd.courseType='class_b_reinforcement'
               └─ totalSessions = practicalHours*60/45  (ya genérico, sin cambio)

Admin/Secretaria → CertificacionClaseBContent (Dumb, reutilizado sin cambios)
               └─ CertificacionClaseBFacade.fetchAlumnos()
                     └─ query enrollments WHERE courses.is_reinforcement = false
                     └─ clasesTotales = classCountFromPracticalHours(courses.practical_hours)

Admin (bypass) → Edge Function generate-certificate-b-pdf
               └─ join courses.practical_hours por enrollment_id
               └─ REQUIRED_PRACTICAS = classCount(practical_hours)  [reimplementado en Deno]
```

### Capas tocadas

- **Smart**: `secretaria-matricula.component.ts` (sin cambio de código, solo QA de que
  aparece el curso nuevo).
- **Facade**: `enrollment.facade.ts`, `certificacion-clase-b.facade.ts`.
- **Util (Núcleo Funcional)**: `course-resolution.utils.ts` (extendido), `class-count.utils.ts`
  (nuevo).
- **Edge Function**: `generate-certificate-b-pdf/index.ts`.
- **Migration**: `supabase/migrations/...courses_is_reinforcement_and_refuerzo_b.sql`.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Núcleo Funcional: `classCountFromPracticalHours()` es función pura en
  `core/utils/`, no lógica embebida en Facade.
- [ ] `facades.md` — no aplica branch-scoping nuevo (ambos Facades tocados ya son branch-scoped
  existentes, sin cambios a ese patrón).
- [x] `models.md` — DTO (`course.model.ts`) vs UI (`CourseOption`/`CourseType`) mantenidos
  separados; el mapeo sigue viviendo en el Facade.
- [ ] `visual-system.md` — sin UI nueva (reutiliza wizard y listado existentes tal cual).
- [ ] `swr-pattern.md` — no aplica, sin Facade nuevo con ciclo SWR.
- [ ] `notifications.md` — no aplica.
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para: `class-count.utils.ts`,
  `course-resolution.utils.ts` (casos nuevos), `enrollment.facade.ts` (casos nuevos),
  `certificacion-clase-b.facade.ts` (casos nuevos).
- [ ] `ai-readability.md` — no aplica (sin botones de mutación nuevos; se reutiliza el wizard).

---

## 7. Plan de testing

- **Unitarios (obligatorios, TDD primero):**
  - `class-count.utils.spec.ts`: `4.5h→6`, `9.0h→12`, redondeo (`Math.round`), `null`/`0` → `0`.
  - `course-resolution.utils.spec.ts`: nuevo caso — sede con Clase B estándar + Refuerzo +
    SENCE simultáneos, `isReinforcement: true` resuelve el correcto sin cruzarse con los otros 2.
  - `enrollment.facade.spec.ts`: `mapCourseToOption()` con `is_reinforcement=true` →
    `type='class_b_reinforcement'`; `courseOptions()` no duplica entradas erróneas.
  - `certificacion-clase-b.facade.spec.ts`: enrollment de Refuerzo excluido de `_alumnos()`;
    `clasesTotales` deriva de `practical_hours`, no hardcodeado.
  - `secretaria-matricula.component.spec.ts`: `isReinforcementCourse()` retorna `true` solo para
    `courseType='class_b_reinforcement'`; `paymentMode` forzado a `'total'` en ese caso aunque el
    usuario no lo haya seleccionado explícitamente.
- **QA manual (golden path + edge cases), contra Supabase local:**
  1. Wizard: "Refuerzo Clase B" aparece en el paso 1 en ambas sedes, con precio = mitad del de
     Clase B de esa sede (AC6).
  2. Wizard: al seleccionar Refuerzo, el paso de asignación NO muestra el selector Total/Parcial
     (AC5) y el enrollment queda con `payment_mode='total'` en BD.
  3. Matricular un alumno en Refuerzo → completar 6 sesiones → verificar que NO aparece en el
     listado de certificación (admin ni secretaría).
  4. Matricular un alumno en Clase B estándar en la misma sede → confirmar cero regresión
     (12 sesiones, selector de pago parcial disponible, aparece en certificación, gate igual que
     antes) — AC-E1.
  5. Verificar `enrollments.license_group='class_b'` y numeración correlativa compartida con
     Clase B estándar de la misma sede para un alumno de Refuerzo — confirma que no se tocó
     `get_next_enrollment_number()`.
  6. Intentar generar certificado vía Edge Function para un enrollment de Refuerzo (llamada
     directa, bypasseando la UI) → confirmar que el gate lo rechaza igual que a un Clase B
     incompleto, no lo trata como caso especial silencioso.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Algún `.find()`/`.filter()` por `license_class='B'` no listado en la Sección 2 queda sin actualizar y resuelve al curso equivocado en producción | Media | Grep final de `license_class` en todo `src/` antes de cerrar el fix, no solo en `enrollment.facade.ts` |
| KPIs agregados de avance Clase B (dashboards, reportes) que cuenten `enrollments.license_group='class_b'` sin filtrar por `is_reinforcement` mezclan a los alumnos de Refuerzo en indicadores que no les corresponden (AC-E3) | Media | Grep de `license_group.*class_b` fuera de los 2 Facades ya identificados; revisar `admin-alumnos.facade.ts`/`admin-alumno-detalle.facade.ts` (ya señalados en discovery) |
| Edge Function no puede importar `class-count.utils.ts` de Angular (entorno Deno aislado) → fórmula duplicada en 2 runtimes, riesgo de que diverjan a futuro | Baja | Documentar en comentario de ambos archivos que son la misma fórmula intencionalmente duplicada (mismo patrón ya usado: el comentario de `generate-certificate-b-pdf` ya referencia "mismo criterio que certificacion-clase-b.facade.ts") |
| `hidePaymentMode=true` oculta el selector pero no bloquea que un `payment_mode` distinto a `'total'` llegue por otra vía (ej. restaurar un draft antiguo con `partial` guardado) | Baja | El facade fuerza `paymentMode.set('total')` explícitamente al detectar curso de Refuerzo, no solo oculta la UI — mismo criterio defensivo que el gate server-side (AC5 se verifica en BD, no solo visualmente) |

---

## 9. Orden de implementación

1. Migración SQL (`courses.is_reinforcement` + 2 filas, precio derivado en el propio INSERT —
   sin dato pendiente).
2. `class-count.utils.ts` + spec (TDD primero).
3. `course-resolution.utils.ts` extendido (`isReinforcement`) + spec.
4. `course.model.ts` (DTO) + `enrollment-personal-data.model.ts` (`CourseType`).
5. `enrollment.facade.ts`: `mapCourseToOption()`, `courseTypeToLicenseClass()`, 4 call-sites de
   `findCourseByLicenseClass()` + `sidebarSummary` inline + specs.
6. `secretaria-matricula.component.ts/.html`: `isReinforcementCourse()`, forzar `paymentMode`,
   `[hidePaymentMode]` en `app-assignment-step` + specs.
7. `certificacion-clase-b.facade.ts`: exclusión de Refuerzo + `clasesTotales` dinámico + specs.
8. `generate-certificate-b-pdf/index.ts`: `REQUIRED_PRACTICAS` dinámico (deploy manual tras
   editar — recordar `npx supabase functions deploy`, gap de proceso ya documentado en
   spec 0034-b).
9. Grep final de `license_class`/`license_group.*class_b` fuera de los archivos ya tocados
   (mitigación del riesgo #1 y #2).
10. QA manual completo (sección 7) + `npm run test:ci` + `npm run lint:arch`.

---

## 10. Estimación

L — 2 a 3 días (incluye el grep de auditoría final y QA manual con datos reales en ambas sedes).

---

## Changelog

- 2026-08-08 — plan inicial por m, vía `/spec-plan`. Talla L confirmada tras 2 rondas de
  discovery con el usuario: (1) colisión de `license_class` en `EnrollmentFacade` — resuelta
  reutilizando el patrón `isSence` de `findCourseByLicenseClass()` con un nuevo
  `isReinforcement`; (2) `license_group` CHECK constraint + `get_next_enrollment_number()` +
  `set_enrollment_license_group()` atados a `license_class='B'` como booleano — resuelto
  manteniendo `license_class='B'` para Refuerzo (cero cambios SQL en esas 3 piezas) en vez de
  un `license_class` nuevo. Confirmado con el usuario que la numeración de Refuerzo debe
  compartir secuencia con Clase B estándar de la misma sede — ya garantizado por esta decisión,
  sin trabajo adicional.
- 2026-08-08 — Aclaraciones del usuario incorporadas: (a) sin pago parcial para Refuerzo — se
  reutiliza `hidePaymentMode` de `app-assignment-step` (ya existente, usado hoy por el drawer de
  reagendar horarios), forzando `paymentMode='total'` en el facade además de ocultar la UI; (b)
  precio = mitad del `base_price` vigente de Clase B por sede, resuelto directamente en la
  migración (`JOIN LATERAL` sobre el curso Clase B de la misma sede) — ya no queda pendiente;
  (c) tab de admin para editar precios de todos los cursos es scope futuro confirmado, explícito
  en Out of scope de `spec.md`, no se toca en esta spec.
