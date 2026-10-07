-- ============================================================================
-- SCRIPT MANUAL (no es una migración) — dato D6 del checklist 037 (ASG-i-037, fix-190-b)
-- ============================================================================
-- Volumen alto en la sede 2 (Conductores Chillán) para las pruebas de rendimiento (sección Z):
-- > 300 alumnos, > 1.000 clases, > 500 pagos, > 200 documentos en la sede.
--
-- Marcas (todo lo creado acá se identifica y se borra con cleanup_d6_volumen.sql):
--   users.rut 26.xxx.xxx-? · users.email d6.NNN@e2e.test · first_names 'D6'
--   enrollments.number 'D6-NNNN'
--
-- Sin efectos sobre la operación real:
--   · Clases en estado 'cancelled' y en 2025 → no recalculan horas de instructores
--     (trg_class_b_sessions_monthly_hours solo actúa con 'completed') ni ocupan la agenda.
--   · Pagos con payment_date y created_at en 2025 → no tocan la Caja de hoy, el mes actual
--     ni la lista de "Pagos recientes".
--   · Documentos sin archivo real (storage_url ficticio): solo para volumen de listas.
--
-- Idempotente: si ya existe la matrícula D6-0001, no hace nada.
-- ============================================================================

DO $$
DECLARE
  c_alumnos   CONSTANT INT := 180;  -- sede 2 tenía 138 → > 300
  c_branch    CONSTANT INT := 2;
  c_course    CONSTANT INT := 7;    -- Clase B, sede 2, $180.000
  c_admin     CONSTANT INT := 2;    -- registered_by
  v_role      INT;
  v_inst      INT[];
  v_veh       INT[];
  i           INT;
  k           INT;
  v_rut_num   INT;
  v_dv        TEXT;
  v_sum       INT;
  v_mul       INT;
  v_n         INT;
  v_user      INT;
  v_student   INT;
  v_enr       INT;
  v_fecha     DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE number = 'D6-0001') THEN
    RAISE NOTICE 'D6 ya cargado — nada que hacer.';
    RETURN;
  END IF;

  SELECT id INTO v_role FROM public.roles WHERE name = 'student';
  SELECT array_agg(i.id ORDER BY i.id) INTO v_inst
    FROM public.instructors i JOIN public.users u ON u.id = i.user_id
   WHERE u.branch_id = c_branch AND i.active;
  SELECT array_agg(id ORDER BY id) INTO v_veh FROM public.vehicles WHERE branch_id = c_branch;

  FOR i IN 1..c_alumnos LOOP
    -- RUT 26.000.NNN con DV módulo 11 (para que el formateo y las búsquedas funcionen).
    v_rut_num := 26000000 + i;
    v_sum := 0; v_mul := 2; v_n := v_rut_num;
    WHILE v_n > 0 LOOP
      v_sum := v_sum + (v_n % 10) * v_mul;
      v_n := v_n / 10;
      v_mul := CASE WHEN v_mul = 7 THEN 2 ELSE v_mul + 1 END;
    END LOOP;
    v_dv := CASE 11 - (v_sum % 11) WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE (11 - (v_sum % 11))::TEXT END;
    v_fecha := DATE '2025-03-03' + (i % 200);

    INSERT INTO public.users (rut, first_names, paternal_last_name, maternal_last_name, email,
                              role_id, branch_id, active, first_login)
    VALUES (v_rut_num || '-' || v_dv, 'D6', 'Volumen' || lpad(i::TEXT, 3, '0'), 'Prueba',
            'd6.' || lpad(i::TEXT, 3, '0') || '@e2e.test', v_role, c_branch, true, false)
    RETURNING id INTO v_user;

    INSERT INTO public.students (user_id, birth_date, status)
    VALUES (v_user, DATE '2000-01-01', 'active')
    RETURNING id INTO v_student;

    INSERT INTO public.enrollments (number, student_id, course_id, branch_id, base_price, discount,
                                    total_paid, pending_balance, payment_status, status,
                                    license_group, payment_mode, current_step, docs_complete,
                                    contract_accepted, registration_channel, registered_by,
                                    created_at)
    VALUES ('D6-' || lpad(i::TEXT, 4, '0'), v_student, c_course, c_branch, 180000, 0,
            0, 180000, 'pending', 'active', 'class_b', 'partial', 6, true, true, 'in_person',
            c_admin, v_fecha)
    RETURNING id INTO v_enr;

    -- Pagos: 2 por alumno + 1 extra a los primeros 60 → 420 (sede 2 tenía 117 → > 500).
    FOR k IN 1..(CASE WHEN i <= 60 THEN 3 ELSE 2 END) LOOP
      INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status,
                                   payment_date, registered_by, created_at)
      VALUES (v_enr, CASE WHEN k = 1 THEN 'matricula' ELSE 'Abono' END, 45000, 45000, 'paid',
              v_fecha + (k - 1) * 7, c_admin, v_fecha + (k - 1) * 7);
    END LOOP;

    -- Documento: 1 por alumno → 180.
    INSERT INTO public.student_documents (enrollment_id, type, file_name, storage_url, status, uploaded_at)
    VALUES (v_enr, 'id_photo', 'D6-foto-' || i || '.jpg', 'd6/sin-archivo/' || i || '.jpg',
            'approved', v_fecha);

    -- Clases: 12 canceladas a los primeros 20 → 240 (sede 2 tenía 864 → > 1.000).
    IF i <= 20 THEN
      FOR k IN 1..12 LOOP
        INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number,
                                             scheduled_at, start_time, end_time, duration_min,
                                             status, cancelled_at, registered_by)
        VALUES (v_enr, v_inst[1 + (i % array_length(v_inst, 1))],
                v_veh[1 + (i % array_length(v_veh, 1))], k,
                ((v_fecha + k)::TIMESTAMP + TIME '10:00') AT TIME ZONE 'America/Santiago',
                TIME '10:00', TIME '10:45', 45, 'cancelled', v_fecha + k, c_admin);
      END LOOP;
    END IF;
  END LOOP;
END $$;
