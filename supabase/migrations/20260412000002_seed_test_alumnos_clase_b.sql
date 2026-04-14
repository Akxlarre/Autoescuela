-- ============================================================================
-- SEED: Alumnos de prueba Clase B con 12 prácticas completadas
-- ============================================================================
-- Propósito: Crear datos de desarrollo para verificar el módulo de
--            Certificación Clase B en el entorno local.
--
-- Alumnos creados:
--   · Pedro González (RUT 12345678-9): 4/4 teóricas presentes → 100%
--   · Ana Morales    (RUT 98765432-1): 3/4 teóricas presentes → 75%
--
-- Supuestos sobre datos existentes en el entorno de desarrollo:
--   · branch_id  = 2  (Conductores Chillán)
--   · course_id  = 7  (cc_class_b, base_price=180000)
--   · registered_by = 2  (usuario admin existente)
--   · instructor_id = 2, vehicle_id = 1  → Pedro
--   · instructor_id = 3, vehicle_id = 2  → Ana
--
-- Idempotente: seguro de ejecutar varias veces (ON CONFLICT / WHERE NOT EXISTS).
-- Identificadores de seed:  enrollments.number IN ('SEED-B-001', 'SEED-B-002')
--                           theory topics con prefijo '[SEED] '
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_pedro_user_id       INT;
  v_ana_user_id         INT;
  v_pedro_student_id    INT;
  v_ana_student_id      INT;
  v_pedro_enroll_id     INT;
  v_ana_enroll_id       INT;
  v_theory_session_ids  INT[];
  v_session_id          INT;
  v_i                   INT;
  v_topics              TEXT[] := ARRAY[
    'Reglamento del Tránsito',
    'Señalización Vial',
    'Conducción Defensiva',
    'Conducción en condiciones adversas'
  ];
  v_practice_base       DATE   := '2026-01-05'; -- lunes
  v_theory_base         DATE   := '2026-01-06'; -- martes
  v_role_student_id     INT;
