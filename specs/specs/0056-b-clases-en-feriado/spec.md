# Spec 0056-b — Una clase en un feriado no es una inasistencia

> **Status:** done (AC6 agregado y cerrado el 2026-11-06)
> **Created:** 2026-11-06
> **Owner:** Benjamín
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `ASG-i-026`, caso M09 (`fix-186-b`). Spec 0052-b dejó fuera "clases ya agendadas en un
feriado". Pueden aparecer cuando `sync-holidays` carga un feriado nuevo (por ejemplo, uno decretado
para unas elecciones) después de agendarlas, o porque se agendaron antes de que el feriado estuviera
en la tabla.

**Cómo está hoy:** el cron de las 21:00 (`mark_end_of_day_class_b_absences()`) marca "No asistió"
toda clase agendada que nadie inició, con "Ausente" para el alumno. La falta cuenta para la
penalización de 2 faltas seguidas. En desarrollo hay 6 clases del 18 y 19 de septiembre marcadas así.

**Decisión del owner (2026-11-06):** opción **B + aviso anticipado**:
1. El cron no castiga al alumno: si la clase cae en un feriado y nadie la inició, la **cancela**
   sin falta.
2. Antes de que llegue el día, la secretaría ve una **alerta** con las clases agendadas en un feriado,
   para reagendarlas. La alerta también cuenta las que el cron ya canceló y siguen sin reagendar.

## 2. Acceptance Criteria

- **AC1** — El cron cancela (`status='cancelled'`, `cancelled_at`) una clase `scheduled` cuya fecha
  en Chile está en `holidays`. No crea asistencia "Ausente" y no llama a la penalización.
- **AC2** — Las clases que no caen en feriado siguen igual (M01–M07 del test de fix-186-b en verde).
- **AC3** — Si el instructor sí hace la clase el feriado (la inicia o la completa), el cron no la
  toca.
- **AC4** — La vista `v_class_b_sessions_on_holiday` lista las clases de matrículas activas que son
  (a) `scheduled` en un feriado de hoy en adelante, o (b) `cancelled` en un feriado con `cancelled_at`
  desde el inicio de ese día (lo que cancela el cron, aunque corra un día tarde; una cancelación
  hecha antes del feriado no entra, ni la de una matrícula penalizada desde ese día: 2 faltas
  seguidas o "Borrar horarios" = perdió la agenda. Tampoco las anteriores a esta spec, que el cron
  nunca canceló por feriado: en desarrollo hay 2 del 18/09 penalizadas antes de fix-384-m). Respeta la RLS de la persona que la lee (`security_invoker`).
  Una clase reagendada sale de la vista porque cambia su fecha.
- **AC5** — El dashboard de admin y secretaria muestra la alerta "N clases en día feriado" (warning)
  con el filtro de sede vigente. Sin clases no aparece.
- **AC6** — En "Todas las alertas", la alerta tiene el botón **"Ver clases"**, que despliega cada clase
  (alumno, número de clase, fecha y feriado). Cada fila lleva a la ficha del alumno del rol que mira
  (`/app/<rol>/alumnos/<studentId>`), donde se reagenda ("Reagendar clases" para las canceladas,
  reprogramar para las agendadas). La vista expone `student_id` y `student_name`.
- **AC-E1** — Si la consulta de la alerta falla, cuenta como revisión fallida (`queryOk`), como
  las demás alertas (fix-405-m).

## 3. Fuera de alcance

- Avisarle al alumno (notificación). La alerta deja que la secretaría lo contacte.
- Corregir las 6 clases de septiembre de desarrollo (datos de prueba; una migración no debe
  reinterpretar faltas ya registradas, que pudieron ser reales).
- Un motivo de cancelación en la tabla (`cancellation_reason`).
- Feriados por sede (nota de spec 0052-b).
