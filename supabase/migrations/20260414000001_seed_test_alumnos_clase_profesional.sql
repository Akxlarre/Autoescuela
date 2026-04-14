-- ============================================================================
-- SEED: Alumnos de prueba Clase Profesional — Certificación
-- ============================================================================
-- Propósito: Crear datos de desarrollo para verificar el módulo de
--            Certificación Clase Profesional con selección en cascada.
--
-- Promoción creada:
--   · PROM-2026-01 — "Promoción Enero 2026"
--   · Inicio: 2026-01-05 (primer lunes del año)
--   · Fin:    2026-02-07 (5 semanas × 6 días, sábado)
--   · Status: 'finished'
--   · Sede:   branch_id = 2 (Conductores Chillán)
--
-- Cursos dentro de la promoción:
--   · Curso A5 (Profesional A5) — Sin alumnos
--   · Curso A4 (Profesional A4) — 8 alumnos con variedad de elegibilidad
--   · Curso A3 (Profesional A3) — Sin alumnos
--   · Curso A2 (Profesional A2) — 6 alumnos con variedad de elegibilidad
--
-- Mix de elegibilidad por alumno:
--   A4:
--     Carlos Rojas    (SEED-P-A4-001) elegible — 100% teoría, 100% práctica, nota 82
--     María Fernández (SEED-P-A4-002) elegible con advertencia — práctica 90%
--     Diego Herrera   (SEED-P-A4-003) elegible — teoría exactamente 75%
--     Valentina Torres(SEED-P-A4-004) elegible con advertencia — práctica 80%
--     Rodrigo Muñoz   (SEED-P-A4-005) NO elegible — nota promedio 70 (< 75)
--     Camila Soto     (SEED-P-A4-006) NO elegible — teoría 62.5% (< 75%)
--     Felipe Castro   (SEED-P-A4-007) NO elegible — pago pendiente
--     Andrea López    (SEED-P-A4-008) cert. ya GENERADO (folio 9001)
--   A2:
--     Marcos González (SEED-P-A2-001) elegible — 100% en todo
--     Isabel Ramírez  (SEED-P-A2-002) elegible con advertencia — práctica 80%
--     Tomás Vargas    (SEED-P-A2-003) elegible — teoría exactamente 75%
--     Patricia Aguilar(SEED-P-A2-004) elegible — nota prom 88
--     Roberto Flores  (SEED-P-A2-005) NO elegible — teoría 62.5%
--     Daniela Muñoz   (SEED-P-A2-006) NO elegible — nota promedio 72
--
-- Supuestos:
--   · branch_id = 2  (Conductores Chillán)
--   · registered_by = 2 (usuario admin existente)
--   · Cursos A2/A4 de 'conductores-chillan' ya existen en seed_data
--
-- Idempotente: seguro de re-ejecutar (ON CONFLICT / WHERE NOT EXISTS).
-- Identificadores seed: enrollments.number LIKE 'SEED-P-%'
--                       promotion.code = 'PROM-2026-SEED-01'
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- ── Cursos base ──
  v_course_a2_id          INT;
  v_course_a3_id          INT;
  v_course_a4_id          INT;
  v_course_a5_id          INT;
  v_role_student_id       INT;

  -- ── Relatores (uno por curso) ──
  v_lecturer_a2_id        INT;
  v_lecturer_a3_id        INT;
  v_lecturer_a4_id        INT;
  v_lecturer_a5_id        INT;

  -- ── Promoción y cursos ──
  v_promo_id              INT;
  v_pc_a2_id              INT;   -- promotion_course_id para A2
  v_pc_a3_id              INT;   -- promotion_course_id para A3 (sin alumnos)
  v_pc_a4_id              INT;   -- promotion_course_id para A4
  v_pc_a5_id              INT;   -- promotion_course_id para A5 (sin alumnos)

  -- ── Fechas base ──
  v_start_date  DATE := '2026-01-05';  -- primer lunes del año 2026
  v_end_date    DATE := '2026-02-07';  -- sábado semana 5

  -- ── Sesiones diarias lunes–sábado (30 días = 5 semanas × 6 días) ──
  -- Tanto teoría como práctica ocurren todos los días de la promoción.
  v_session_dates DATE[] := ARRAY[
    '2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-01-10',  -- semana 1
    '2026-01-12','2026-01-13','2026-01-14','2026-01-15','2026-01-16','2026-01-17',  -- semana 2
    '2026-01-19','2026-01-20','2026-01-21','2026-01-22','2026-01-23','2026-01-24',  -- semana 3
    '2026-01-26','2026-01-27','2026-01-28','2026-01-29','2026-01-30','2026-01-31',  -- semana 4
    '2026-02-02','2026-02-03','2026-02-04','2026-02-05','2026-02-06','2026-02-07'   -- semana 5
  ];

  -- ── IDs de sesiones por curso ──
  v_theory_ids_a4   INT[];
  v_practice_ids_a4 INT[];
  v_theory_ids_a2   INT[];
  v_practice_ids_a2 INT[];
  v_sess_id         INT;
  v_i               INT;

  -- ── Alumnos A4 ──
  v_a4_user_ids     INT[] := ARRAY[0,0,0,0,0,0,0,0];
  v_a4_student_ids  INT[] := ARRAY[0,0,0,0,0,0,0,0];
  v_a4_enroll_ids   INT[] := ARRAY[0,0,0,0,0,0,0,0];

  v_a4_ruts         TEXT[] := ARRAY[
    '11.111.111-K','22.222.222-2','33.333.333-3','44.444.444-4',
    '55.555.555-5','66.666.666-6','77.777.777-7','88.888.888-8'
  ];
  v_a4_first_names  TEXT[] := ARRAY[
    'Carlos','María','Diego','Valentina',
    'Rodrigo','Camila','Felipe','Andrea'
  ];
  v_a4_last_names   TEXT[] := ARRAY[
    'Rojas','Fernández','Herrera','Torres',
    'Muñoz','Soto','Castro','López'
  ];
  v_a4_mat_names    TEXT[] := ARRAY[
    'Méndez','Vega','Pino','Ríos',
    'Lagos','Vera','Bravo','Silva'
  ];
  v_a4_enroll_nums  TEXT[] := ARRAY[
    'SEED-P-A4-001','SEED-P-A4-002','SEED-P-A4-003','SEED-P-A4-004',
    'SEED-P-A4-005','SEED-P-A4-006','SEED-P-A4-007','SEED-P-A4-008'
  ];
  -- pending_balance: solo Felipe (idx 7) tiene saldo pendiente
  v_a4_balances     INT[]  := ARRAY[0,0,0,0,0,0,50000,0];

  -- Módulos A4 (7 módulos, escala MTT 10-100):
  -- Filas: alumno 1..8 | Columnas: módulo 1..7
  -- Carlos: avg 82 | María: avg 78 | Diego: avg 76 | Valentina: avg 90
  -- Rodrigo: avg 70 | Camila: avg 80 | Felipe: avg 82 | Andrea: avg 85
  v_a4_grades   NUMERIC[][] := ARRAY[
    ARRAY[80.0, 82.0, 84.0, 78.0, 82.0, 84.0, 84.0],  -- Carlos   avg 82.0
    ARRAY[80.0, 78.0, 76.0, 80.0, 76.0, 78.0, 80.0],  -- María    avg 78.3
    ARRAY[76.0, 76.0, 76.0, 76.0, 76.0, 76.0, 76.0],  -- Diego    avg 76.0
    ARRAY[88.0, 92.0, 90.0, 88.0, 92.0, 90.0, 90.0],  -- Valentina avg 90.0
    ARRAY[70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 70.0],  -- Rodrigo  avg 70.0 ← reprueba
    ARRAY[80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0],  -- Camila   avg 80.0
    ARRAY[80.0, 82.0, 84.0, 78.0, 82.0, 84.0, 84.0],  -- Felipe   avg 82.0
    ARRAY[84.0, 86.0, 84.0, 86.0, 84.0, 86.0, 86.0]   -- Andrea   avg 85.1
  ];

  -- ── Alumnos A2 ──
  v_a2_user_ids     INT[] := ARRAY[0,0,0,0,0,0];
  v_a2_student_ids  INT[] := ARRAY[0,0,0,0,0,0];
  v_a2_enroll_ids   INT[] := ARRAY[0,0,0,0,0,0];

  v_a2_ruts         TEXT[] := ARRAY[
    '99.999.999-9','10.101.010-1','12.121.212-2',
    '13.131.313-3','14.141.414-4','15.151.515-5'
  ];
  v_a2_first_names  TEXT[] := ARRAY[
    'Marcos','Isabel','Tomás','Patricia','Roberto','Daniela'
  ];
  v_a2_last_names   TEXT[] := ARRAY[
    'González','Ramírez','Vargas','Aguilar','Flores','Muñoz'
  ];
  v_a2_mat_names    TEXT[] := ARRAY[
    'Fuentes','Castro','Molina','Díaz','Jara','Parra'
  ];
  v_a2_enroll_nums  TEXT[] := ARRAY[
    'SEED-P-A2-001','SEED-P-A2-002','SEED-P-A2-003',
    'SEED-P-A2-004','SEED-P-A2-005','SEED-P-A2-006'
  ];
  v_a2_balances     INT[]  := ARRAY[0,0,0,0,0,0];

  v_a2_grades   NUMERIC[][] := ARRAY[
    ARRAY[80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0],  -- Marcos   avg 80.0
    ARRAY[76.0, 78.0, 76.0, 78.0, 76.0, 78.0, 78.0],  -- Isabel   avg 77.1
    ARRAY[78.0, 80.0, 78.0, 80.0, 78.0, 80.0, 80.0],  -- Tomás    avg 79.1
    ARRAY[86.0, 90.0, 88.0, 86.0, 90.0, 88.0, 90.0],  -- Patricia avg 88.3
    ARRAY[76.0, 76.0, 76.0, 76.0, 76.0, 76.0, 76.0],  -- Roberto  avg 76.0 (teoría baja)
    ARRAY[72.0, 72.0, 72.0, 72.0, 72.0, 72.0, 72.0]   -- Daniela  avg 72.0 ← reprueba
  ];

  v_cert_id  INT;
  v_j        INT;
  v_tmp_id   INT;   -- variable temporal para SELECT INTO (PL/pgSQL no permite INTO array[i] directo)

