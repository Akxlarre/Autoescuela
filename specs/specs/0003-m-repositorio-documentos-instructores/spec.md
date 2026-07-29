# Spec 0003-m — Repositorio de documentos: sección Instructores + poder abrir el archivo

> **Status:** draft
> **Created:** 2026-07-29
> **Owner:** m
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-042 (`specs/assignments/ASG-b-042-repositorio-documentos-instructores.md`),
originada en la reunión con el cliente del 2026-07-28.

**Persona afectada:** {{rol}}

**Problema que resuelve:**
Anotación de la reunión (2026-07-28), una sola viñeta con dos partes: *"Añadir opción ver
instructores en el repositorio de documentos que tenemos. Añadir opción ver pruebas
documentos."*

Parte 1 — hoy el repositorio de documentos solo cubre alumnos: las rutas existentes son
`/app/admin/documentos` y `/app/admin/documentos/alumnos/:id` (+ los equivalentes de
secretaría). Falta la sección paralela para **documentos de los instructores** (licencia,
antecedentes, etc.).

Parte 2 — "ver pruebas documentos": interpretación confirmada con el owner (2026-07-28) es
poder **abrir/previsualizar el archivo** de un documento, no solo ver su estado
(aprobado/pendiente). "Pruebas" = el respaldo.

> ⚠️ **El owner dio esta interpretación como probable, no como certeza.** Confirmar con el
> cliente antes de construir. Las otras dos lecturas descartadas eran: (a) ver los
> ensayos/exámenes rendidos por el alumno dentro del repositorio, (b) poder adjuntar la hoja
> física de la prueba rendida — hoy `class_b_exam_scores` es *"ingreso manual"* del puntaje,
> sin lugar para escanear la hoja. Si resulta ser (b), esto deja de ser un fix chico y
> necesita migración.

**Hipótesis de valor:**
{{hipótesis de valor}}

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
- (IDs de specs que deben estar `done` antes, o "ninguna")

### Capacidades del proyecto que se asumen existentes
- Visor de archivo vía `createSignedUrl(path, 3600)` en `src/app/core/facades/dms.facade.ts:171`.

### Capacidades nuevas requeridas
- (ej. "tabla `instructor_documents` nueva", "ruta de documentos de instructores")

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: …
- Modelos UI nuevos: …
- RLS requerida: …

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): …
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [ ] **¿Qué documentos necesitamos de los instructores para cumplir la ley?** El cliente
  pidió explícitamente que esta pregunta se haga como parte de la tarea. No inventar la
  lista: investigarla y validarla con el cliente antes de fijar el enum de tipos de
  documento. Los documentos de un instructor son **datos personales de un trabajador** —
  antes de definir qué se guarda y por cuánto tiempo, vale la pena pasar por el skill
  `compliance-cl` (Ley 21.719, vigencia dic-2026), no como trámite, sino porque define qué
  campos existen.
- [ ] Confirmar con el cliente la interpretación de "ver pruebas documentos" (ver sección 1)
  antes de construir el visor para instructores.
- [ ] Verificar si `student_documents` tiene el mismo visor que `school_documents` o solo
  este último, y extenderlo donde falte.
- Originado de Asignación ASG-b-042 (specs/assignments/ASG-b-042-repositorio-documentos-instructores.md)

---

## Changelog

- 2026-07-29 — draft inicial por m, a partir de ASG-b-042.
