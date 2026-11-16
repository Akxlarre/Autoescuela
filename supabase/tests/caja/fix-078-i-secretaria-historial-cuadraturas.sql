-- ============================================================================
-- Prueba de BD — fix-078-i (AC-4): la secretaria ve el historial completo de cierres de SU sede y
-- sus ajustes; no ve los de la otra sede, y los demás roles no ven ninguno
-- ============================================================================
-- Migración: 20261116120000_fix078i_secretaria_historial_cuadraturas.sql.
-- Qué cambió: select_cash_closings ya no limita a la secretaria a los últimos 3 días, y
-- select_cuadratura_adjustments deja de ser solo admin. El alcance por sede lo da branch_visible.
--
-- Los cierres y ajustes de prueba los crea postgres; las consultas corren como el rol
-- authenticated suplantando a admin@test.com, a secretaria@test.com (sede 1, sin acceso a ambas
-- sedes) y a un instructor cualquiera. Todo dentro de una transacción que termina en RAISE: no
-- deja cambios. Fechas de 2001 (sin cierres reales): con la política anterior, que exigía
-- date >= hoy - 2, la secretaria no las veía.
--   npx supabase db query --linked -f supabase/tests/caja/fix-078-i-secretaria-historial-cuadraturas.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE t078 ON COMMIT DROP AS
WITH c AS (
  INSERT INTO public.cash_closings (date, branch_id, status, closed) VALUES
    ('2001-01-01', 1, 'closed', true),
    ('2001-01-02', 2, 'closed', true)
  RETURNING id, branch_id
),
a AS (
  INSERT INTO public.cuadratura_adjustments (cuadratura_id, tipo, monto, motivo, registered_by)
  SELECT c.id, 'correccion_manual', 1000, 'Prueba fix-078-i',
         (SELECT id FROM public.users ORDER BY id LIMIT 1)
  FROM c
  RETURNING id, cuadratura_id
)
SELECT c.branch_id AS sede, c.id AS cierre, a.id AS ajuste,
       (SELECT u.supabase_uid
          FROM public.users u JOIN public.roles r ON r.id = u.role_id
         WHERE r.name = 'instructor' AND u.supabase_uid IS NOT NULL AND u.active IS NOT FALSE
         ORDER BY u.id LIMIT 1) AS instructor_uid
FROM c JOIN a ON a.cuadratura_id = c.id;
GRANT SELECT ON t078 TO authenticated;

SET LOCAL role authenticated;

DO $test$
DECLARE
  r        text := '';
  v_c1     int := (SELECT cierre FROM t078 WHERE sede = 1);
  v_c2     int := (SELECT cierre FROM t078 WHERE sede = 2);
  v_a1     int := (SELECT ajuste FROM t078 WHERE sede = 1);
  v_a2     int := (SELECT ajuste FROM t078 WHERE sede = 2);
  v_instr  uuid := (SELECT instructor_uid FROM t078 LIMIT 1);
  n        int;
BEGIN
  -- ── Secretaria (sede 1) ────────────────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims',
    '{"sub":"bc4dbbc8-2fef-433d-bede-61f00ae10976","role":"authenticated"}', true);

  -- Precondición: si la cuenta de prueba cambió de sede o ganó acceso a ambas, los casos 2 y 4
  -- dejarían de probar el aislamiento. Se informa como falla en vez de pasar en falso.
  r := r || '0 la secretaria de prueba es de la sede 1 y sin acceso a ambas: '
    || CASE WHEN public.auth_user_role() = 'secretary'
              AND public.auth_user_branch_id() = 1
              AND NOT public.auth_can_access_both_branches()
            THEN 'ok' ELSE 'FALLA (precondición)' END || ' | ';

  SELECT count(*) INTO n FROM public.cash_closings WHERE id = v_c1;
  r := r || '1 secretaria ve un cierre antiguo de su sede: '
    || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA' END || ' | ';

  SELECT count(*) INTO n FROM public.cash_closings WHERE id = v_c2;
  r := r || '2 secretaria no ve el cierre de la otra sede: '
    || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END || ' | ';

  SELECT count(*) INTO n FROM public.cuadratura_adjustments WHERE id = v_a1;
  r := r || '3 secretaria ve el ajuste de un cierre de su sede: '
    || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA' END || ' | ';

  SELECT count(*) INTO n FROM public.cuadratura_adjustments WHERE id = v_a2;
  r := r || '4 secretaria no ve el ajuste de la otra sede: '
    || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END || ' | ';

  -- ── Admin ──────────────────────────────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims',
    '{"sub":"d3fdf4cc-2b54-4b67-8ebe-00d38d1f7fe5","role":"authenticated"}', true);

  SELECT count(*) INTO n FROM public.cash_closings WHERE id IN (v_c1, v_c2);
  r := r || '5 admin ve los cierres de las dos sedes: '
    || CASE WHEN n = 2 THEN 'ok' ELSE 'FALLA' END || ' | ';

  SELECT count(*) INTO n FROM public.cuadratura_adjustments WHERE id IN (v_a1, v_a2);
  r := r || '6 admin ve los ajustes de las dos sedes: '
    || CASE WHEN n = 2 THEN 'ok' ELSE 'FALLA' END || ' | ';

  -- ── Instructor ─────────────────────────────────────────────────────────────────────────────
  IF v_instr IS NULL THEN
    r := r || '7 instructor no ve cierres ni ajustes: FALLA (no hay instructor con sesión para probar) | ';
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_instr, 'role', 'authenticated')::text, true);
    SELECT (SELECT count(*) FROM public.cash_closings WHERE id IN (v_c1, v_c2))
         + (SELECT count(*) FROM public.cuadratura_adjustments WHERE id IN (v_a1, v_a2))
      INTO n;
    r := r || '7 instructor no ve cierres ni ajustes: '
      || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END || ' | ';
  END IF;

  -- ── Sesión sin usuario en la tabla users ───────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM public.cash_closings WHERE id IN (v_c1, v_c2))
       + (SELECT count(*) FROM public.cuadratura_adjustments WHERE id IN (v_a1, v_a2))
    INTO n;
  r := r || '8 una sesión sin usuario no ve cierres ni ajustes: '
    || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;

ROLLBACK;
