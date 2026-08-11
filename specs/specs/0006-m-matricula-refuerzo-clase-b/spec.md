# Spec 0006 — Matrícula de refuerzo Clase B (6 clases) sin romper el modelo de 12 prácticas

> **Status:** done
> **Created:** 2026-08-08
> **Closed:** 2026-08-09
> **Owner:** m
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-038 (`specs/assignments/ASG-b-038-matricula-refuerzo-6-clases.md`).

**Persona afectada:** Secretaria (matrícula), Admin (certificación/KPIs), Alumno (portal).

**Problema que resuelve:**
El modelo actual asume **12 prácticas** en todas partes: `class_b_sessions` tiene
`CHECK (class_number BETWEEN 1 AND 12)` (`chk_class_b_sessions_class_number_range`) y
`UNIQUE (enrollment_id, class_number)`, ambos agregados deliberadamente en `20260709120100`
(fix-028-m). El certificado Clase B se emite contra las 12 prácticas completadas, y los KPIs
de avance del alumno son "N/12". Un alumno que solo necesita reforzar ciertas materias — no
sacar el certificado — no es candidato al modelo de 12 prácticas. Meterlo en la misma matrícula
rompe el gate del certificado y descuadra los indicadores de avance.

**Respuesta del cliente (2026-08-02):** Opción **(a) Otro producto** — confirmada. Curso
**"Refuerzo Clase B"** propio en `courses`, con su propio precio y su propia cantidad de clases
(6), sin tocar el modelo de 12 prácticas de Clase B. Debe aparecer en el paso 1 (selección de
curso) del wizard de nueva matrícula, igual que cualquier otro curso.

