-- Ajustes posteriores sobre cuadraturas cerradas (spec 0002-i / ASG-b-037).
-- La cuadratura cerrada es un arqueo físico inmutable; un ajuste es la única forma
-- de reflejar correcciones (ej. gasto de combustible con fecha pasada) sin borrar
-- la evidencia del snapshot original.
CREATE TABLE IF NOT EXISTS cuadratura_adjustments (
  id              SERIAL PRIMARY KEY,
  cuadratura_id   INT NOT NULL REFERENCES cash_closings(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('gasto_olvidado', 'correccion_manual')),
  monto           INTEGER NOT NULL,              -- signo: negativo reduce el total vigente
  motivo          TEXT NOT NULL,
  expense_id      INT REFERENCES expenses(id),   -- solo si tipo = 'gasto_olvidado'
  registered_by   INT NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cuadratura_adjustments IS
  'Ajustes posteriores sobre cuadraturas cerradas (spec 0002-i / ASG-b-037). '
  'Inmutable: sin UPDATE ni DELETE -- una corrección mal hecha se compensa con OTRO ajuste.';

ALTER TABLE cuadratura_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_cuadratura_adjustments ON cuadratura_adjustments
  FOR SELECT USING (auth_user_role() = 'admin');

CREATE POLICY insert_cuadratura_adjustments ON cuadratura_adjustments
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

-- Sin policy de UPDATE/DELETE a propósito: ni siquiera admin puede editar/borrar un
-- ajuste vía API REST normal -- inmutabilidad real a nivel BD, no solo en la UI.
