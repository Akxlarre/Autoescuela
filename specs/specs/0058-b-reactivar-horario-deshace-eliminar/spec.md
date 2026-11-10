# Spec 0058-b — "Reactivar horario" deshace solo el último "Eliminar horario"

> **Status:** done (2026-11-09 — ver `acceptance.md`)
> **Created:** 2026-11-09
> **Owner:** Akxlarre
> **Priority:** P3 (hoy no hay exposición: 0 clases futuras canceladas y la penalización automática apagada)
> **refs:** ASG-i-026 (caso N02 de `specs/testing-piloto/026-agenda-triple-match.md`, analizado en `fix-186-b`)

---

## 1. Contexto de negocio

**Origen:** caso N02 del testing de la Agenda (2026-11-09). Entre las opciones A, B y C, el owner eligió la
**opción B**: "Reactivar horario" es un **deshacer** de "Eliminar horario", no un perdón general.

**Persona afectada:** Secretaria y Admin (alertas de Asistencia y del dashboard), Alumno e Instructor
(sus clases vuelven a la agenda).

**Problema que resuelve:**
`AsistenciaClaseBFacade.reactivateSchedule()` vuelve a `scheduled` **todas** las clases futuras
`cancelled` de la matrícula, sin importar quién las canceló:

- "Eliminar horario" (Asistencia) y "Borrar horarios" (alertas del dashboard), que es lo que se quiere
  deshacer.
- La penalización automática por 2 faltas seguidas (`apply_class_b_absence_penalty`). Hoy está apagada,
  pero cuando se encienda, Reactivar anularía la sanción.
- Una cancelación del instructor (`InstructorClasesFacade.cancelClass`), que hoy no tiene botón.

Además, Reactivar no devuelve `enrollments.absence_penalty_applied_at` a su valor anterior, así que la
matrícula sigue figurando penalizada. Tampoco avisa al alumno ni al instructor, ni deja registro de quién
reactivó. `class_b_sessions` no guarda el origen de la cancelación, así que hoy no se puede distinguir un
caso del otro.

**Hipótesis de valor:** si una secretaria elimina un horario por error, lo recupera exacto con un clic. Una
sanción automática solo se levanta reagendando a conciencia ("Reagendar Clases", con horas nuevas y
motivo).

---

## 2. User Stories

- **US1**: Como secretaria, si eliminé el horario de un alumno por error, quiero reactivarlo y que todo
  quede como antes: sus clases y su estado de penalización.
- **US2**: Como escuela, quiero que las clases canceladas por la penalización automática, por un feriado o
  por el instructor no se revivan con "Reactivar horario".
- **US3**: Como alumno e instructor, quiero enterarme cuando mis clases se cancelan por "Eliminar
  horario" y cuando vuelven a la agenda.
- **US4**: Como admin, quiero saber quién eliminó y quién reactivó un horario, y cuándo.

---

## 3. Acceptance Criteria (Gherkin)

> Borrador. Revisar antes de aprobar.

- **AC1**: Given un alumno con clases futuras agendadas, When la secretaria usa "Eliminar horario" (o
  "Borrar horarios" en el dashboard), Then en **una sola transacción** se cancelan esas clases, se
  registra la eliminación (quién, cuándo, valor anterior de `absence_penalty_applied_at`) y cada clase
  cancelada queda ligada a esa eliminación.
- **AC2**: Given un horario eliminado, When se usa "Reactivar horario", Then vuelven a `scheduled`
  **solo** las clases futuras ligadas a la **última eliminación sin reactivar** de esa matrícula.
- **AC3**: Given AC2, When termina la reactivación, Then `absence_penalty_applied_at` vuelve al valor
  que tenía **antes** de la eliminación (null si no había), y la eliminación queda marcada como
  reactivada (quién, cuándo). Las clases, el sello y el registro cambian en una sola transacción.
- **AC4**: Given una matrícula cuyas clases futuras canceladas vienen de la penalización automática, de
  un feriado o del instructor (sin eliminación ligada), When se usa "Reactivar horario", Then no revive
  ninguna y el aviso dice: "Estas clases no se cancelaron con 'Eliminar horario'. Usa 'Reagendar Clases'
  en la ficha del alumno."
- **AC5**: Given una reactivación exitosa, When termina, Then el alumno y cada instructor afectado
  reciben una notificación con la cantidad de clases y la primera fecha.
- **AC6**: Given la regla de choques de fix-245-b, When alguna clase a revivir choca, Then no se revive
  ninguna y el aviso nombra la clase, su día y hora (sin regresión).
