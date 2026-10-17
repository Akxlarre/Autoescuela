-- ============================================================================
-- Prueba de BD — fix-434-m: solo el admin administra el catálogo de servicios
-- ============================================================================
-- Migración: 20261015150000_fix434_catalogo_servicios_solo_admin.sql.
-- Corre como el rol authenticated suplantando a una secretaria y al admin de prueba
-- (secretaria@test.com, admin@test.com) dentro de una transacción que termina en RAISE: no deja
-- cambios. Correr:
--   npx supabase db query --linked -f supabase/tests/rls/fix-434-m-catalogo-servicios-solo-admin.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

BEGIN;
SET LOCAL role authenticated;

DO $test$
DECLARE
  r  text := '';
  n  int;
  v_id int;
BEGIN
  -- Secretaria (sede 1)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"bc4dbbc8-2fef-433d-bede-61f00ae10976","role":"authenticated"}', true);

  SELECT count(*) INTO n FROM public.service_catalog;
  r := r || '1 secretaria lee: ' || CASE WHEN n > 0 THEN 'ok' ELSE 'FALLA' END || ' | ';

  BEGIN
    INSERT INTO public.service_catalog (name, base_price) VALUES ('Prueba fix-434', 1000);
    r := r || '2 secretaria crea: FALLA | ';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '2 secretaria crea: ok | ';
  END;

  UPDATE public.service_catalog SET base_price = base_price;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || '3 secretaria edita: ' || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END || ' | ';

  -- Los servicios existentes tienen ventas: si la policy deja pasar el DELETE, lo detiene la FK.
  BEGIN
    DELETE FROM public.service_catalog;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || '4 secretaria borra: ' || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END || ' | ';
  EXCEPTION WHEN foreign_key_violation THEN
    -- La policy la dejó intentar el borrado: solo la FK lo detuvo.
    r := r || '4 secretaria borra: FALLA | ';
  END;

  -- Admin
  PERFORM set_config('request.jwt.claims',
    '{"sub":"d3fdf4cc-2b54-4b67-8ebe-00d38d1f7fe5","role":"authenticated"}', true);

  INSERT INTO public.service_catalog (name, base_price) VALUES ('Prueba fix-434', 1000)
  RETURNING id INTO v_id;
  UPDATE public.service_catalog SET base_price = 2000 WHERE id = v_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || '5 admin crea y edita: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA' END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;

ROLLBACK;
