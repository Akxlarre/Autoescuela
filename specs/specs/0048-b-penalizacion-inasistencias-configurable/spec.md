# Spec 0048-b — Cancelación automática por inasistencias configurable por sede

> **Status:** done
> **Created:** 2026-10-06
> **Owner:** Benjamín
> **Priority:** P0 (bloquea operar el piloto con riesgo bajo)

---

## 1. Contexto de negocio

**Origen:** hallazgo H1 / sospecha S1 de `fix-186-b` (testing de la Agenda, `ASG-i-026`).

Regla vigente (RF-053): cada noche, `mark_end_of_day_class_b_absences()` (pg_cron, 01:00 UTC) marca
`no_show` + asistencia "Ausente" toda clase de hoy o anterior que siga `scheduled`, y por cada
matrícula afectada llama a `apply_class_b_absence_penalty()`: con 2 faltas en clases consecutivas
(N, N+1) **cancela todas las clases agendadas que le quedan al alumno**. La misma función la llama
la secretaria al marcar "Ausente" a mano en Asistencia B (`AsistenciaClaseBFacade.applyAbsencePenalty`).

Con el portal Instructor bloqueado en el piloto, la única forma de que una clase no termine en
falta es que la secretaria la **inicie el mismo día** en Asistencia B. **Ya pasó:** entre el 15 y
el 23-sep el cron canceló **174 clases futuras de ~69 matrículas** en la BD del piloto porque nadie
las inició. Recuperarlas es manual, alumno por alumno ("Reagendar Clases").

**Decisión del owner (2026-10-06):** la cancelación automática pasa a ser **configurable en
Ajustes**, por sede, desactivada por defecto durante el piloto. Aprovechando que se toca Ajustes, la
pestaña de configuración se ordena en grupos (hoy son 11 bloques seguidos sin agrupar).

## 2. User Stories

- **Como admin**, quiero activar o desactivar por sede la cancelación automática de la agenda tras
  2 faltas consecutivas, para que durante el piloto un día sin registrar asistencias no le borre la
  agenda a los alumnos.
- **Como admin**, quiero que al reactivarla no se castiguen faltas antiguas, para no cancelar de
  golpe la agenda de todos los que acumularon faltas mientras estuvo apagada.
- **Como secretaria**, quiero ver si la cancelación automática está activa en mi sede, para saber
  qué pasa si no registro una clase.

## 3. Acceptance Criteria (Gherkin)

**AC1 — Configuración por sede en BD, desactivada por defecto**
- Dado el despliegue de esta spec, cuando consulto la configuración, entonces existe una fila por
  sede con la cancelación automática **desactivada**, guardada en la BD (no en el navegador).

**AC2 — Desactivada: no se cancela nada**
- Dada una sede con la cancelación desactivada y un alumno con 2 faltas consecutivas, cuando corre
  el cron nocturno **o** la secretaria marca "Ausente" a mano, entonces no se cancela ninguna clase
  y `apply_class_b_absence_penalty()` devuelve 0.

**AC3 — Activada: la regla de siempre**
- Dada una sede con la cancelación activada, cuando un alumno registra 2 faltas consecutivas
  después de la activación, entonces se cancelan sus clases `scheduled` 1–12 (comportamiento actual).

**AC4 — Sin castigo retroactivo**
- Dada una sede que se activa en el instante T, cuando el alumno tiene un par de faltas
  consecutivas registradas antes de T, entonces ese par **no** cancela nada; solo cuentan las faltas
  registradas en T o después. Reactivar después de apagar vuelve a fijar T.

**AC5 — El cron sigue cerrando el día**
- Con la cancelación activada o no, el cron sigue marcando `no_show` + "Ausente" las clases no
  iniciadas (solo cambia si cancela o no).

**AC6 — Solo el admin la cambia, con registro**
- Cuando una secretaria intenta modificar la configuración (incluso por API), entonces no se
  modifica nada. Cuando el admin la cambia, queda registrado quién y cuándo.

**AC7 — Ajustes: interruptor por sede**
- Dado un admin en Ajustes → Configuración → "Reglas de la escuela", cuando abre "Cancelación
  automática por inasistencias", entonces ve un interruptor por sede con su estado y la fecha desde
  la que está activa; al cambiarlo se guarda y recibe confirmación.
- Dada una secretaria, entonces ve el estado de **su** sede en solo lectura.

**AC8 — Ajustes ordenado en grupos**
- La pestaña de configuración muestra sus bloques en 3 grupos: "Mis preferencias", "Reglas de la
  escuela" y "Catálogos". No se pierde ningún bloque existente y cada rol sigue viendo solo los suyos.

**AC-E1 — Sin configuración = desactivada**
- Una matrícula sin sede, o de una sede sin fila de configuración, se trata como desactivada.

**AC-E2 — Aviso al marcar "Ausente" con la cancelación desactivada**
- Cuando la secretaria marca "Ausente" y el alumno queda con 2 faltas consecutivas en una sede con la
  cancelación desactivada, entonces ve un aviso de que la agenda **no** se canceló automáticamente
  (la alerta de faltas consecutivas de Asistencia B se mantiene).

## 4. Out of scope

- Pasar el "Límite de Visualización de Agenda" a la BD (hoy en `localStorage`, C08/S3) → backlog.
- Revisión/testing de los demás editores de Ajustes y del selector de sede duplicado → asignación
  de testing aparte.
- Cambiar la regla RF-053 (cuántas faltas, consecutivas o no).
- Aviso proactivo a la secretaria de clases del día sin iniciar.

## 5. Dependencias

- `fix-188-b` no es requisito, pero toca la misma tabla (`class_b_sessions`) por triggers.
- Acceso a la BD del piloto para validar y aplicar (hoy bloqueado por un error de autorización de
  Supabase: ver plan §Riesgos).

## 6. Datos y modelo

Tabla nueva `branch_absence_penalty_config` (patrón `branch_payroll_config`):
`branch_id` (PK → branches), `auto_cancel_enabled` (bool, def false), `enabled_since`
(timestamptz, null), `updated_at`, `updated_by` (→ users). Seed: una fila por sede, desactivada.

## 7. UX y flujos

Ajustes → Configuración → grupo "Reglas de la escuela" → tarjeta "Cancelación automática por
inasistencias" → drawer con un interruptor por sede (admin) o el estado de su sede (secretaria).

## 8. Métricas de éxito post-launch

- 0 clases canceladas por el cron en sedes con la regla desactivada.

## 9. Notas / decisiones abiertas

- Cuándo reactivar la regla en cada sede: decisión operativa del owner al terminar el piloto.

## Changelog

- 2026-10-06 — creada y aprobada por el owner ("si, dale") tras la propuesta de 6 puntos.
