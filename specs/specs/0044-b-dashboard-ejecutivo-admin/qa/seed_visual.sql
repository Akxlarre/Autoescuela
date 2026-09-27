-- Seed visual para /verify del dashboard ejecutivo (spec 0044-b). Solo Postgres local.
SET session_replication_role = replica;

DELETE FROM class_b_sessions WHERE id >= 10000;
DELETE FROM payments WHERE enrollment_id >= 10000;
DELETE FROM enrollments WHERE id >= 10000;
DELETE FROM expenses WHERE description LIKE 'visual-%';
DELETE FROM fixed_expenses WHERE description LIKE 'visual-%';

-- Matrículas por mes con estacionalidad (verano chileno alto: ene-feb, y dic).
WITH months AS (
  SELECT m::date AS month_start,
         EXTRACT(MONTH FROM m)::int AS mo,
         EXTRACT(YEAR FROM m)::int AS yr
  FROM generate_series('2025-01-01'::date, '2026-09-01'::date, interval '1 month') m
),
counts AS (
  SELECT *, (CASE mo WHEN 1 THEN 11 WHEN 2 THEN 10 WHEN 3 THEN 6 WHEN 7 THEN 7 WHEN 12 THEN 9 ELSE 5 END
             + CASE WHEN yr = 2026 THEN 2 ELSE 0 END) AS n
  FROM months
),
rows_ AS (
  SELECT c.*, g AS k, row_number() OVER () AS rn
  FROM counts c, generate_series(1, c.n) g
)
INSERT INTO enrollments (id, number, student_id, course_id, branch_id, status, license_group,
                         base_price, pending_balance, certificate_enabled, created_at)
SELECT 10000 + rn, 'V' || rn, 701 + (rn % 3), 1, 1 + (rn % 5 = 0)::int,
       CASE WHEN month_start < '2026-06-01' THEN 'completed' ELSE 'active' END,
       'class_b', 420000,
       CASE WHEN rn % 4 = 0 AND month_start >= '2026-03-01' THEN 120000 ELSE 0 END,
       (rn % 3 = 0),
       (month_start + ((k * 2) % 27) * interval '1 day' + interval '15 hours')
FROM rows_;

-- Pagos: abono al matricular + saldo el mes siguiente (si ya pasó).
INSERT INTO payments (enrollment_id, total_amount, status, payment_date)
SELECT id, 300000, 'paid', (created_at AT TIME ZONE 'America/Santiago')::date FROM enrollments WHERE id >= 10000;
INSERT INTO payments (enrollment_id, total_amount, status, payment_date)
SELECT id, 120000, 'paid', ((created_at AT TIME ZONE 'America/Santiago')::date + 20)
FROM enrollments WHERE id >= 10000 AND pending_balance = 0
  AND ((created_at AT TIME ZONE 'America/Santiago')::date + 20) <= CURRENT_DATE;

-- Gastos
INSERT INTO expenses (branch_id, description, amount, date, category)
SELECT 1, 'visual-combustible', 180000 + (EXTRACT(MONTH FROM d)::int * 7000), d, 'combustible'
FROM generate_series('2025-01-05'::date, '2026-09-05'::date, interval '1 month') d;
INSERT INTO fixed_expenses (branch_id, category, description, amount, date)
SELECT 1, 'rent', 'visual-arriendo', 650000, d
FROM generate_series('2025-01-01'::date, '2026-09-01'::date, interval '1 month') d;

-- Clases completadas en septiembre 2026 para 3 instructores
INSERT INTO class_b_sessions (id, enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, duration_min, status, completed_at)
SELECT 10000 + g,
       (SELECT id FROM enrollments WHERE id >= 10000 AND status = 'active' ORDER BY id
        OFFSET (g % 20) LIMIT 1),
       CASE WHEN g % 7 < 4 THEN 801 WHEN g % 7 < 6 THEN 1 ELSE 2 END, 601, 1 + (g / 20),
       ('2026-09-01 09:00-03'::timestamptz + (g / 3) * interval '1 day' + (g % 3) * interval '1 hour'),
       45, 'completed',
       ('2026-09-01 09:45-03'::timestamptz + (g / 3) * interval '1 day' + (g % 3) * interval '1 hour')
FROM generate_series(1, 60) g;

-- Liquidación agosto (congelada) y horas de septiembre
INSERT INTO instructor_monthly_hours (instructor_id, period, practical_sessions, total_equivalent)
VALUES (1, '2026-09', 17, 12.8), (2, '2026-09', 9, 6.8)
ON CONFLICT (instructor_id, period) DO UPDATE SET total_equivalent = EXCLUDED.total_equivalent;

SET session_replication_role = origin;