BEGIN

  -- ── 0. Resolución de IDs base ──────────────────────────────────────
  SELECT id INTO v_role_student_id FROM roles WHERE name = 'student';
  SELECT id INTO v_course_a2_id    FROM courses WHERE code = 'professional_a2';
  SELECT id INTO v_course_a3_id    FROM courses WHERE code = 'professional_a3';
  SELECT id INTO v_course_a4_id    FROM courses WHERE code = 'professional_a4';
  SELECT id INTO v_course_a5_id    FROM courses WHERE code = 'professional_a5';

  -- ── 1. RELATORES (uno por clase) ───────────────────────────────────
  INSERT INTO lecturers (rut, first_names, paternal_last_name, maternal_last_name, email, specializations, active)
  VALUES ('1.234.567-8', 'Juan Patricio', 'Álvarez', 'Riquelme', 'j.alvarez.seed@test.local', ARRAY['A4','A5'], true)
  ON CONFLICT (rut) DO NOTHING;

  INSERT INTO lecturers (rut, first_names, paternal_last_name, maternal_last_name, email, specializations, active)
  VALUES ('9.876.543-2', 'Sofía Elena', 'Reyes', 'Campos', 's.reyes.seed@test.local', ARRAY['A2','A3'], true)
  ON CONFLICT (rut) DO NOTHING;

  INSERT INTO lecturers (rut, first_names, paternal_last_name, maternal_last_name, email, specializations, active)
  VALUES ('3.456.789-0', 'Luis Andrés', 'Castillo', 'Mora', 'l.castillo.seed@test.local', ARRAY['A3'], true)
  ON CONFLICT (rut) DO NOTHING;

  INSERT INTO lecturers (rut, first_names, paternal_last_name, maternal_last_name, email, specializations, active)
  VALUES ('7.654.321-6', 'Carmen Rosa', 'Ibáñez', 'Peña', 'c.ibanez.seed@test.local', ARRAY['A5'], true)
  ON CONFLICT (rut) DO NOTHING;

  SELECT id INTO v_lecturer_a2_id FROM lecturers WHERE rut = '9.876.543-2';
  SELECT id INTO v_lecturer_a3_id FROM lecturers WHERE rut = '3.456.789-0';
  SELECT id INTO v_lecturer_a4_id FROM lecturers WHERE rut = '1.234.567-8';
  SELECT id INTO v_lecturer_a5_id FROM lecturers WHERE rut = '7.654.321-6';

  -- ── 2. PROMOCIÓN PROFESIONAL ────────────────────────────────────────
  INSERT INTO professional_promotions (
    code, name, start_date, end_date,
    max_students, status, current_day, branch_id
  )
  SELECT
    'PROM-2026-SEED-01', 'Promoción Enero 2026 (Seed)',
    v_start_date, v_end_date,
    100, 'finished', 30, 2
  WHERE NOT EXISTS (
    SELECT 1 FROM professional_promotions WHERE code = 'PROM-2026-SEED-01'
  );

  SELECT id INTO v_promo_id FROM professional_promotions WHERE code = 'PROM-2026-SEED-01';

  -- ── 3. CURSOS DENTRO DE LA PROMOCIÓN (4 cursos: A2, A3, A4, A5) ───
  -- A3 y A5 se crean sin alumnos; una promoción siempre tiene los 4 cursos.

  INSERT INTO promotion_courses (promotion_id, course_id, max_students, status, code)
  SELECT v_promo_id, v_course_a2_id, 25, 'finished', 'PC-SEED-A2-01'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_courses WHERE code = 'PC-SEED-A2-01');

  INSERT INTO promotion_courses (promotion_id, course_id, max_students, status, code)
  SELECT v_promo_id, v_course_a3_id, 25, 'finished', 'PC-SEED-A3-01'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_courses WHERE code = 'PC-SEED-A3-01');

  INSERT INTO promotion_courses (promotion_id, course_id, max_students, status, code)
  SELECT v_promo_id, v_course_a4_id, 25, 'finished', 'PC-SEED-A4-01'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_courses WHERE code = 'PC-SEED-A4-01');

  INSERT INTO promotion_courses (promotion_id, course_id, max_students, status, code)
  SELECT v_promo_id, v_course_a5_id, 25, 'finished', 'PC-SEED-A5-01'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_courses WHERE code = 'PC-SEED-A5-01');

  SELECT id INTO v_pc_a2_id FROM promotion_courses WHERE code = 'PC-SEED-A2-01';
  SELECT id INTO v_pc_a3_id FROM promotion_courses WHERE code = 'PC-SEED-A3-01';
  SELECT id INTO v_pc_a4_id FROM promotion_courses WHERE code = 'PC-SEED-A4-01';
  SELECT id INTO v_pc_a5_id FROM promotion_courses WHERE code = 'PC-SEED-A5-01';

  -- Asociar relatores via promotion_course_lecturers
  INSERT INTO promotion_course_lecturers (promotion_course_id, lecturer_id, role)
  SELECT v_pc_a2_id, v_lecturer_a2_id, 'both'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_course_lecturers WHERE promotion_course_id = v_pc_a2_id AND lecturer_id = v_lecturer_a2_id);

  INSERT INTO promotion_course_lecturers (promotion_course_id, lecturer_id, role)
  SELECT v_pc_a3_id, v_lecturer_a3_id, 'both'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_course_lecturers WHERE promotion_course_id = v_pc_a3_id AND lecturer_id = v_lecturer_a3_id);

  INSERT INTO promotion_course_lecturers (promotion_course_id, lecturer_id, role)
  SELECT v_pc_a4_id, v_lecturer_a4_id, 'both'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_course_lecturers WHERE promotion_course_id = v_pc_a4_id AND lecturer_id = v_lecturer_a4_id);

  INSERT INTO promotion_course_lecturers (promotion_course_id, lecturer_id, role)
  SELECT v_pc_a5_id, v_lecturer_a5_id, 'both'
  WHERE NOT EXISTS (SELECT 1 FROM promotion_course_lecturers WHERE promotion_course_id = v_pc_a5_id AND lecturer_id = v_lecturer_a5_id);

  -- ── 4. USUARIOS, ESTUDIANTES Y MATRÍCULAS — CURSO A4 ──────────────
  FOR v_i IN 1..8 LOOP

    -- Usuario
    INSERT INTO users (
      rut, first_names, paternal_last_name, maternal_last_name,
      email, phone, role_id, branch_id, active, first_login
    )
    SELECT
      v_a4_ruts[v_i],
      v_a4_first_names[v_i],
      v_a4_last_names[v_i],
      v_a4_mat_names[v_i],
      lower(v_a4_first_names[v_i]) || '.' || lower(v_a4_last_names[v_i]) || '.seed.a4@test.local',
      '+569' || lpad((10000000 + v_i * 1111111)::TEXT, 8, '0'),
      v_role_student_id, 2, true, false
    ON CONFLICT (rut) DO NOTHING;

    SELECT id INTO v_tmp_id FROM users WHERE rut = v_a4_ruts[v_i];
    v_a4_user_ids[v_i] := v_tmp_id;

    -- Estudiante
    INSERT INTO students (user_id, birth_date, gender, status)
    SELECT
      v_a4_user_ids[v_i],
      ('1990-01-01'::DATE + (v_i * 365))::DATE,
      CASE WHEN v_i IN (1,3,5,7) THEN 'M' ELSE 'F' END,
      'active'
    WHERE NOT EXISTS (SELECT 1 FROM students WHERE user_id = v_a4_user_ids[v_i]);

    SELECT id INTO v_tmp_id FROM students WHERE user_id = v_a4_user_ids[v_i];
    v_a4_student_ids[v_i] := v_tmp_id;

    -- Matrícula
    INSERT INTO enrollments (
      number, student_id, course_id, branch_id,
      promotion_course_id, license_group,
      base_price, discount, total_paid, pending_balance, payment_status,
      status, docs_complete, contract_accepted,
      registration_channel, registered_by
    )
    SELECT
      v_a4_enroll_nums[v_i],
      v_a4_student_ids[v_i],
      v_course_a4_id,
      2,
      v_pc_a4_id,
      'professional',
      180000,
      0,
      CASE WHEN v_a4_balances[v_i] = 0 THEN 180000 ELSE 130000 END,
      v_a4_balances[v_i],
      CASE WHEN v_a4_balances[v_i] = 0 THEN 'paid_full' ELSE 'partial' END,
      'completed',
      true, true,
      'in_person', 2
    WHERE NOT EXISTS (
      SELECT 1 FROM enrollments WHERE number = v_a4_enroll_nums[v_i]
    );

    SELECT id INTO v_tmp_id FROM enrollments WHERE number = v_a4_enroll_nums[v_i];
    v_a4_enroll_ids[v_i] := v_tmp_id;

    -- Pago
    INSERT INTO payments (
      enrollment_id, type, document_number,
      total_amount, transfer_amount, status,
      payment_date, requires_receipt, registered_by
    )
    SELECT
      v_a4_enroll_ids[v_i], 'enrollment',
      'SEED-P-A4-TRF-' || lpad(v_i::TEXT, 3, '0'),
      CASE WHEN v_a4_balances[v_i] = 0 THEN 180000 ELSE 130000 END,
      CASE WHEN v_a4_balances[v_i] = 0 THEN 180000 ELSE 130000 END,
      'paid',
      '2026-01-03', false, 2
    WHERE NOT EXISTS (
      SELECT 1 FROM payments
      WHERE enrollment_id = v_a4_enroll_ids[v_i] AND type = 'enrollment'
    );

    -- Documento (foto carnet)
    INSERT INTO student_documents (
      enrollment_id, type, file_name, storage_url, status, uploaded_at
    )
    SELECT
      v_a4_enroll_ids[v_i], 'id_photo',
      'foto_carnet_' || lower(v_a4_last_names[v_i]) || '_seed.jpg',
      'documents/seed/foto_carnet_' || lower(v_a4_last_names[v_i]) || '_seed.jpg',
      'approved', '2026-01-03 10:00:00+00'
    WHERE NOT EXISTS (
      SELECT 1 FROM student_documents
      WHERE enrollment_id = v_a4_enroll_ids[v_i] AND type = 'id_photo'
    );

    -- Contrato digital
    INSERT INTO digital_contracts (
      enrollment_id, content_hash, signature_ip, accepted_at,
      file_name, file_url
    )
    SELECT
      v_a4_enroll_ids[v_i],
      md5('contrato-seed-a4-' || v_a4_ruts[v_i]),
      '127.0.0.1',
      '2026-01-03 11:00:00+00'::TIMESTAMPTZ + (v_i * INTERVAL '5 minutes'),
      'Contrato_' || v_a4_last_names[v_i] || '_2026.pdf',
      'documents/seed/contrato_' || lower(v_a4_last_names[v_i]) || '_seed.pdf'
    WHERE NOT EXISTS (
      SELECT 1 FROM digital_contracts WHERE enrollment_id = v_a4_enroll_ids[v_i]
    );

  END LOOP;

  -- ── 5. USUARIOS, ESTUDIANTES Y MATRÍCULAS — CURSO A2 ──────────────
  FOR v_i IN 1..6 LOOP

    INSERT INTO users (
      rut, first_names, paternal_last_name, maternal_last_name,
      email, phone, role_id, branch_id, active, first_login
    )
    SELECT
      v_a2_ruts[v_i],
      v_a2_first_names[v_i],
      v_a2_last_names[v_i],
      v_a2_mat_names[v_i],
      lower(v_a2_first_names[v_i]) || '.' || lower(v_a2_last_names[v_i]) || '.seed.a2@test.local',
      '+569' || lpad((20000000 + v_i * 1234567)::TEXT, 8, '0'),
      v_role_student_id, 2, true, false
    ON CONFLICT (rut) DO NOTHING;

    SELECT id INTO v_tmp_id FROM users WHERE rut = v_a2_ruts[v_i];
    v_a2_user_ids[v_i] := v_tmp_id;

    INSERT INTO students (user_id, birth_date, gender, status)
    SELECT
      v_a2_user_ids[v_i],
      ('1992-06-01'::DATE + (v_i * 300))::DATE,
      CASE WHEN v_i IN (1,3,5) THEN 'M' ELSE 'F' END,
      'active'
    WHERE NOT EXISTS (SELECT 1 FROM students WHERE user_id = v_a2_user_ids[v_i]);

    SELECT id INTO v_tmp_id FROM students WHERE user_id = v_a2_user_ids[v_i];
    v_a2_student_ids[v_i] := v_tmp_id;

    INSERT INTO enrollments (
      number, student_id, course_id, branch_id,
      promotion_course_id, license_group,
      base_price, discount, total_paid, pending_balance, payment_status,
      status, docs_complete, contract_accepted,
      registration_channel, registered_by
    )
    SELECT
      v_a2_enroll_nums[v_i],
      v_a2_student_ids[v_i],
      v_course_a2_id,
      2,
      v_pc_a2_id,
      'professional',
      180000, 0, 180000, 0, 'paid_full',
      'completed', true, true,
      'in_person', 2
    WHERE NOT EXISTS (
      SELECT 1 FROM enrollments WHERE number = v_a2_enroll_nums[v_i]
    );

    SELECT id INTO v_tmp_id FROM enrollments WHERE number = v_a2_enroll_nums[v_i];
    v_a2_enroll_ids[v_i] := v_tmp_id;

    INSERT INTO payments (
      enrollment_id, type, document_number,
      total_amount, transfer_amount, status,
      payment_date, requires_receipt, registered_by
    )
    SELECT
      v_a2_enroll_ids[v_i], 'enrollment',
      'SEED-P-A2-TRF-' || lpad(v_i::TEXT, 3, '0'),
      180000, 180000, 'paid',
      '2026-01-03', false, 2
    WHERE NOT EXISTS (
      SELECT 1 FROM payments
      WHERE enrollment_id = v_a2_enroll_ids[v_i] AND type = 'enrollment'
    );

    INSERT INTO student_documents (
      enrollment_id, type, file_name, storage_url, status, uploaded_at
    )
    SELECT
      v_a2_enroll_ids[v_i], 'id_photo',
      'foto_carnet_' || lower(v_a2_last_names[v_i]) || '_seed.jpg',
      'documents/seed/foto_carnet_' || lower(v_a2_last_names[v_i]) || '_seed.jpg',
      'approved', '2026-01-03 10:00:00+00'
    WHERE NOT EXISTS (
      SELECT 1 FROM student_documents
      WHERE enrollment_id = v_a2_enroll_ids[v_i] AND type = 'id_photo'
    );

    INSERT INTO digital_contracts (
      enrollment_id, content_hash, signature_ip, accepted_at,
      file_name, file_url
    )
    SELECT
      v_a2_enroll_ids[v_i],
      md5('contrato-seed-a2-' || v_a2_ruts[v_i]),
      '127.0.0.1',
      '2026-01-03 11:00:00+00'::TIMESTAMPTZ + (v_i * INTERVAL '7 minutes'),
      'Contrato_' || v_a2_last_names[v_i] || '_2026.pdf',
      'documents/seed/contrato_' || lower(v_a2_last_names[v_i]) || '_seed.pdf'
    WHERE NOT EXISTS (
      SELECT 1 FROM digital_contracts WHERE enrollment_id = v_a2_enroll_ids[v_i]
    );

  END LOOP;

  -- ── 6. SESIONES TEÓRICAS — CURSO A4 (30 sesiones, una por día) ──────
  FOR v_i IN 1..30 LOOP
    INSERT INTO professional_theory_sessions (
      promotion_course_id, date, status, notes, registered_by
    )
    SELECT
      v_pc_a4_id,
      v_session_dates[v_i],
      'completed',
      '[SEED] Teoría A4 — Sesión ' || v_i,
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM professional_theory_sessions
      WHERE promotion_course_id = v_pc_a4_id
        AND notes = '[SEED] Teoría A4 — Sesión ' || v_i
    );
  END LOOP;

  SELECT ARRAY_AGG(id ORDER BY date)
  INTO v_theory_ids_a4
  FROM professional_theory_sessions
  WHERE promotion_course_id = v_pc_a4_id
    AND notes LIKE '[SEED] Teoría A4 — Sesión%';

  -- ── 7. SESIONES TEÓRICAS — CURSO A2 (30 sesiones, una por día) ──────
  FOR v_i IN 1..30 LOOP
    INSERT INTO professional_theory_sessions (
      promotion_course_id, date, status, notes, registered_by
    )
    SELECT
      v_pc_a2_id,
      v_session_dates[v_i],
      'completed',
      '[SEED] Teoría A2 — Sesión ' || v_i,
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM professional_theory_sessions
      WHERE promotion_course_id = v_pc_a2_id
        AND notes = '[SEED] Teoría A2 — Sesión ' || v_i
    );
  END LOOP;

  SELECT ARRAY_AGG(id ORDER BY date)
  INTO v_theory_ids_a2
  FROM professional_theory_sessions
  WHERE promotion_course_id = v_pc_a2_id
    AND notes LIKE '[SEED] Teoría A2 — Sesión%';

  -- ── 8. ASISTENCIA TEÓRICA — A4 ────────────────────────────────────
  --
  -- Reglas de asistencia (sobre 30 sesiones):
  --   idx 1 Carlos:    30/30 (100%)
  --   idx 2 María:     30/30 (100%)
  --   idx 3 Diego:     23/30 (76.7%) — ausente sesiones 24-30
  --   idx 4 Valentina: 30/30 (100%)
  --   idx 5 Rodrigo:   30/30 (100%)
  --   idx 6 Camila:    18/30 (60%)   — ausente sesiones 19-30  ← no elegible
  --   idx 7 Felipe:    30/30 (100%)
  --   idx 8 Andrea:    30/30 (100%)

  FOR v_i IN 1..8 LOOP           -- iterar sobre alumnos A4
    FOR v_j IN 1..30 LOOP         -- iterar sobre sesiones teóricas
      DECLARE
        v_status TEXT := 'present';
      BEGIN
        IF v_i = 3 AND v_j >= 24 THEN v_status := 'absent'; END IF;  -- Diego
        IF v_i = 6 AND v_j >= 19 THEN v_status := 'absent'; END IF;  -- Camila

        INSERT INTO professional_theory_attendance (
          theory_session_prof_id, enrollment_id,
          status, recorded_by
        )
        SELECT
          v_theory_ids_a4[v_j],
          v_a4_enroll_ids[v_i],
          v_status, 2
        WHERE NOT EXISTS (
          SELECT 1 FROM professional_theory_attendance
          WHERE theory_session_prof_id = v_theory_ids_a4[v_j]
            AND enrollment_id = v_a4_enroll_ids[v_i]
        );
      END;
    END LOOP;
  END LOOP;

  -- ── 9. ASISTENCIA TEÓRICA — A2 ────────────────────────────────────
  --
  --   idx 1 Marcos:   30/30 (100%)
  --   idx 2 Isabel:   30/30 (100%)
  --   idx 3 Tomás:    23/30 (76.7%) — ausente sesiones 24-30
  --   idx 4 Patricia: 30/30 (100%)
  --   idx 5 Roberto:  18/30 (60%)   — ausente sesiones 19-30  ← no elegible
  --   idx 6 Daniela:  30/30 (100%)

  FOR v_i IN 1..6 LOOP
    FOR v_j IN 1..30 LOOP
      DECLARE
        v_status TEXT := 'present';
      BEGIN
        IF v_i = 3 AND v_j >= 24 THEN v_status := 'absent'; END IF;  -- Tomás
        IF v_i = 5 AND v_j >= 19 THEN v_status := 'absent'; END IF;  -- Roberto

        INSERT INTO professional_theory_attendance (
          theory_session_prof_id, enrollment_id,
          status, recorded_by
        )
        SELECT
          v_theory_ids_a2[v_j],
          v_a2_enroll_ids[v_i],
          v_status, 2
        WHERE NOT EXISTS (
          SELECT 1 FROM professional_theory_attendance
          WHERE theory_session_prof_id = v_theory_ids_a2[v_j]
            AND enrollment_id = v_a2_enroll_ids[v_i]
        );
      END;
    END LOOP;
  END LOOP;

  -- ── 10. SESIONES PRÁCTICAS — A4 (30 sesiones, una por día) ──────────
  FOR v_i IN 1..30 LOOP
    INSERT INTO professional_practice_sessions (
      promotion_course_id, date, status, notes, registered_by
    )
    SELECT
      v_pc_a4_id,
      v_session_dates[v_i],
      'completed',
      '[SEED] Práctica A4 — Sesión ' || v_i,
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM professional_practice_sessions
      WHERE promotion_course_id = v_pc_a4_id
        AND notes = '[SEED] Práctica A4 — Sesión ' || v_i
    );
  END LOOP;

  SELECT ARRAY_AGG(id ORDER BY date)
  INTO v_practice_ids_a4
  FROM professional_practice_sessions
  WHERE promotion_course_id = v_pc_a4_id
    AND notes LIKE '[SEED] Práctica A4 — Sesión%';

  -- ── 11. SESIONES PRÁCTICAS — A2 (30 sesiones, una por día) ──────────
  FOR v_i IN 1..30 LOOP
    INSERT INTO professional_practice_sessions (
      promotion_course_id, date, status, notes, registered_by
    )
    SELECT
      v_pc_a2_id,
      v_session_dates[v_i],
      'completed',
      '[SEED] Práctica A2 — Sesión ' || v_i,
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM professional_practice_sessions
      WHERE promotion_course_id = v_pc_a2_id
        AND notes = '[SEED] Práctica A2 — Sesión ' || v_i
    );
  END LOOP;

  SELECT ARRAY_AGG(id ORDER BY date)
  INTO v_practice_ids_a2
  FROM professional_practice_sessions
  WHERE promotion_course_id = v_pc_a2_id
    AND notes LIKE '[SEED] Práctica A2 — Sesión%';

  -- ── 12. ASISTENCIA PRÁCTICA — A4 ──────────────────────────────────
  --
  --   idx 1 Carlos:    30/30 (100%)
  --   idx 2 María:     27/30 (90%)  — ausente sesiones 28-30
  --   idx 3 Diego:     30/30 (100%)
  --   idx 4 Valentina: 24/30 (80%)  — ausente sesiones 25-30
  --   idx 5 Rodrigo:   30/30 (100%)
  --   idx 6 Camila:    30/30 (100%)
  --   idx 7 Felipe:    30/30 (100%)
  --   idx 8 Andrea:    30/30 (100%)

  FOR v_i IN 1..8 LOOP
    FOR v_j IN 1..30 LOOP
      DECLARE
        v_status TEXT := 'present';
      BEGIN
        IF v_i = 2 AND v_j >= 28 THEN v_status := 'absent'; END IF;  -- María (27/30 = 90%)
        IF v_i = 4 AND v_j >= 25 THEN v_status := 'absent'; END IF;  -- Valentina (24/30 = 80%)

        INSERT INTO professional_practice_attendance (
          session_id, enrollment_id,
          status, block_percentage, recorded_by
        )
        SELECT
          v_practice_ids_a4[v_j],
          v_a4_enroll_ids[v_i],
          v_status,
          CASE WHEN v_status = 'present' THEN 100.0 ELSE 0.0 END,
          2
        WHERE NOT EXISTS (
          SELECT 1 FROM professional_practice_attendance
          WHERE session_id = v_practice_ids_a4[v_j]
            AND enrollment_id = v_a4_enroll_ids[v_i]
        );
      END;
    END LOOP;
  END LOOP;

  -- ── 13. ASISTENCIA PRÁCTICA — A2 ──────────────────────────────────
  --
  --   idx 1 Marcos:    30/30 (100%)
  --   idx 2 Isabel:    24/30 (80%)  — ausente sesiones 25-30
  --   idx 3 Tomás:     30/30 (100%)
  --   idx 4 Patricia:  30/30 (100%)
  --   idx 5 Roberto:   30/30 (100%)
  --   idx 6 Daniela:   30/30 (100%)

  FOR v_i IN 1..6 LOOP
    FOR v_j IN 1..30 LOOP
      DECLARE
        v_status TEXT := 'present';
      BEGIN
        IF v_i = 2 AND v_j >= 25 THEN v_status := 'absent'; END IF;  -- Isabel (24/30 = 80%)

        INSERT INTO professional_practice_attendance (
          session_id, enrollment_id,
          status, block_percentage, recorded_by
        )
        SELECT
          v_practice_ids_a2[v_j],
          v_a2_enroll_ids[v_i],
          v_status,
          CASE WHEN v_status = 'present' THEN 100.0 ELSE 0.0 END,
          2
        WHERE NOT EXISTS (
          SELECT 1 FROM professional_practice_attendance
          WHERE session_id = v_practice_ids_a2[v_j]
            AND enrollment_id = v_a2_enroll_ids[v_i]
        );
      END;
    END LOOP;
  END LOOP;

  -- ── 14. NOTAS DE MÓDULOS — CURSO A4 (7 módulos por alumno) ────────
  FOR v_i IN 1..8 LOOP
    FOR v_j IN 1..7 LOOP
      INSERT INTO professional_module_grades (
        enrollment_id, module, module_number,
        grade, passed, status, recorded_by
      )
      SELECT
        v_a4_enroll_ids[v_i],
        'Módulo ' || v_j,
        v_j::SMALLINT,
        v_a4_grades[v_i][v_j],
        v_a4_grades[v_i][v_j] >= 75.0,
        'confirmed',
        2
      WHERE NOT EXISTS (
        SELECT 1 FROM professional_module_grades
        WHERE enrollment_id = v_a4_enroll_ids[v_i]
          AND module_number = v_j::SMALLINT
      );
    END LOOP;
  END LOOP;

  -- ── 15. NOTAS DE MÓDULOS — CURSO A2 (7 módulos por alumno) ────────
  FOR v_i IN 1..6 LOOP
    FOR v_j IN 1..7 LOOP
      INSERT INTO professional_module_grades (
        enrollment_id, module, module_number,
        grade, passed, status, recorded_by
      )
      SELECT
        v_a2_enroll_ids[v_i],
        'Módulo ' || v_j,
        v_j::SMALLINT,
        v_a2_grades[v_i][v_j],
        v_a2_grades[v_i][v_j] >= 75.0,
        'confirmed',
        2
      WHERE NOT EXISTS (
        SELECT 1 FROM professional_module_grades
        WHERE enrollment_id = v_a2_enroll_ids[v_i]
          AND module_number = v_j::SMALLINT
      );
    END LOOP;
  END LOOP;

  -- ── 16. FIRMAS SEMANALES ───────────────────────────────────────────
  --
  -- 5 semanas × 14 alumnos = 70 registros.
  -- week_start_date = lunes de cada semana; signed_at = viernes 17:00.
  -- Todos firman las 5 semanas (la promoción está finalizada).

  DECLARE
    v_week_starts DATE[] := ARRAY[
      '2026-01-05'::DATE,   -- semana 1
      '2026-01-12'::DATE,   -- semana 2
      '2026-01-19'::DATE,   -- semana 3
      '2026-01-26'::DATE,   -- semana 4
      '2026-02-02'::DATE    -- semana 5
    ];
    v_week_signed TIMESTAMPTZ[] := ARRAY[
      '2026-01-09 17:00:00+00'::TIMESTAMPTZ,
      '2026-01-16 17:00:00+00'::TIMESTAMPTZ,
      '2026-01-23 17:00:00+00'::TIMESTAMPTZ,
      '2026-01-30 17:00:00+00'::TIMESTAMPTZ,
      '2026-02-06 17:00:00+00'::TIMESTAMPTZ
    ];
  BEGIN

    -- A4 — 8 alumnos × 5 semanas
    FOR v_i IN 1..8 LOOP
      FOR v_j IN 1..5 LOOP
        INSERT INTO professional_weekly_signatures (
          promotion_course_id, enrollment_id,
          week_start_date, signed_at, recorded_by
        )
        SELECT
          v_pc_a4_id,
          v_a4_enroll_ids[v_i],
          v_week_starts[v_j],
          v_week_signed[v_j],
          2
        WHERE NOT EXISTS (
          SELECT 1 FROM professional_weekly_signatures
          WHERE enrollment_id = v_a4_enroll_ids[v_i]
            AND week_start_date = v_week_starts[v_j]
        );
      END LOOP;
    END LOOP;

    -- A2 — 6 alumnos × 5 semanas
    FOR v_i IN 1..6 LOOP
      FOR v_j IN 1..5 LOOP
        INSERT INTO professional_weekly_signatures (
          promotion_course_id, enrollment_id,
          week_start_date, signed_at, recorded_by
        )
        SELECT
          v_pc_a2_id,
          v_a2_enroll_ids[v_i],
          v_week_starts[v_j],
          v_week_signed[v_j],
          2
        WHERE NOT EXISTS (
          SELECT 1 FROM professional_weekly_signatures
          WHERE enrollment_id = v_a2_enroll_ids[v_i]
            AND week_start_date = v_week_starts[v_j]
        );
      END LOOP;
    END LOOP;

  END;

  -- ── 17. CERTIFICADO YA GENERADO — Andrea López (A4, idx 8) ────────
  --
  -- Simula un certificado ya emitido para verificar que el botón "Ver"
  -- aparece en lugar de "Generar" en la UI.

  INSERT INTO certificates (
    folio, enrollment_id, student_id,
    type, status, issued_date, issued_by
  )
  SELECT
    9001,
    v_a4_enroll_ids[8],
    v_a4_student_ids[8],
    'professional', 'issued',
    '2026-03-01', 2
  WHERE NOT EXISTS (
    SELECT 1 FROM certificates WHERE folio = 9001
  );

  SELECT id INTO v_cert_id FROM certificates WHERE folio = 9001;

  -- Actualizar la columna de URL del PDF en la matrícula de Andrea
  UPDATE enrollments
  SET certificate_professional_pdf_url = 'certificates_prof/' || v_a4_enroll_ids[8] || '/cert_profesional_9001.pdf'
  WHERE id = v_a4_enroll_ids[8]
    AND certificate_professional_pdf_url IS NULL;

  -- Log de generación del certificado
  INSERT INTO certificate_issuance_log (
    certificate_id, action, user_id, ip
  )
  SELECT v_cert_id, 'generated', 2, '127.0.0.1'
  WHERE NOT EXISTS (
    SELECT 1 FROM certificate_issuance_log
    WHERE certificate_id = v_cert_id AND action = 'generated'
  );

