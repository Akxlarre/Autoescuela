# 0001-m — Motor de Ciclos Teóricos (Clase B)

## Estado

**Completado (2026-07-04).** Los 10 ACs fueron verificados: motor de ciclos,
asignación automática, UI de selección/roster/envío de Zoom, override de
movimiento entre ciclos, y limpieza de asistencia teórica + feature "Clase
Online". Sesiones posteriores solo aplicaron pulido de UX (tamaños, wording,
ordenamiento, estado de carga) sin afectar los ACs.

## Contexto

Las clases teóricas de Clase B se manejaban como sesiones sueltas creadas a mano
(drawer "Agendar nueva clase teórica" en `Asistencia B`) + una feature paralela
"Clase Online", ambas registrando asistencia teórica (`class_b_theory_attendance`),
dato que el dueño declaró **irrelevante**.

Se reemplaza por un **sistema de Ciclos**: cohortes de 2 semanas con 6 clases fijas
(Lun/Mié/Vie), asignación automática del alumno al matricularse Clase B, y envío del
enlace Zoom por correo a la cohorte por cada clase. La asistencia teórica desaparece.

Plan de implementación completo: `C:\Users\Usuario\.claude\plans\vivid-sniffing-pnueli.md`.

## Decisiones de negocio (confirmadas con el dueño)

- UI: pestaña dentro de `Asistencia B` (Prácticas | Ciclos Teóricos).
- BD: eliminar `class_b_theory_attendance`; vaciar y reutilizar `class_b_theory_sessions`
  como "clases del ciclo". Asignación al ciclo vía trigger en BD.
- Cada clase: rótulo "Clase N — <fecha>" + `tema` opcional editable, incluido en el
  correo si se llena.
- Feature "Clase Online": eliminar por completo.
- `pct_theory_attendance`: quitar en todos lados; progreso del alumno = solo prácticas (0/12).
- Override admin/secretaria: reasignar/mover alumnos entre ciclos.
- Envío de Zoom: destinatarios preseleccionados (toda la cohorte) con opción de
  des-seleccionar antes de despachar.

## Acceptance Criteria

- **AC-01** (RF-01/03): Existe el concepto "Ciclo Teórico" con `start_date` (siempre
  lunes), `end_date` (viernes de la semana siguiente = start+11) y `status`
  (`active`|`finished`). Cada ciclo genera 6 clases en Lun/Mié/Vie (offsets 0,2,4,7,9,11).
- **AC-02** (RF-04): Matrícula Clase B registrada Lun/Mar/Mié → alumno asignado al
  ciclo cuyo lunes es el de la semana en curso.
- **AC-03** (RF-05): Matrícula Clase B registrada Jue/Vie/Sáb/Dom → alumno asignado al
  ciclo nuevo que inicia el lunes de la semana siguiente.
- **AC-04** (RF-06): La asignación ocurre automática e inmediata al quedar la matrícula
  Clase B `active`, en todos los flujos (presencial, online, re-matrícula), sin acción
  manual. Si el ciclo no existe, se crea con sus 6 clases.
- **AC-05** (RF-10/11): En `Asistencia B`, pestaña "Ciclos Teóricos" permite seleccionar
  un ciclo concreto (etiqueta tipo "Ciclo — Lunes 15 de Octubre").
- **AC-06** (RF-12): Al ver un ciclo se listan todos los alumnos de esa cohorte.
- **AC-07** (RF-14): Por cada una de las 6 clases se puede ingresar/editar el enlace Zoom
  (y un tema opcional).
- **AC-08** (RF-15/16): Botón por clase despacha el enlace por correo a los alumnos del
  ciclo; los destinatarios vienen preseleccionados y se pueden des-seleccionar; el tema
  se incluye en el correo si está cargado.
- **AC-09** (override): Admin/secretaria puede mover un alumno a otro ciclo y traer a un
  alumno asignado a otro ciclo.
- **AC-10** (limpieza): La asistencia teórica deja de existir; `class_b_theory_attendance`
  eliminada; `v_student_progress_b` ya no expone `pct_theory_attendance`; el progreso
  global del alumno se basa solo en prácticas; la feature "Clase Online" eliminada.
