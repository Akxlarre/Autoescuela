# Spec 0006 — Matrícula de refuerzo Clase B (6 clases) sin romper el modelo de 12 prácticas

> **Status:** draft
> **Created:** 2026-08-08
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

**Preguntas abiertas sin bloquear el diseño (confirmar con el cliente antes de cerrar el
detalle del curso):**
1. ¿El curso de refuerzo emite certificado o constancia propia, o ninguna?
2. ¿Elegibilidad de alumnos externos (que no se matricularon antes en la autoescuela)?
3. ¿Precio por clase suelta o paquete cerrado de 6?

**Hipótesis de valor:**
Ofrecer un curso de refuerzo de 6 clases sin comprometer la integridad del gate de
certificación Clase B ni descuadrar los KPIs de avance de las matrículas de 12 prácticas.

---

## 2. User Stories

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US3**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC3**: …

### Edge cases obligatorios

- **AC-E1**: Given {{caso límite}}, When …, Then …
- **AC-E2**: …

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ {{cosa que NO va}}
- ❌ {{otra cosa que NO va}}

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

- [ ] Confirmar con el cliente las preguntas 1-3 (certificado/constancia, elegibilidad de
  externos, precio por clase suelta vs. paquete cerrado) antes de cerrar el detalle del curso.
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
