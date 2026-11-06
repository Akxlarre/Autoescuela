# Spec 0011-i — Forzar en matrícula presencial un horario tomado por un borrador sin pago

> **Status:** draft
> **Created:** 2026-11-05
> **Owner:** Ignacio (i)
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Decisión de Ignacio al revisar `fix-072-i` (2026-11-05).

**Persona afectada:** Secretaria y Admin.

**Problema que resuelve:**
Un borrador reserva sus clases desde el paso 2, mucho antes de terminar la matrícula. Si la persona
se va a buscar un documento, ese horario queda tomado hasta 14 horas, y desde `fix-072-i` también
después de vencer, hasta que la limpieza lo borra. Si mientras tanto llega otro alumno que quiere ese
horario, la secretaria hoy no puede dárselo: solo lo ve ocupado.

**Hipótesis de valor:**
La secretaria no pierde una matrícula presente por un borrador que quizás no se termine.

---

## 2. User Stories

- **US1**: Como secretaria, quiero distinguir un horario tomado por un borrador de uno con una clase
  real, para saber que todavía se puede resolver.
- **US2**: Como secretaria, quiero ver de quién es el borrador antes de decidir, para no quitarle el
  horario a ciegas.
- **US3**: Como secretaria, quiero forzar un horario de un borrador sin pago, para matricular al
  alumno que tengo enfrente.
- **US4**: Como secretaria que retoma un borrador forzado, quiero saber que perdió sus horarios, para
  elegirlos de nuevo.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un horario tomado por un borrador, When la secretaria ve la grilla de matrícula
  presencial, Then ese horario se ve distinto de uno ocupado por una clase real.
- **AC2**: Given un horario en borrador, When la secretaria lo toca, Then la app muestra de quién es
  el borrador, en qué paso quedó, cuándo vence y si tiene pago.
- **AC3**: Given un borrador sin pago vivo de su sede, When la secretaria confirma forzar, Then el
  horario queda disponible para la matrícula que está creando.
- **AC4**: Given un borrador forzado, When termina la operación, Then ese borrador no conserva
  ninguna clase, vuelve al paso 2 y mantiene sus datos y documentos.
- **AC5**: Given un borrador con un pago vivo, When la secretaria toca el horario, Then la app avisa
  que lo tiene un alumno que ya pagó y no ofrece forzar.
- **AC6**: Given un borrador forzado, When se revisa la auditoría, Then aparece quién forzó y a qué
  borrador le quitó los horarios.
- **AC7**: Given un borrador forzado, When la secretaria lo retoma, Then la app avisa que perdió sus
  horarios y pide elegirlos de nuevo.

### Edge cases obligatorios

- **AC-E1**: Given dos secretarias que fuerzan el mismo horario a la vez, When ambas confirman, Then
  solo una lo obtiene y la otra recibe un mensaje claro.
- **AC-E2**: Given un borrador que recibe un pago después de abrir el aviso, When la secretaria
  confirma, Then la base rechaza forzar y no cambia nada.
- **AC-E3**: Given un borrador de otra sede, When una secretaria toca el horario, Then la app no
  ofrece forzar. El admin sí puede.
- **AC-E4**: Given un horario ocupado por una clase real, When la secretaria lo toca, Then sigue sin
  poder elegirse.

---

## 4. Out of scope

- ❌ Reprogramar y Reagendar desde la ficha del alumno.
- ❌ Matrícula pública.
- ❌ Notificar al alumno o a la secretaria que creó el borrador.
- ❌ Forzar un borrador con pago vivo.

---

## 5. Dependencias

### Specs previas
- Ninguna. Parte de `fix-072-i` (la vista cuenta los borradores vencidos) y `fix-069-i` (borrador
  con pago).

### Capacidades del proyecto que se asumen existentes
- `v_class_b_schedule_availability`, `class_b_slot_occupied()` y los triggers de choque.
- `EnrollmentFacade` con el wizard de matrícula, retomar y `saveAssignment()`.
- Auditoría con `log_change()`.

### Capacidades nuevas requeridas
- Operación atómica en la base que valide y suelte las clases del borrador.
- Una forma de que la grilla sepa qué horarios están en borrador, sin alterar lo que ya usan la
  Agenda y los demás flujos.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: a definir en `plan.md`.
- Modelos UI nuevos: estado "en borrador" del horario y datos del aviso.
- RLS requerida: forzar solo por la operación nueva. Secretaria en borradores de su sede, admin en
  todos.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): paso 2 de matrícula presencial y lista de borradores al retomar.
- Flujo principal (happy path): la secretaria toca un horario en borrador, ve el aviso, confirma, y
  el horario queda elegible para su matrícula.
- Estados especiales (loading, error, vacío): carga del aviso, borrador con pago, otra sede, y
  horario que otra secretaria acaba de tomar.

---

## 8. Métricas de éxito post-launch

- Cuántas veces se fuerza un horario, según la auditoría.

---

## 9. Notas / decisiones abiertas

Decisiones de Ignacio (2026-11-05):

- [x] Pueden forzar secretaria y admin. La secretaria, solo en borradores de su sede.
- [x] Un borrador con pago vivo no se puede forzar.
- [x] El borrador forzado suelta todas sus clases, para no quedar a medias.
- [x] No se notifica a nadie.
- [x] Alcance: solo matrícula presencial.

---

## Changelog

- 2026-11-05 — draft inicial por Ignacio (i)
