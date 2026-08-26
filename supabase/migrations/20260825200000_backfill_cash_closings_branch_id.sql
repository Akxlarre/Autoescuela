-- Backfill de branch_id en cash_closings huérfanos (branch_id IS NULL), creados antes de
-- fix-212-m-cuadratura-requiere-sede-especifica cuando era posible cerrar caja con
-- "Todas las sedes" seleccionado (branch_id se insertaba NULL). Ver
-- fix-218-m-backfill-cash-closings-branch-id.
--
-- Regla: si TODOS los movimientos con sede identificable de esa fecha (payments vía
-- enrollments.branch_id, special_service_sales.branch_id, standalone_course_enrollments vía
-- standalone_courses.branch_id, expenses.branch_id) pertenecen a una sola sede, se asigna esa
-- sede al cierre. Si están mezclados entre 2+ sedes, o no hay ninguna sede identificable, la
-- fila se deja como está (branch_id sigue NULL) — decisión explícita del dueño de negocio, no se
-- adivina. instructor_advances no tiene columna branch_id y se excluye del cálculo.
--
-- Idempotente: solo toca filas con branch_id IS NULL, así que reejecutarla no cambia nada una
-- vez aplicado el backfill.

DO $$
DECLARE
  huerfanos_antes INT;
  huerfanos_despues INT;
  actualizados INT;
BEGIN
  SELECT COUNT(*) INTO huerfanos_antes FROM cash_closings WHERE branch_id IS NULL;

  WITH orphan_closings AS (
    SELECT id, date
    FROM cash_closings
    WHERE branch_id IS NULL
  ),
  day_branches AS (
    -- payments -> enrollments.branch_id
    SELECT oc.id AS closing_id, e.branch_id
    FROM orphan_closings oc
    JOIN payments p ON p.payment_date = oc.date AND p.status IN ('paid', 'completado')
    JOIN enrollments e ON e.id = p.enrollment_id
    WHERE e.branch_id IS NOT NULL

    UNION ALL

    -- special_service_sales.branch_id directo
    SELECT oc.id, s.branch_id
    FROM orphan_closings oc
    JOIN special_service_sales s ON s.sale_date = oc.date AND s.paid = true
    WHERE s.branch_id IS NOT NULL

    UNION ALL

    -- standalone_course_enrollments -> standalone_courses.branch_id
    SELECT oc.id, sc.branch_id
    FROM orphan_closings oc
    JOIN standalone_course_enrollments sce
      ON sce.paid_at >= oc.date::timestamp
     AND sce.paid_at < (oc.date + INTERVAL '1 day')::timestamp
     AND sce.payment_status = 'paid'
    JOIN standalone_courses sc ON sc.id = sce.standalone_course_id
    WHERE sc.branch_id IS NOT NULL

    UNION ALL

    -- expenses.branch_id directo
    SELECT oc.id, ex.branch_id
    FROM orphan_closings oc
    JOIN expenses ex ON ex.date = oc.date
    WHERE ex.branch_id IS NOT NULL
  ),
  single_branch_closings AS (
    SELECT closing_id, MIN(branch_id) AS branch_id
    FROM day_branches
    GROUP BY closing_id
    HAVING COUNT(DISTINCT branch_id) = 1
  )
  UPDATE cash_closings cc
  SET branch_id = sbc.branch_id
  FROM single_branch_closings sbc
  WHERE cc.id = sbc.closing_id
    AND cc.branch_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM cash_closings other
      WHERE other.date = cc.date
        AND other.branch_id = sbc.branch_id
        AND other.id <> cc.id
    );

  GET DIAGNOSTICS actualizados = ROW_COUNT;
  SELECT COUNT(*) INTO huerfanos_despues FROM cash_closings WHERE branch_id IS NULL;

  RAISE NOTICE 'cash_closings backfill: % huérfanos antes, % actualizados, % huérfanos restantes (mezclados o sin movimientos identificables)',
    huerfanos_antes, actualizados, huerfanos_despues;
END $$;
