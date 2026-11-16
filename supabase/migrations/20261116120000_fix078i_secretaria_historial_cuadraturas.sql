-- fix-078-i (AC-4): la secretaria ve el historial completo de cierres de SU sede y sus ajustes.
--
-- Antes: select_cash_closings limitaba a la secretaria a los últimos 3 días
-- (date >= chile_today() - 2), y select_cuadratura_adjustments era solo admin.
-- Decisión de negocio (Ignacio, 2026-11-15): la secretaria ve el historial de su sede, sin
-- ventana de fechas. El alcance por sede lo sigue dando branch_visible(branch_id).
-- Idempotente: DROP POLICY IF EXISTS + CREATE.

DROP POLICY IF EXISTS select_cash_closings ON public.cash_closings;
CREATE POLICY select_cash_closings ON public.cash_closings
  FOR SELECT
  USING (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND public.branch_visible(branch_id)
    )
  );

DROP POLICY IF EXISTS select_cuadratura_adjustments ON public.cuadratura_adjustments;
CREATE POLICY select_cuadratura_adjustments ON public.cuadratura_adjustments
  FOR SELECT
  USING (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND EXISTS (
        SELECT 1
        FROM public.cash_closings c
        WHERE c.id = cuadratura_id
          AND public.branch_visible(c.branch_id)
      )
    )
  );