- **AC7**: Given la vista de alertas, When un horario fue eliminado y luego reactivado, Then la alerta
  vuelve a su estado de antes de eliminar (`horarioActivo` true; "Eliminar" disponible otra vez si el
  sello anterior era null).

- **AC8**: Given admin o secretaria, When reactivan un horario de su alcance, Then se permite; la
  secretaria solo en matrículas de su sede (la RPC respeta la RLS). Instructor y alumno no pueden
  llamar a la RPC.
- **AC9**: Given una eliminación exitosa (Asistencia o dashboard), When termina, Then el alumno y
  cada instructor afectado reciben una notificación con la cantidad de clases canceladas y la primera
  fecha. Hasta hoy "Eliminar" no avisaba a nadie.

### Edge cases obligatorios

- **AC-E1**: Given dos eliminaciones de la misma matrícula (eliminar → reagendar → eliminar), When se
  reactiva, Then solo vuelve la segunda; un segundo "Reactivar" no revive la primera.
- **AC-E2**: Given clases ligadas a la eliminación cuya fecha ya pasó, When se reactiva, Then esas
  quedan canceladas (como hoy, fix-364-m) y el resto vuelve.
- **AC-E3**: Given una clase ligada a una eliminación que después se recicló con "Reagendar Clases"
  (pasó a `scheduled` con hora nueva), When se reactiva, Then esa clase no se toca.
- **AC-E4**: Given dos sesiones que reactivan el mismo horario a la vez, When ambas confirman, Then una
  lo reactiva y la otra recibe "El horario ya estaba reactivado", sin duplicar notificaciones.
- **AC-E5**: Given las clases canceladas antes de esta spec (sin eliminación ligada), When se intenta
  reactivar, Then aplica AC4. En producción hoy no hay ninguna futura, así que no hace falta migrar
  datos.

---

## 4. Out of scope

- ❌ Encender la penalización automática o cambiar su regla (spec `0048-b`).
- ❌ Un botón para que el instructor cancele clases (`cancelClass` queda como está; con esta spec, si se
  conecta, Reactivar ya no revive lo que cancele).
- ❌ Deshacer "Reagendar Clases" o "Reprogramar".
- ❌ I17 (avisos a portales bloqueados): se decide aparte. Esta spec usa el mismo camino de
  notificaciones que el resto de la agenda.

---

## 5. Dependencias

### Specs previas
- fix-245-b (choques al reactivar) mergeado: PR #388.

### Capacidades del proyecto que se asumen existentes
- `NotificationsFacade.createNotification()` o el camino que ya usa "Reprogramar" para avisar.
- Triggers de doble agendamiento en `class_b_sessions`.
- `enrollments.absence_penalty_applied_at` y la lógica de alertas que lo lee (fix-384-m, fix-391-m).

### Capacidades nuevas requeridas
- Migración en **producción** (confirmar con el owner antes de aplicar). Ver §6.

---

## 6. Datos y modelo (preliminar)

- **Tabla nueva** `class_b_schedule_removals`: `id`, `enrollment_id` (FK), `removed_at`, `removed_by`
  (FK users), `previous_penalty_applied_at`, `reactivated_at`, `reactivated_by`, `created_at`. RLS por
  sede, igual que `enrollments`.
- **Columna nueva** `class_b_sessions.schedule_removal_id` (FK nullable). Solo la escribe "Eliminar". La
  penalización automática, los feriados y el instructor la dejan en null.
- **RPCs** `remove_class_b_schedule(enrollment_id)` y `reactivate_class_b_schedule(enrollment_id)`,
  transaccionales y `SECURITY INVOKER` (respetan RLS). La segunda devuelve las clases revividas para
  armar las notificaciones.
- "Reagendar Clases", al reciclar una fila, pone `schedule_removal_id` en null (AC-E3).
- Modelos: DTO de la tabla nueva en `core/models/dto/`.

---

## 7. UX y flujos (preliminar)

- El botón y el modal de confirmación no cambian de lugar. El texto pasa a: "Se volverán a agendar N
  clases que se eliminaron el {fecha} por {nombre}. Las de fechas pasadas quedan canceladas."
- Ambos caminos de "Eliminar" (Asistencia y dashboard) usan la misma RPC.

---

## 8. Preguntas abiertas para el owner

- ~~**Quién puede reactivar**~~ — **Resuelto (owner, 2026-11-09):** admin y secretaria, los mismos
  roles que pueden eliminar. La secretaria, solo en su sede (RLS de `enrollments`); el admin, en
  cualquiera.
- ~~**Avisos**~~ — **Resuelto (owner, 2026-11-09):** se avisa al alumno y al instructor tanto al
  reactivar (AC5) como al eliminar (AC9).
