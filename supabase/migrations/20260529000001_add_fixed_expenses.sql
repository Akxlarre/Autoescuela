-- ============================================================================
-- FIXED_EXPENSES — Gastos fijos del administrador (RF-NEW)
-- Solo admin puede leer/escribir. No visible para secretaria.
-- Se usa en Reportes Contables para calcular punto de equilibrio.
-- Categorías distintas a expenses operacionales: salary | utility | insurance | repair | rent | other
-- ============================================================================

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id            SERIAL PRIMARY KEY,
  branch_id     INT          REFERENCES branches(id),
  category      TEXT         NOT NULL CHECK (category IN ('salary', 'utility', 'insurance', 'repair', 'rent', 'other')),
  description   TEXT         NOT NULL,
  amount        INTEGER      NOT NULL CHECK (amount > 0),
  date          DATE         NOT NULL,
  created_by    INT          REFERENCES users(id),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE fixed_expenses IS 'Gastos fijos del administrador (arriendo, sueldos, servicios, reparaciones) para punto de equilibrio mensual. Admin-only.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_fixed_expenses ON fixed_expenses
  FOR SELECT USING (auth_user_role() = 'admin');

CREATE POLICY insert_fixed_expenses ON fixed_expenses
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY update_fixed_expenses ON fixed_expenses
  FOR UPDATE USING (auth_user_role() = 'admin');

CREATE POLICY delete_fixed_expenses ON fixed_expenses
  FOR DELETE USING (auth_user_role() = 'admin');
