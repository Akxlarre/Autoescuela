-- ============================================================================
-- FIX: Corregir timestamps y duration_min de los registros seed Clase B
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================================
-- Cambios:
--   · class_b_sessions    → duration_min 90→45, end_time corregido, +3h UTC en scheduled_at/completed_at
--   · class_b_theory_sessions → +3h UTC en scheduled_at
-- ============================================================================

BEGIN;

-- ── 1. Prácticas de Pedro (SEED-B-001) ──────────────────────────────────────
UPDATE class_b_sessions
SET
  duration_min  = 45,
  end_time      = '09:45',
  scheduled_at  = scheduled_at + INTERVAL '3 hours',
  completed_at  = completed_at + INTERVAL '3 hours',
  updated_at    = updated_at   + INTERVAL '3 hours'
WHERE enrollment_id = (
  SELECT id FROM enrollments WHERE number = 'SEED-B-001'
);

-- ── 2. Prácticas de Ana (SEED-B-002) ────────────────────────────────────────
UPDATE class_b_sessions
SET
  duration_min  = 45,
  end_time      = '11:45',
  scheduled_at  = scheduled_at + INTERVAL '3 hours',
  completed_at  = completed_at + INTERVAL '3 hours',
  updated_at    = updated_at   + INTERVAL '3 hours'
WHERE enrollment_id = (
  SELECT id FROM enrollments WHERE number = 'SEED-B-002'
);

-- ── 3. Sesiones teóricas seed ────────────────────────────────────────────────
UPDATE class_b_theory_sessions
SET
  scheduled_at = scheduled_at + INTERVAL '3 hours'
WHERE topic LIKE '[SEED] Módulo %';

COMMIT;

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT
  e.number                                        AS matricula,
  s.class_number,
  s.scheduled_at,
  s.start_time,
  s.end_time,
  s.duration_min
FROM class_b_sessions s
JOIN enrollments e ON e.id = s.enrollment_id
WHERE e.number IN ('SEED-B-001', 'SEED-B-002')
ORDER BY e.number, s.class_number;
