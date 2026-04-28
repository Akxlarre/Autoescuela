-- ============================================================================
-- PATCH: special_service_sales — Agregar branch_id para aislamiento por sede
-- ============================================================================
-- Las ventas de servicios especiales pertenecen a una sede específica.
-- Sin este campo, un admin sin filtro de sede ve ventas de todas las escuelas.
-- Se auto-popula desde el usuario que registra la venta en el Facade.
-- ============================================================================

ALTER TABLE special_service_sales
  ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id);

COMMENT ON COLUMN special_service_sales.branch_id IS
  'Sede donde se realizó la venta. Auto-poblada desde el usuario registrador.';

-- Poblar retroactivamente: inferir branch desde el alumno registrado
UPDATE special_service_sales sss
SET branch_id = u.branch_id
FROM students s
JOIN users u ON u.id = s.user_id
WHERE sss.student_id = s.id
  AND sss.branch_id IS NULL
  AND u.branch_id IS NOT NULL;

-- Índice para filtros por sede
CREATE INDEX IF NOT EXISTS idx_special_service_sales_branch_id
  ON special_service_sales (branch_id);
