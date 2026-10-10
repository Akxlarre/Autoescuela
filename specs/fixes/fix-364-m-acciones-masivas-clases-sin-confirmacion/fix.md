# Fix: "Borrar horarios" y "Reactivar" cambian clases en masa sin confirmación
> id: fix-364-m-acciones-masivas-clases-sin-confirmacion
> refs: ASG-i-052
> status: done
> closed: 2026-10-10
> created: 2026-10-10
> priority: P0

## Root Cause
[Heredado de ASG-i-052, confirmado el 2026-10-10 leyendo el código — sin ejecutar nada sobre
datos compartidos]:

Las dos acciones masivas sobre `class_b_sessions` filtran solo por matrícula y estado. Ninguna
mira la fecha de la clase ni le dice al usuario qué va a cambiar.

1. **"Borrar horarios"** (alerta del Dashboard "N alumnos con 2+ clases sin asistir").
   `AlertsDrawerComponent.handleAction()` llama `clearScheduleForEnrollment()` por cada matrícula
   de la alerta, sin diálogo: cancela **todas** las sesiones `scheduled`, pasadas y futuras, sin
   `cancelled_at` y sin avisar el resultado. Además la alerta se arma con sesiones `scheduled`
   cuya hora ya pasó, no con faltas: un alumno con 2 clases en la mañana que nadie inició todavía
   ya cae ahí, y el cierre nocturno convierte esas clases en `no_show`, así que el criterio casi
   nunca coincide con una falta real.
2. **"Reactivar"** (rail de alertas de Asistencia B). `reactivateSchedule()` pasa a `scheduled`
   todas las `cancelled` de la matrícula, sin confirmación e incluidas las de fechas pasadas, que
   el cierre nocturno convierte en inasistencias esa misma noche. Si el cupo ya lo tomó otro
   alumno, el trigger de doble agendamiento rechaza el cambio, pero el usuario solo ve "Error al
   reactivar el horario".
3. **"Eliminar"** (mismo rail) ya pedía confirmación (fix-093-b), pero también cancela clases
   `scheduled` de horas pasadas, que debían quedar para registrarse como asistencia o falta.

## ACs Afectados
Ninguno — fix autónomo. Casos del checklist del piloto que corrige: `027` H09, H10, K01, K02 y
`030` Q06, Q07.

## Cambio
- **Archivo:** `src/app/core/facades/dashboard-alerts.facade.ts`
- **Qué cambia:** la alerta B-3 se arma con inasistencias registradas vigentes (`absent`/`no_show`,
  no archivadas) en dos clases seguidas, la misma regla de RF-053, en vez de clases agendadas con
  hora pasada. Pasa a llamarse "N alumnos con 2 inasistencias seguidas". `clearScheduleForEnrollment()` se
  reemplaza por `clearSchedules(enrollmentIds)`: busca las clases **futuras** agendadas, pide
  confirmación diciendo cuántas clases y de qué alumnos, las cancela por id con `cancelled_at` y
  avisa el resultado. Sin clases futuras, avisa y no cancela nada.
- **Archivo:** `src/app/features/dashboard/alerts-drawer/alerts-drawer.component.ts`
- **Qué cambia:** una sola llamada a `clearSchedules()` en lugar de una cancelación por matrícula.
- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.ts`
- **Qué cambia:** `reactivateSchedule()` solo reactiva clases canceladas **futuras**, pide
  confirmación con la cantidad y muestra el mensaje del trigger si un horario ya está ocupado.
  `removeSchedule()` solo cancela clases futuras y, si no hay ninguna, lo dice en vez de avisar
  "Horario eliminado".
- **Archivo:** `src/app/core/utils/class-b-session.utils.ts`
- **Qué cambia:** funciones puras `enrollmentsWithConsecutiveAbsences()` (matrículas con faltas en
  dos clases seguidas) y `buildClearScheduleMessage()` (texto de confirmación, clases por alumno).

Decisiones:
- **Disponibilidad al reactivar:** la revisan los triggers de la BD (instructor, alumno y
  vehículo: fix-152-m, fix-301-m, fix-187-b), que se disparan al pasar de `cancelled` a
  `scheduled`. El `UPDATE` es una sola sentencia: si una clase choca, no se reactiva ninguna.
- **Motivo de la cancelación:** no se agrega columna. El trigger `trg_audit_class_b_sessions` ya
  registra quién y cuándo canceló cada clase, y ahora queda `cancelled_at`.
- **Faltas al reactivar:** "Reactivar" no archiva las faltas. Para devolver la agenda a un alumno
  penalizado el camino sigue siendo "Reagendar Clases" en su ficha, que sí las archiva.

## Test de Regresión
- `src/app/core/facades/dashboard-alerts.facade.spec.ts > B-3: checkConsecutiveAbsences`
- `src/app/core/facades/dashboard-alerts.facade.spec.ts > clearSchedules`
- `src/app/features/dashboard/alerts-drawer/alerts-drawer.component.spec.ts > handleAction`
- `src/app/core/facades/asistencia-clase-b.facade.spec.ts > fix-364-m: acciones sobre el horario`
- `src/app/core/utils/class-b-session.utils.spec.ts > enrollmentsWithConsecutiveAbsences`,
  `buildClearScheduleMessage`
- `e2e/acciones-masivas-clases.spec.ts` (navegador real, alumno `E2E-` propio que se borra al
  terminar)

## Verificación (2026-10-10)
- `npm run test:ci`: 3810 tests en verde. `npm run lint:arch`: sin errores.
- E2E en verde contra la BD de desarrollo. "Borrar horarios" se probó hasta el diálogo y se
  volvió atrás sin confirmar, porque la alerta incluye alumnos reales; la cancelación en sí
  quedó cubierta por los tests del Facade. "Eliminar" y "Reactivar" se ejecutaron completos
  sobre el alumno de prueba: la clase cancelada de fecha pasada no revivió.
- En la BD de desarrollo la alerta nueva lista 128 alumnos con 2 inasistencias seguidas (el
  cierre nocturno marca como falta toda clase sin registrar). De esos, solo los que tienen
  clases futuras aparecen en el diálogo.

## Hallazgo derivado
- `027` S9: tras recargar Asistencia B, la alerta volvía a mostrar "Eliminar" aunque el horario
  estuviera eliminado. Es otra causa: corregido en
  `fix-365-m-reactivar-se-pierde-al-recargar-asistencia-b`.

## Notas
- Originado de Asignación ASG-i-052
  (specs/assignments/ASG-i-052-acciones-masivas-clases-sin-confirmacion.md).