**Riesgo heredado — hardcodeo del gate del certificado:** ASG-b-014 se cerró el 2026-08-01 como
[fix-011-i-certificado-clase-b-gate-validacion](../../fixes/fix-011-i-certificado-clase-b-gate-validacion/fix.md)
**antes** de que esta spec se activara. Ese fix implementó el gate server-side de la Edge
Function `generate-certificate-b-pdf` comparando contra **12 hardcodeado** ("no cumple el
mínimo de clases prácticas completadas (X/12)"), y el mismo criterio "12/12" vive en
`certificacion-clase-b.facade.ts` para la UI. Esta spec hereda ese hardcodeo: como el curso de
refuerzo introduce una cantidad de clases distinta (6) en el mismo dominio de "Clase B", el
gate y los KPIs deben generalizarse a leer la cantidad de clases desde el curso en vez de asumir
12 — no alcanza con "no tocar" ese código, porque un alumno de refuerzo no debe poder disparar
el flujo de certificación pensado para 12/12.

**Preguntas abiertas — resueltas (2026-08-08):**
1. ¿Emite certificado/constancia? → **Ninguno.** El curso de refuerzo no emite ningún
   documento al completarse — sin gate ni PDF nuevo que construir.
2. ¿Elegibilidad de alumnos externos? → **Cualquiera.** Cualquier alumno, nuevo o externo,
   puede matricularse directo en "Refuerzo Clase B" sin haber pasado antes por la autoescuela
   — el wizard no necesita ningún chequeo de elegibilidad nuevo.
3. ¿Precio? → **Paquete cerrado de 6 clases**, mismo modelo de precio fijo que el resto del
   catálogo de `courses`.

**Flujo de agenda y pago (2026-08-08, aclarado por el usuario):** el flujo de matrícula de
Refuerzo es el mismo wizard de Clase B estándar, con dos diferencias puntuales: (a) se agendan 6
clases en vez de 12 (ya resuelto por diseño — el wizard deriva la cantidad de sesiones desde
`practical_hours` del curso, sin lógica nueva); (b) **no se ofrece pago parcial** — siempre se
agendan y pagan las 6 clases completas, nunca la mitad. El precio inicial es **la mitad del
precio vigente de Clase B estándar** de la misma sede (ej. si Clase B cuesta $180.000, Refuerzo
cuesta $90.000) — valor fijado al crear el curso, no recalculado dinámicamente si el precio de
Clase B cambia después. **Eventualmente** (fuera de esta spec) se agregará una pestaña en
Configuración (admin) para ajustar precios de todos los cursos de todas las sedes — ver §4 Out
of scope.

**Hipótesis de valor:**
Ofrecer un curso de refuerzo de 6 clases sin comprometer la integridad del gate de
certificación Clase B ni descuadrar los KPIs de avance de las matrículas de 12 prácticas.

---

## 2. User Stories

- **US1**: Como Secretaria, quiero poder ofrecer el curso "Refuerzo Clase B" en el paso 1 del
  wizard de nueva matrícula, para matricular alumnos que solo necesitan reforzar ciertas
  materias sin forzarlos al producto de 12 prácticas.
- **US2**: Como Admin/dueño, quiero que un alumno de "Refuerzo Clase B" nunca aparezca como
  candidato al certificado Clase B ni descuadre los KPIs de avance "N/12", para no comprometer
  la integridad del gate de certificación ni los indicadores de progreso de las matrículas
  estándar.
- **US3**: Como desarrollador que mantiene el gate del certificado (Edge Function
  `generate-certificate-b-pdf`) y `certificacion-clase-b.facade.ts`, quiero que la cantidad de
  clases requerida se lea desde el curso de la matrícula en vez de estar hardcodeada en 12,
  para que un tercer tipo de curso futuro no repita el mismo problema.
- **US4**: Como Secretaria matriculando a un alumno en "Refuerzo Clase B", quiero que el wizard
  no me ofrezca la opción de pago parcial, para que el alumno siempre agende y pague las 6
  clases completas (a diferencia de Clase B estándar, que sí permite pago parcial).

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given el paso 1 (selección de curso) del wizard de nueva matrícula, When la
  secretaria/admin lo abre, Then el curso **"Refuerzo Clase B"** aparece en la lista, con su
  propio precio, junto a los demás cursos.
- **AC2**: Given un alumno matriculado en "Refuerzo Clase B", When se consulta su avance
  (dashboard/portal alumno), Then el KPI de progreso muestra el total real del curso (ej. "N/6"),
  nunca "N/12".
- **AC3**: Given un alumno matriculado en "Refuerzo Clase B" con sus 6 clases completadas, When
  se evalúa su elegibilidad en `certificacion-clase-b.facade.ts` y en el gate server-side de
  `generate-certificate-b-pdf`, Then el criterio de elegibilidad usa la cantidad de clases del
  curso de la matrícula (leída desde `courses`), no el literal `12`.
- **AC4**: Given el listado/certificación Clase B (admin y secretaría), When se lista a un
  alumno de "Refuerzo Clase B", Then **no aparece en el listado de certificación** (no es
  candidato al certificado ni a ninguna constancia — el curso no emite documento alguno) y no
  puede disparar el flujo de generación del certificado Clase B pensado para 12/12.
- **AC5**: Given el wizard de nueva matrícula con "Refuerzo Clase B" seleccionado, When la
  secretaria llega al paso de asignación/pago, Then **no se muestra el selector de modalidad de
  pago** (Total Adelantado / Pago Parcial) — el flujo fuerza pago total de las 6 clases, sin
  opción de pago parcial.
- **AC6**: Given el curso "Refuerzo Clase B" recién creado, When se consulta su precio, Then es
  exactamente **la mitad del `base_price` vigente de Clase B estándar** de la misma sede al
  momento de crear el curso (valor fijo, no recalculado si el precio de Clase B cambia después).

### Edge cases obligatorios

- **AC-E1**: Given un alumno matriculado en un curso Clase B estándar (12 prácticas), When se
  aplica la generalización del gate/KPIs (AC2, AC3), Then el comportamiento es **idéntico al
  actual** — cero regresión funcional ni visual para las matrículas de 12 prácticas.
- **AC-E2**: Given el constraint SQL `chk_class_b_sessions_class_number_range` (`CHECK
  class_number BETWEEN 1 AND 12`) y `UNIQUE (enrollment_id, class_number)` en
  `class_b_sessions`, When se registra una sesión de un alumno de "Refuerzo Clase B" (6
  clases), Then el registro no viola el constraint existente — el mecanismo exacto (numeración
  1-6 dentro del mismo rango, o tabla/criterio separado) se define en `plan.md`.
- **AC-E3**: Given un alumno de "Refuerzo Clase B", When se cuentan sus sesiones para cualquier
  reporte/KPI que hoy asuma "de 12", Then el reporte no lo cuenta como matrícula Clase B
  incompleta (evita descuadre en indicadores agregados de avance Clase B).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Emitir cualquier certificado o constancia para "Refuerzo Clase B" — confirmado que no
  emite ninguno.
- ❌ Cualquier chequeo de elegibilidad/historial previo en el wizard para matricular en
  "Refuerzo Clase B" — confirmado que cualquier alumno puede matricularse directo.
- ❌ Precio por clase suelta — confirmado paquete cerrado de 6, mismo modelo que el resto del
  catálogo.
- ❌ Pestaña de Configuración (admin) para ajustar precios de todos los cursos de todas las
  sedes — el usuario confirmó que es un requerimiento futuro real, pero **no entra en esta
  spec**. El precio de Refuerzo se fija una sola vez al crear el curso (mitad del precio vigente
  de Clase B); ajustarlo después requiere edición manual de BD hasta que exista esa pestaña.
- ❌ Generalizar el gate/KPIs para **todos** los cursos del catálogo — el alcance se acota a que
  Clase B estándar (12) y "Refuerzo Clase B" (6) convivan sin romperse; extender a Profesional u
  otros dominios queda para spec aparte si aplica.
- ❌ Migración retroactiva de matrículas ya existentes, o cambios al wizard más allá de listar
  el curso nuevo en el paso 1.

---

## 5. Dependencias

### Specs previas
- ninguna

### Capacidades del proyecto que se asumen existentes
- `courses` (tabla de cursos/productos)
- Wizard de nueva matrícula (paso 1: selección de curso)
- `class_b_sessions` (`chk_class_b_sessions_class_number_range`, `UNIQUE (enrollment_id, class_number)`)
- Gate del certificado Clase B: `supabase/functions/generate-certificate-b-pdf/index.ts` y
  `certificacion-clase-b.facade.ts` (criterio "12/12" hardcodeado, fix-011-i)

### Capacidades nuevas requeridas
- Curso "Refuerzo Clase B" nuevo en `courses`
- Generalización del gate/KPIs para leer la cantidad de clases desde el curso en vez de asumir 12

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: `courses` (nuevo curso "Refuerzo Clase B"); posible ajuste a
  constraints de `class_b_sessions` si el rango de `class_number` debe variar por curso.
- Modelos UI nuevos: …
- RLS requerida: …

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): wizard de nueva matrícula (paso 1: selección de curso), certificación
  Clase B (admin/secretaría), KPIs de avance del alumno.