BEGIN

  SELECT id INTO v_role_student_id FROM roles WHERE name = 'student';

  -- ──────────────────────────────────────────────────────────────
  -- 1. USERS
  -- ──────────────────────────────────────────────────────────────
  INSERT INTO users (
    rut, first_names, paternal_last_name, maternal_last_name,
    email, phone, role_id, branch_id, active, first_login
  ) VALUES
    ('12345678-9', 'Pedro', 'González', 'Martínez',
     'pedro.gonzalez.seed@test.local', '+56912345678',
     v_role_student_id, 2, true, false),
    ('98765432-1', 'Ana', 'Morales', 'Soto',
     'ana.morales.seed@test.local', '+56987654321',
     v_role_student_id, 2, true, false)
  ON CONFLICT (rut) DO NOTHING;

  SELECT id INTO v_pedro_user_id FROM users WHERE rut = '12345678-9';
  SELECT id INTO v_ana_user_id   FROM users WHERE rut = '98765432-1';

  -- ──────────────────────────────────────────────────────────────
  -- 2. STUDENTS
  -- ──────────────────────────────────────────────────────────────
  INSERT INTO students (user_id, birth_date, gender, status)
  SELECT v_pedro_user_id, '2000-05-15', 'M', 'active'
  WHERE NOT EXISTS (SELECT 1 FROM students WHERE user_id = v_pedro_user_id);

  INSERT INTO students (user_id, birth_date, gender, status)
  SELECT v_ana_user_id, '1998-09-22', 'F', 'active'
  WHERE NOT EXISTS (SELECT 1 FROM students WHERE user_id = v_ana_user_id);

  SELECT id INTO v_pedro_student_id FROM students WHERE user_id = v_pedro_user_id;
  SELECT id INTO v_ana_student_id   FROM students WHERE user_id = v_ana_user_id;

  -- ──────────────────────────────────────────────────────────────
  -- 3. ENROLLMENTS
  -- certificate_enabled = true porque insertamos directamente con las
  -- 12 prácticas completadas (el trigger solo corre en UPDATE, no INSERT).
  -- ──────────────────────────────────────────────────────────────
  INSERT INTO enrollments (
    number, student_id, course_id, branch_id,
    base_price, discount, total_paid, pending_balance, payment_status,
    status, docs_complete, contract_accepted, certificate_enabled,
    registration_channel, registered_by
  )
  SELECT
    'SEED-B-001', v_pedro_student_id, 7, 2,
    180000, 0, 180000, 0, 'paid_full',
    'completed', true, true, true,
    'in_person', 2
  WHERE NOT EXISTS (SELECT 1 FROM enrollments WHERE number = 'SEED-B-001');

  INSERT INTO enrollments (
    number, student_id, course_id, branch_id,
    base_price, discount, total_paid, pending_balance, payment_status,
    status, docs_complete, contract_accepted, certificate_enabled,
    registration_channel, registered_by
  )
  SELECT
    'SEED-B-002', v_ana_student_id, 7, 2,
    180000, 0, 180000, 0, 'paid_full',
    'completed', true, true, true,
    'in_person', 2
  WHERE NOT EXISTS (SELECT 1 FROM enrollments WHERE number = 'SEED-B-002');

  SELECT id INTO v_pedro_enroll_id FROM enrollments WHERE number = 'SEED-B-001';
  SELECT id INTO v_ana_enroll_id   FROM enrollments WHERE number = 'SEED-B-002';

  -- ──────────────────────────────────────────────────────────────
  -- 4. PAYMENTS
  -- El trigger trg_update_balance recalculará total_paid y pending_balance
  -- automáticamente; los valores en enrollments quedarán consistentes.
  -- ──────────────────────────────────────────────────────────────
  INSERT INTO payments (
    enrollment_id, type, document_number,
    total_amount, transfer_amount, status,
    payment_date, requires_receipt, registered_by
  )
  SELECT
    v_pedro_enroll_id, 'enrollment', 'SEED-TRF-001',
    180000, 180000, 'paid',
    '2026-01-03', false, 2
  WHERE NOT EXISTS (
    SELECT 1 FROM payments
    WHERE enrollment_id = v_pedro_enroll_id AND type = 'enrollment'
  );

  INSERT INTO payments (
    enrollment_id, type, document_number,
    total_amount, transfer_amount, status,
    payment_date, requires_receipt, registered_by
  )
  SELECT
    v_ana_enroll_id, 'enrollment', 'SEED-TRF-002',
    180000, 180000, 'paid',
    '2026-01-03', false, 2
  WHERE NOT EXISTS (
    SELECT 1 FROM payments
    WHERE enrollment_id = v_ana_enroll_id AND type = 'enrollment'
  );

  -- ──────────────────────────────────────────────────────────────
  -- 5. STUDENT DOCUMENTS (foto carnet)
  -- ──────────────────────────────────────────────────────────────
  INSERT INTO student_documents (
    enrollment_id, type, file_name, storage_url, status, uploaded_at
  )
  SELECT
    v_pedro_enroll_id, 'id_photo',
    'foto_carnet_pedro_gonzalez.jpg',
    'documents/seed/foto_carnet_pedro_gonzalez.jpg',
    'approved', '2026-01-03 10:00:00+00'
  WHERE NOT EXISTS (
    SELECT 1 FROM student_documents
    WHERE enrollment_id = v_pedro_enroll_id AND type = 'id_photo'
  );

  INSERT INTO student_documents (
    enrollment_id, type, file_name, storage_url, status, uploaded_at
  )
  SELECT
    v_ana_enroll_id, 'id_photo',
    'foto_carnet_ana_morales.jpg',
    'documents/seed/foto_carnet_ana_morales.jpg',
    'approved', '2026-01-03 10:00:00+00'
  WHERE NOT EXISTS (
    SELECT 1 FROM student_documents
    WHERE enrollment_id = v_ana_enroll_id AND type = 'id_photo'
  );

  -- ──────────────────────────────────────────────────────────────
  -- 6. DIGITAL CONTRACTS
  -- ──────────────────────────────────────────────────────────────
  INSERT INTO digital_contracts (
    enrollment_id,
    content_hash, signature_ip, accepted_at,
    file_name, file_url
  )
  SELECT
    v_pedro_enroll_id,
    md5('contrato-seed-pedro-gonzalez-2026'),
    '127.0.0.1', '2026-01-03 10:30:00+00',
    'Contrato_Pedro_González_2026.pdf',
    'documents/seed/contrato_pedro_gonzalez_2026.pdf'
  WHERE NOT EXISTS (
    SELECT 1 FROM digital_contracts WHERE enrollment_id = v_pedro_enroll_id
  );

  INSERT INTO digital_contracts (
    enrollment_id,
    content_hash, signature_ip, accepted_at,
    file_name, file_url
  )
  SELECT
    v_ana_enroll_id,
    md5('contrato-seed-ana-morales-2026'),
    '127.0.0.1', '2026-01-03 11:00:00+00',
    'Contrato_Ana_Morales_2026.pdf',
    'documents/seed/contrato_ana_morales_2026.pdf'
  WHERE NOT EXISTS (
    SELECT 1 FROM digital_contracts WHERE enrollment_id = v_ana_enroll_id
  );

  -- ──────────────────────────────────────────────────────────────
  -- 7. THEORY SESSIONS (4 sesiones grupales en branch_id=2)
  -- Se identifican por el prefijo '[SEED]' en el topic para evitar
  -- duplicar sesiones reales ya existentes en la sede.
  -- ──────────────────────────────────────────────────────────────
  FOR v_i IN 1..4 LOOP
    INSERT INTO class_b_theory_sessions (
      branch_id, instructor_id,
      scheduled_at, start_time, end_time, duration_min,
      topic, status, registered_by
    )
    SELECT
      2, 2,
      (v_theory_base + ((v_i - 1) * 7))::TIMESTAMPTZ + '13:00:00'::INTERVAL,
      '10:00', '11:30', 90,
      '[SEED] Módulo ' || v_i || ' — ' || v_topics[v_i],
      'completed',
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM class_b_theory_sessions
      WHERE branch_id = 2
        AND topic = '[SEED] Módulo ' || v_i || ' — ' || v_topics[v_i]
    );
  END LOOP;

  SELECT ARRAY_AGG(id ORDER BY scheduled_at)
  INTO v_theory_session_ids
  FROM class_b_theory_sessions
  WHERE branch_id = 2
    AND topic LIKE '[SEED] Módulo %';

  -- ──────────────────────────────────────────────────────────────
  -- 8. THEORY ATTENDANCE
  -- Pedro: 4/4 → pct_theory_attendance = 100%
  -- Ana:   3/4 → pct_theory_attendance = 75%  (ausente sesión 4)
  -- ──────────────────────────────────────────────────────────────
  FOR v_i IN 1..4 LOOP
    INSERT INTO class_b_theory_attendance (
      theory_session_b_id, student_id, status, recorded_by
    )
    SELECT v_theory_session_ids[v_i], v_pedro_student_id, 'present', 2
    WHERE NOT EXISTS (
      SELECT 1 FROM class_b_theory_attendance
      WHERE theory_session_b_id = v_theory_session_ids[v_i]
        AND student_id = v_pedro_student_id
    );
  END LOOP;

  -- Ana: sesiones 1-3 presente
  FOR v_i IN 1..3 LOOP
    INSERT INTO class_b_theory_attendance (
      theory_session_b_id, student_id, status, recorded_by
    )
    SELECT v_theory_session_ids[v_i], v_ana_student_id, 'present', 2
    WHERE NOT EXISTS (
      SELECT 1 FROM class_b_theory_attendance
      WHERE theory_session_b_id = v_theory_session_ids[v_i]
        AND student_id = v_ana_student_id
    );
  END LOOP;
  -- Ana: sesión 4 ausente
  INSERT INTO class_b_theory_attendance (
    theory_session_b_id, student_id, status, justification, recorded_by
  )
  SELECT
    v_theory_session_ids[4], v_ana_student_id,
    'absent', 'No se presentó', 2
  WHERE NOT EXISTS (
    SELECT 1 FROM class_b_theory_attendance
    WHERE theory_session_b_id = v_theory_session_ids[4]
      AND student_id = v_ana_student_id
  );

  -- ──────────────────────────────────────────────────────────────
  -- 9. PRACTICE SESSIONS + ATTENDANCE  (12 clases por alumno)
  --
  -- Pedro: instructor_id=2, vehicle_id=1, horario 09:00-10:30
  -- Ana:   instructor_id=3, vehicle_id=2, horario 11:00-12:30
  -- Fechas: cada 3 días hábiles a partir del 2026-01-05 (≈ 5 semanas)
  -- ──────────────────────────────────────────────────────────────
  FOR v_i IN 1..12 LOOP

    -- ── Pedro ──
    INSERT INTO class_b_sessions (
      enrollment_id, instructor_id, vehicle_id,
      class_number, scheduled_at, start_time, end_time, duration_min,
      status, counts_as_taken,
      completed_at, updated_at,
      evaluation_grade,
      student_signature, instructor_signature,
      registered_by
    )
    SELECT
      v_pedro_enroll_id, 2, 1,
      v_i::SMALLINT,
      (v_practice_base + ((v_i - 1) * 3))::TIMESTAMPTZ + '12:00:00'::INTERVAL,
      '09:00', '09:45', 45,
      'completed', true,
      (v_practice_base + ((v_i - 1) * 3))::TIMESTAMPTZ + '12:45:00'::INTERVAL,
      (v_practice_base + ((v_i - 1) * 3))::TIMESTAMPTZ + '12:45:00'::INTERVAL,
      (4.0 + (v_i % 4) * 0.5)::NUMERIC(3,1),
      true, true,
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM class_b_sessions
      WHERE enrollment_id = v_pedro_enroll_id
        AND class_number = v_i::SMALLINT
    );

    SELECT id INTO v_session_id
    FROM class_b_sessions
    WHERE enrollment_id = v_pedro_enroll_id AND class_number = v_i::SMALLINT;

    INSERT INTO class_b_practice_attendance (
      class_b_session_id, student_id, status, recorded_by
    )
    SELECT v_session_id, v_pedro_student_id, 'present', 2
    WHERE NOT EXISTS (
      SELECT 1 FROM class_b_practice_attendance
      WHERE class_b_session_id = v_session_id
        AND student_id = v_pedro_student_id
    );

    -- ── Ana ──
    INSERT INTO class_b_sessions (
      enrollment_id, instructor_id, vehicle_id,
      class_number, scheduled_at, start_time, end_time, duration_min,
      status, counts_as_taken,
      completed_at, updated_at,
      evaluation_grade,
      student_signature, instructor_signature,
      registered_by
    )
    SELECT
      v_ana_enroll_id, 3, 2,
      v_i::SMALLINT,
      (v_practice_base + ((v_i - 1) * 3))::TIMESTAMPTZ + '14:00:00'::INTERVAL,
      '11:00', '11:45', 45,
      'completed', true,
      (v_practice_base + ((v_i - 1) * 3))::TIMESTAMPTZ + '14:45:00'::INTERVAL,
      (v_practice_base + ((v_i - 1) * 3))::TIMESTAMPTZ + '14:45:00'::INTERVAL,
      (4.0 + (v_i % 3) * 0.7)::NUMERIC(3,1),
      true, true,
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM class_b_sessions
      WHERE enrollment_id = v_ana_enroll_id
        AND class_number = v_i::SMALLINT
    );

    SELECT id INTO v_session_id
    FROM class_b_sessions
    WHERE enrollment_id = v_ana_enroll_id AND class_number = v_i::SMALLINT;

    INSERT INTO class_b_practice_attendance (
      class_b_session_id, student_id, status, recorded_by
    )
    SELECT v_session_id, v_ana_student_id, 'present', 2
    WHERE NOT EXISTS (
      SELECT 1 FROM class_b_practice_attendance
      WHERE class_b_session_id = v_session_id
        AND student_id = v_ana_student_id
    );

  END LOOP;

END $$;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN — Resultado esperado:
--   Pedro González | SEED-B-001 | completed | cert_enabled=true | prácticas=12 | teoría=100%
--   Ana Morales    | SEED-B-002 | completed | cert_enabled=true | prácticas=12 | teoría=75%
-- ============================================================================
SELECT
  u.first_names || ' ' || u.paternal_last_name  AS alumno,
  u.rut,
  e.number                                       AS matricula,
  e.status,
  e.certificate_enabled,
  vsp.completed_practices,
  vsp.pct_theory_attendance                      AS teoria_pct
FROM   enrollments e
JOIN   students  s   ON s.id  = e.student_id
JOIN   users     u   ON u.id  = s.user_id
LEFT   JOIN v_student_progress_b vsp ON vsp.enrollment_id = e.id
WHERE  e.number IN ('SEED-B-001', 'SEED-B-002')
ORDER  BY u.paternal_last_name;
