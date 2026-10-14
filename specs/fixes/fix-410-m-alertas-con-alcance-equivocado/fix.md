# Fix: alertas del dashboard que cuentan fuera de su curso o de su sede
> id: fix-410-m-alertas-con-alcance-equivocado
> refs: fix-395-m-testing-dashboards (casos Q05, Q14, Q15; sospecha S14) · facades.md §7
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Datos de dev, 2026-10-13:

1. "N alumnos listos para certificar — Completaron la 12ª clase": en la sede 2 dice 122, pero solo
   62 son de Clase B; los otros 60 son matrículas de Clase Profesional, que no tienen 12ª clase ni
   se certifican en Certificaciones B. El admin en "Todas" ve 184 con 132 alumnos B activos.
2. "N alumnos con asistencia crítica / en riesgo" (Clase Profesional): los 6 casos son de la sede 2,
   pero el admin los ve igual con la sede 1 seleccionada.
3. "N instructores sin liquidar": cuenta instructores de todas las sedes, sea cual sea la sede
   elegida.

## Root Cause

Tres revisiones de `DashboardAlertsFacade` no aplican el alcance que su propio texto y el resto del
dashboard declaran:

- `checkTwelfthClassCompleted()` filtra matrículas activas con certificado habilitado, sin
  `license_group = 'class_b'`.
- `checkRedAttendance()` / `checkYellowAttendance()` ignoran `branchId` (la vista
  `v_professional_attendance` no trae sede).
- `checkPendingInstructorPayments()` no recibe `branchId`.

## Fix

- "Listos para certificar" cuenta solo matrículas Clase B.
- Asistencia Profesional: con una sede elegida, se cuentan solo las matrículas de esa sede (se
  cruzan los `enrollment_id` de la vista contra `enrollments.branch_id`).
- Instructores sin liquidar: con una sede elegida, solo los instructores de esa sede
  (`users.branch_id`, el mismo criterio de Liquidaciones).

Sin cambios: qué mes revisa "instructores sin liquidar" y si las alertas de Clase Profesional se
muestran durante el piloto son decisiones de negocio (ver `fix-395-m`).

## Acceptance Criteria

- [x] AC1 — "Listos para certificar" filtra `license_group = 'class_b'`.
- [x] AC2 — Con una sede elegida, las alertas de asistencia Profesional cuentan solo matrículas de
      esa sede; con "Todas", todas.
- [x] AC3 — Con una sede elegida, "instructores sin liquidar" cuenta solo instructores de esa sede.

## Regression Test

- `dashboard-alerts.facade.spec.ts` → `alcance de las alertas (fix-410-m)`

## Verificación (2026-10-13)

- Unit: `dashboard-alerts.facade.spec.ts` 65/65, 4 tests nuevos. Los dos tests anteriores de
  asistencia Profesional ahora corren como admin en "Todas": su usuario de prueba no tenía rol y
  quedaba con una sede inexistente, que antes se ignoraba. `tsc` sin errores.
- Navegador, admin, drawer "Todas las Alertas":

| Sede | Listos para certificar | Asistencia crítica (Profesional) |
|---|---|---|
| Todas | 124 (antes 184) | 6 |
| Autoescuela Chillán | 62 | no aparece (antes 6) |
| Conductores Chillán | 62 (antes 122) | 6 |

- "Instructores sin liquidar" no se pudo ver en pantalla: no hay horas de instructores en octubre
  en dev. La consulta filtrada por sede se probó por API con el período de septiembre: 8
  instructores en la sede 1 y 7 en la sede 2.
