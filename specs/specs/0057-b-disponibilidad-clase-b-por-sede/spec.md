# Spec 0057-b — La disponibilidad de Clase B dice de qué sede es cada horario

> **Status:** approved
> **Created:** 2026-11-06
> **Owner:** Akxlarre
> **Priority:** P2 (por confirmar)
> **refs:** ASG-i-026 (caso F08 de `specs/testing-piloto/026-agenda-triple-match.md`, registrado en `fix-186-b`)

---

## 1. Contexto de negocio

**Origen:** caso F08 del testing de la Agenda (2026-11-06). El owner eligió la "opción A":
que la vista diga de qué sede es cada horario y que cada consumidor filtre por la sede que le
corresponde.

**Persona afectada:** Secretaria y Admin (Agenda y matrícula), Alumno (matrícula online y pago).

**Problema que resuelve:**
`v_class_b_schedule_availability` arma los horarios por sede (el `JOIN vehicles` exige que el
vehículo sea de la sede del curso o "ambas sedes"), pero no expone esa sede. Los 5 consumidores
filtran solo por `instructor_id`. Resultado: un instructor "ambas sedes" con un vehículo de la
sede 1 aparece en la sede 2 con los horarios de la sede 1 como "Disponible" (59 en la prueba).
Una secretaria de la sede 2, o un alumno en la matrícula online, podría agendar clases con un
auto que está en la otra sede.

**Impacto hoy:** ninguno. No hay instructores ni vehículos "ambas sedes" y en todo el historial
no hay clases con instructor o vehículo de otra sede (consulta del 2026-11-06). El problema
aparece el día que se marque un instructor "ambas sedes".

**Hipótesis de valor:** marcar un instructor "ambas sedes" nunca ofrece horarios con un vehículo
que no puede atender esa sede.

---

## 2. User Stories

> Borrador derivado de la opción A. Revisar antes de aprobar.

- **US1**: Como secretaria de una sede, quiero ver y ofrecer solo horarios que mi sede puede
  atender, para no agendar clases con un auto de la otra sede.
- **US2**: Como alumno en la matrícula online o en el pago, quiero que solo se me ofrezcan
  horarios de mi sede.
- **US3**: Como admin, quiero que un instructor y vehículo "ambas sedes" sigan ofreciendo sus
  horarios en las dos sedes, y que en "Todas las sedes" cada horario aparezca una sola vez.

---

## 3. Acceptance Criteria (Gherkin)

> Borrador. Revisar antes de aprobar.

- **AC1**: Given la vista `v_class_b_schedule_availability`, When se consulta, Then cada fila
  trae `branch_ids` = las sedes de los cursos de los que sale ese horario (arreglo: una fila por
  horario, como exige fix-227-b).
- **AC2**: Given un instructor "ambas sedes" con vehículo solo de la sede 1, When la Agenda se
  mira en la sede 2, Then ese instructor no ofrece ningún horario "Disponible" (F08 del e2e pasa
  de anotar 59 a esperar 0).
- **AC3**: Given el mismo instructor, When la Agenda se mira en la sede 1, Then ofrece sus
  horarios como hoy.
- **AC4**: Given instructor y vehículo "ambas sedes", When la Agenda se mira en cada sede, Then
  ofrece horarios en las dos (F03 sigue en verde).
- **AC5**: Given el admin en "Todas las sedes" y un instructor/vehículo "ambas sedes", When mira
  la Agenda, Then cada horario aparece una sola vez (sin duplicados por sede).
- **AC6**: Given el asistente de matrícula de secretaria, When elige un instructor, Then la
  grilla solo trae horarios de la sede de la matrícula (`enrollment.facade.ts`, carga inicial y
  refresco Realtime).
- **AC7**: Given la ficha del alumno, When se reagenda, Then la grilla solo trae horarios de la
  sede del alumno (`admin-alumno-detalle.facade.ts`).
- **AC8**: Given la edge function `public-enrollment`, When carga la grilla de un instructor,
  Then filtra por la sede de la matrícula. (`student-payment` → `load-instructor-schedule` es
  legacy sin uso desde fix-017: fuera de alcance.)
- **AC9**: Given la vista con la columna nueva, When se mide con `EXPLAIN ANALYZE` la consulta
  de la Agenda de una semana, Then no es más lenta que hoy en más de un 20 %.

### Edge cases obligatorios

- **AC-E1**: Given un instructor de una sola sede (el caso de todos hoy), When se mira la Agenda
  o la matrícula, Then los horarios son exactamente los mismos que antes del cambio.
- **AC-E2**: Given la RLS por fila de la vista (`fix196`), When una secretaria de la sede 2 la
  consulta, Then sigue viendo lo que le corresponde (la columna nueva no abre ni cierra filas).

---

## 4. Out of scope

- ❌ Prohibir la combinación instructor "ambas sedes" + vehículo de una sede (opción B, descartada).
- ❌ Bloques horarios distintos por sede (hoy son iguales; la vista ya los arma por sede).
- ❌ S14 (clases `reserved` que dejan la celda vacía) y la regla de documentos vencidos (B12).

---

## 5. Dependencias

### Specs previas
- Ninguna. Conviene mergear antes PR #371 (tests de la Agenda, incluye F08/F03).

### Capacidades del proyecto que se asumen existentes
- `BranchFacade.selectedBranchId()` y `resolveBranchScope()` en la Agenda.
- `enrollments.branch_id`, `users.branch_id`, `instructors.both_branches`, `vehicles.both_branches`.

### Capacidades nuevas requeridas
- Columna `branch_id` en `v_class_b_schedule_availability` (migración de la vista en producción:
  confirmar con el owner antes de aplicar).
- Redespliegue de `public-enrollment` y `student-payment`.

---

## 6. Datos y modelo (preliminar)

- Vista modificada: `v_class_b_schedule_availability` (+ `branch_id` = `cs.branch_id`; el
  `DISTINCT` final pasa a incluirla).
- Tablas: sin cambios.
- RLS: sin cambios (verificar AC-E2).
- Modelos: el tipo de la fila de la vista suma `branch_id`.

---

## 7. UX y flujos (preliminar)

- Sin cambios visuales. Cambia qué horarios se ofrecen en Agenda, matrícula (secretaria y
  online), ficha del alumno y pago, solo para instructores "ambas sedes".

---

## 8. Métricas de éxito post-launch

- 0 clases con vehículo de una sede distinta a la de la matrícula (la consulta del 2026-11-06).

---

## 9. Notas / decisiones abiertas

- [ ] Confirmar prioridad (propuesta P2: hoy no afecta datos reales).
- [ ] Confirmar la regla de negocio: un instructor "ambas sedes" con auto de una sola sede no da
      clases en la otra (si "el auto se mueve", lo que corresponde es marcar el vehículo).
- [ ] En "Todas las sedes", ¿el detalle de un horario debe mostrar de qué sede es?

---

## Changelog

- 2026-11-06 — draft inicial por Akxlarre (opción A elegida tras F08)
- 2026-11-06 — aprobada por el owner (P2 y ACs del borrador aceptados)
- 2026-11-06 — plan aprobado: AC1 pasa a `branch_ids` (arreglo) y AC8 deja fuera `student-payment`
