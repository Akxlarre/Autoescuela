# Plan — Spec 0056-b (clases en feriado)

> **Status:** approved (decisión del owner del 2026-11-06 en el chat: "Sí, B + aviso")

## Cambios

1. **Migración `20261106120000_spec0056_clases_en_feriado.sql`**
   - `CREATE OR REPLACE FUNCTION mark_end_of_day_class_b_absences()`: copia de fix-384-m. Dentro del
     loop, si `EXISTS (holidays h WHERE h.date = chile_date(scheduled_at))`, cancela
     (`AND status='scheduled'`) y pasa a la siguiente, sin asistencia ni penalización.
   - `CREATE OR REPLACE VIEW v_class_b_sessions_on_holiday` (`security_invoker = true`):
     `session_id, enrollment_id, branch_id, class_number, scheduled_at, status, holiday_date,
     holiday_name`, con el criterio de AC4. `GRANT SELECT TO authenticated, service_role`.
2. **`DashboardAlertsFacade.checkClassesOnHoliday(branchId)`** (`alert-class-b-holiday`): lee la
   vista con `queryOk`, filtra `branch_id`, cuenta las clases. Test en
   `dashboard-alerts.facade.spec.ts` primero.
3. **Tests**
   - `supabase/tests/agenda/fix-186-b-cron-fin-de-jornada.sql`: M09 pasa de "anotar" a exigir
     `cancelled` sin asistencia; M09b clase iniciada en feriado no se toca (AC3); vista con una
     agendada en feriado futuro (AC4).
   - `npm run test:ci` del facade.
4. **Despliegue** a la BD de desarrollo con la migración (`apply_migration`).
5. **Índices:** `DATABASE.md` (función y vista), `FACADES.md` (alerta nueva), `DOMAIN-GOTCHAS.md`
   si aplica.