- Flujo principal (happy path): secretaria abre "Nueva matrícula" → paso 1 lista "Refuerzo Clase
  B" junto a los demás cursos → …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [x] Preguntas 1-3 resueltas (2026-08-08): sin certificado/constancia, elegibilidad abierta a
  cualquier alumno, precio de paquete cerrado. Ver §1.
- [ ] El nombre del curso es **"Refuerzo Clase B"** — debe aparecer así, tal cual, en el paso 1
  del wizard de nueva matrícula.
- [ ] Definir si el rango de `class_number` de `class_b_sessions` necesita variar por curso o si
  el curso de refuerzo usa una tabla/criterio de sesiones distinto.
- Originado de Asignación ASG-b-038 (specs/assignments/ASG-b-038-matricula-refuerzo-6-clases.md)

---

## Changelog

- 2026-08-08 — draft inicial por m, generado desde ASG-b-038 vía `/assign-claim`. Alcance
  confirmado por el usuario: incluye generalizar el gate del certificado y los KPIs (hereda el
  hardcodeo de 12 dejado por fix-011-i / ASG-b-014, cerrado antes de esta spec). Nombre del
  curso fijado como "Refuerzo Clase B".
- 2026-08-08 — User Stories (3), AC (4) y edge cases (3) redactados por Claude a partir del
  contexto ya confirmado; Out of scope acota explícitamente lo que depende de las preguntas
  abiertas 1-3 (certificado/constancia, externos, precio). Pendiente de revisión y approval del
  usuario.
- 2026-08-08 — Preguntas abiertas 1-3 resueltas por el usuario: sin certificado/constancia
  (ninguno), elegibilidad abierta a cualquier alumno, precio de paquete cerrado. AC4 y Out of
  scope actualizados en consecuencia (ya no dependen de decisiones pendientes).
- 2026-08-08 — approved por m.
- 2026-08-08 — Aclaraciones del usuario tras `/spec-plan`: (a) el flujo de Refuerzo es el mismo
  wizard de Clase B, sin pago parcial (siempre 6 clases completas) → US4 + AC5 nuevos; (b)
  precio inicial = mitad del `base_price` vigente de Clase B por sede ($90.000 si Clase B es
  $180.000) → AC6 nuevo, ya no queda pendiente; (c) tab de admin para editar precios de todos
  los cursos es un requerimiento futuro confirmado pero explícitamente fuera de esta spec (Out
  of scope). `plan.md` actualizado en consecuencia.
- 2026-08-09 — done: 9/9 AC ✅ PASA, verificado por el owner en producción (wizard, ficha de
  alumno, portal alumno, certificación, RLS pública, numeración de matrícula compartida). Bug
  real encontrado y corregido durante el QA: `saveAssignment()` tenía una whitelist de
  `courseType` que no incluía `'class_b_reinforcement'`, saltando en silencio el guardado de
  `class_b_sessions` — corregido con test de regresión, re-verificado en vivo. ASG-m-001 creada
  para 3 bugs de `audit_log` detectados en el camino, fuera de alcance de esta spec. 1896/1896
  test:ci, `lint:arch` limpio. Ver acceptance.md.
