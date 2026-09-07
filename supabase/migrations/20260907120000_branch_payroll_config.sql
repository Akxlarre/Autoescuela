-- ============================================================================
-- spec 0014-m — Tarifa por hora de instructores configurable por sede
-- ============================================================================
-- Hasta ahora el valor pagado por hora equivalente a los instructores estaba
-- hardcodeado en `5000` CLP (AMOUNT_PER_HOUR_DEFAULT en LiquidacionesFacade y
-- AMOUNT_DEFAULT en la Edge Function generate-payroll-report). El código leía
-- `instructor_monthly_payments.amount_per_hour` como si viniera de la BD, pero
-- esa columna nunca existió.
--
-- Esta tabla mueve la tarifa a configuración: una fila por sede, valor global
-- para esa sede (NO por instructor). Editable solo por Admin desde Ajustes.
-- Seed en 5000 => comportamiento idéntico al actual tras desplegar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS branch_payroll_config (
  branch_id        INT PRIMARY KEY REFERENCES branches(id),
  amount_per_hour  INTEGER NOT NULL DEFAULT 5000 CHECK (amount_per_hour >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       INT REFERENCES users(id)
);

COMMENT ON TABLE branch_payroll_config IS
  'Parametros de nomina por sede (spec 0014-m). amount_per_hour = CLP por hora '
  'equivalente de instructor. Global por sede, no por instructor. Seed = 5000.';

-- ── updated_at automatico (reutiliza public.set_updated_at(), ya usada por
--    website_config, professional_promotions y class_b_sessions) ──────────────
DROP TRIGGER IF EXISTS trg_branch_payroll_config_updated_at ON branch_payroll_config;
CREATE TRIGGER trg_branch_payroll_config_updated_at
  BEFORE UPDATE ON branch_payroll_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- SELECT: admin + secretary + instructor (los tres necesitan ver la liquidacion).
-- INSERT/UPDATE: solo admin. Sin DELETE: una sede no "pierde" su tarifa.
ALTER TABLE branch_payroll_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_branch_payroll_config ON branch_payroll_config;
CREATE POLICY select_branch_payroll_config ON branch_payroll_config
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'instructor'));

DROP POLICY IF EXISTS insert_branch_payroll_config ON branch_payroll_config;
CREATE POLICY insert_branch_payroll_config ON branch_payroll_config
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

DROP POLICY IF EXISTS update_branch_payroll_config ON branch_payroll_config;
CREATE POLICY update_branch_payroll_config ON branch_payroll_config
  FOR UPDATE USING (auth_user_role() = 'admin');

-- ── Seed idempotente: una fila por sede existente en 5000 ────────────────────
INSERT INTO branch_payroll_config (branch_id, amount_per_hour)
SELECT id, 5000 FROM branches
ON CONFLICT (branch_id) DO NOTHING;

-- ── Realtime: el canal `liquidaciones-realtime` de LiquidacionesFacade tiene
--    TRES bindings postgres_changes: instructor_monthly_payments,
--    instructor_advances y branch_payroll_config. Si CUALQUIERA de esas tablas
--    no esta en la publicacion `supabase_realtime`, el servidor invalida ese
--    binding y el canal deja de entregar eventos para TODOS sus bindings, aunque
--    el cliente reporte SUBSCRIBED (mecanismo documentado en fix-227-m /
--    20260827160000). Diagnostico spec 0014-m (2026-09-07, Playwright vs BD real):
--    un canal dedicado a branch_payroll_config SI recibe el UPDATE, pero el canal
--    de 3 bindings del Facade no dispara `refreshSilently()` -> las otras dos
--    tablas nunca se agregaron a la publicacion (grep: solo class_b_sessions,
--    notifications, payments, students, users, tasks lo estaban). El realtime de
--    Liquidaciones estuvo muerto desde que se creo el canal.
--
--    Se agregan las tres. Idempotente: cada tabla solo si aun no esta.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['instructor_monthly_payments', 'instructor_advances', 'branch_payroll_config']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