END $$;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN — Resultado esperado tras ejecutar el seed:
-- ============================================================================
SELECT
  c.name                                            AS curso,
  u.first_names || ' ' || u.paternal_last_name      AS alumno,
  u.rut,
  e.number                                          AS matricula,
  e.pending_balance,
  (
    SELECT COUNT(*) FROM professional_theory_attendance pta
    JOIN professional_theory_sessions pts ON pts.id = pta.theory_session_prof_id
    WHERE pts.promotion_course_id = pc.id
      AND pta.enrollment_id = e.id AND pta.status = 'present'
  ) || '/' || (
    SELECT COUNT(*) FROM professional_theory_sessions
    WHERE promotion_course_id = pc.id AND status = 'completed'
  )                                                 AS teoria_present,
  (
    SELECT COUNT(*) FROM professional_practice_attendance ppa
    JOIN professional_practice_sessions pps ON pps.id = ppa.session_id
    WHERE pps.promotion_course_id = pc.id
      AND ppa.enrollment_id = e.id AND ppa.status = 'present'
  ) || '/' || (
    SELECT COUNT(*) FROM professional_practice_sessions
    WHERE promotion_course_id = pc.id AND status = 'completed'
  )                                                 AS practica_present,
  ROUND(
    (SELECT AVG(grade) FROM professional_module_grades WHERE enrollment_id = e.id), 1
  )                                                 AS nota_promedio,
  e.certificate_professional_pdf_url IS NOT NULL    AS cert_generado
FROM   enrollments e
JOIN   students s          ON s.id  = e.student_id
JOIN   users u             ON u.id  = s.user_id
JOIN   promotion_courses pc ON pc.id = e.promotion_course_id
JOIN   courses c           ON c.id  = pc.course_id
JOIN   professional_promotions pp ON pp.id = pc.promotion_id
WHERE  pp.code = 'PROM-2026-SEED-01'
ORDER  BY c.license_class, u.paternal_last_name;
