-- ============================================================================
-- Spec 0004-m — Instructores y vehículos multi-sede ("Ambas")
--
-- Un instructor Clase B (o un vehículo) puede pertenecer a las dos sedes a la vez.
-- No se reinterpreta `branch_id = NULL` para esto (ese estado ya es el bug accidental
-- del formulario de Crear/Editar Vehículo que nunca tuvo campo de sede — ver
-- indices/DOMAIN-GOTCHAS.md DG-039). En su lugar, columna booleana explícita
-- `both_branches`: `branch_id` sigue siendo la "sede principal" obligatoria,
-- `both_branches=true` amplía el scope sin perder ese valor de referencia.
--
-- Alcance de esta migración:
--   1. Columnas `both_branches` en `instructors` y `vehicles`.
--   2. RLS: `select_instructors` + `instructor_documents` (select/insert/update)
--      reconocen `both_branches` además de `branch_visible()`.
--   3. RLS: `insert_vehicles`/`update_vehicles` — hoy admin-only pese a que
--      `indices/DATABASE.md` documenta "Sec: CRUD" (mismatch real, no solo de docs:
--      a diferencia de `instructors`, que se crea/edita vía edge function con
--      `service_role` y su propia validación admin/secretary en código, `vehicles`
--      se crea/edita directo desde `FlotaFacade` con el cliente autenticado — la RLS
--      admin-only sí bloquea a la secretaria hoy). Se agrega secretary, acotado a su
--      propia sede y sin poder setear `both_branches=true` (solo admin).
--   4. Rewrite `v_class_b_schedule_availability`: un instructor `both_branches=true`
--      genera slots en las dos sedes; el vehículo asignado debe cubrir la sede del
--      slot (`v.branch_id = cs.branch_id OR v.both_branches`). Los dos NOT EXISTS de
--      conflicto (instructor/vehículo) NO cambian — ya son globales por
--      instructor_id/vehicle_id, sin filtro de sede, así que un instructor u vehículo
--      ocupado en una sede ya bloquea el mismo horario en la otra sin cambios.
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE, DROP VIEW IF EXISTS + CREATE.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas nuevas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE instructors ADD COLUMN both_branches BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vehicles    ADD COLUMN both_branches BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN instructors.both_branches IS 'Instructor dicta clases en las dos sedes (spec 0004-m). branch_id sigue siendo su sede principal.';
COMMENT ON COLUMN vehicles.both_branches IS 'Vehículo disponible para las dos sedes (spec 0004-m). branch_id sigue siendo su sede principal.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — select_instructors: agregar OR both_branches
--    (recrea textualmente la policy de 20260624120000 + el agregado)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS select_instructors ON public.instructors;
CREATE POLICY select_instructors ON public.instructors
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND (
          branch_visible((SELECT u.branch_id FROM public.users u WHERE u.id = instructors.user_id))
          OR instructors.both_branches
        ))
    OR (auth_user_role() = 'instructor' AND id = auth_instructor_id())
    OR (auth_user_role() = 'student'
        AND id IN (
          SELECT cb.instructor_id FROM class_b_sessions cb
          JOIN enrollments e ON e.id = cb.enrollment_id
          WHERE e.student_id = auth_student_id()
            AND cb.status NOT IN ('cancelled')
        ))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — instructor_documents: mismo agregado (select/insert/update; delete admin-only sin cambios)
--    (recrea textualmente las policies de 20260729120000 + el agregado)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS select_instructor_documents ON instructor_documents;
CREATE POLICY select_instructor_documents ON instructor_documents
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND (
          branch_visible((
            SELECT u.branch_id
            FROM instructors i
            JOIN users u ON u.id = i.user_id
            WHERE i.id = instructor_documents.instructor_id
          ))
          OR (SELECT i.both_branches FROM instructors i WHERE i.id = instructor_documents.instructor_id)
        ))
  );

DROP POLICY IF EXISTS insert_instructor_documents ON instructor_documents;
CREATE POLICY insert_instructor_documents ON instructor_documents
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND (
          branch_visible((
            SELECT u.branch_id
            FROM instructors i
            JOIN users u ON u.id = i.user_id
            WHERE i.id = instructor_documents.instructor_id
          ))
          OR (SELECT i.both_branches FROM instructors i WHERE i.id = instructor_documents.instructor_id)
        ))
  );

DROP POLICY IF EXISTS update_instructor_documents ON instructor_documents;
CREATE POLICY update_instructor_documents ON instructor_documents
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND (
          branch_visible((
            SELECT u.branch_id
            FROM instructors i
            JOIN users u ON u.id = i.user_id
            WHERE i.id = instructor_documents.instructor_id
          ))
          OR (SELECT i.both_branches FROM instructors i WHERE i.id = instructor_documents.instructor_id)
        ))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — insert_vehicles / update_vehicles: permitir secretary (su propia sede,
--    nunca both_branches=true). delete_vehicles se queda admin-only, sin cambios.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS insert_vehicles ON vehicles;
CREATE POLICY insert_vehicles ON vehicles
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_id = auth_user_branch_id()
        AND both_branches = false)
  );

DROP POLICY IF EXISTS update_vehicles ON vehicles;
CREATE POLICY update_vehicles ON vehicles
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_id = auth_user_branch_id()
        AND both_branches = false)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Rewrite v_class_b_schedule_availability
--    Único cambio real: el join de course_slots ya no ancla exclusivamente a la
--    sede del instructor (permite both_branches), y el join de vehicles pasa a
--    validar contra la sede DEL SLOT (cs.branch_id), no la del instructor —
--    permitiendo también que el vehículo sea both_branches. Los dos NOT EXISTS
--    de conflicto no cambian: ya son globales por instructor_id/vehicle_id.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_class_b_schedule_availability;

CREATE OR REPLACE VIEW v_class_b_schedule_availability AS
WITH
course_slots AS (
  SELECT DISTINCT ON (c.branch_id, (b.value ->> 'from')::TIME)
    c.branch_id,
    c.schedule_days,
    (b.value ->> 'from')::TIME AS slot_from,
    (b.value ->> 'to')::TIME   AS slot_to
  FROM courses c,
       LATERAL jsonb_array_elements(c.schedule_blocks) AS b(value)
  WHERE c.type = 'class_b'
    AND c.active = true
  ORDER BY c.branch_id, (b.value ->> 'from')::TIME
),
slots AS (
  SELECT
    i.id        AS instructor_id,
    va.vehicle_id,
    (d::DATE + cs.slot_from) AT TIME ZONE 'America/Santiago' AS slot_start,
    (d::DATE + cs.slot_to)   AT TIME ZONE 'America/Santiago' AS slot_end
  FROM instructors i
  JOIN users u
    ON u.id = i.user_id
  JOIN vehicle_assignments va
    ON va.instructor_id = i.id
   AND va.end_date IS NULL
  JOIN course_slots cs
    ON cs.branch_id = u.branch_id OR i.both_branches
  JOIN vehicles v
    ON v.id = va.vehicle_id
   AND (v.branch_id = cs.branch_id OR v.both_branches)
  CROSS JOIN LATERAL generate_series(
    CURRENT_DATE::TIMESTAMP,
    (CURRENT_DATE + INTERVAL '28 days')::TIMESTAMP,
    INTERVAL '1 day'
  ) AS d
  WHERE
    i.active = true
    AND (i.type IS NULL OR i.type != 'theory')
    AND EXTRACT(ISODOW FROM d)::INT = ANY(cs.schedule_days)
)
SELECT
  s.*,
  CASE
    WHEN
      NOT EXISTS (
        SELECT 1
        FROM class_b_sessions cb
        JOIN enrollments e ON e.id = cb.enrollment_id
        WHERE cb.instructor_id = s.instructor_id
          AND cb.status NOT IN ('cancelled')
          AND (e.status != 'draft' OR e.expires_at > NOW())
          AND cb.scheduled_at < s.slot_end
          AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > s.slot_start
      )
      AND NOT EXISTS (
        SELECT 1
        FROM class_b_sessions cb
        JOIN enrollments e ON e.id = cb.enrollment_id
        WHERE cb.vehicle_id = s.vehicle_id
          AND cb.status NOT IN ('cancelled')
          AND (e.status != 'draft' OR e.expires_at > NOW())
          AND cb.scheduled_at < s.slot_end
          AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > s.slot_start
      )
    THEN 'available'
    ELSE 'occupied'
  END AS slot_status
FROM slots s;

ALTER VIEW v_class_b_schedule_availability SET (security_invoker = true);

COMMENT ON VIEW v_class_b_schedule_availability IS
  'Slots de 45 min (disponibles Y ocupados) por instructor+vehículo en las próximas 4 semanas. '
  'Columna slot_status = ''available'' | ''occupied'' indica disponibilidad real. '
  'Zona horaria: America/Santiago explícita. '
  'Spec 0004-m: un instructor con both_branches=true genera filas para las dos sedes '
  '(join de course_slots ya no ancla solo a su sede); el vehículo asignado debe cubrir '
  'la sede del slot (v.branch_id = cs.branch_id OR v.both_branches) — si el vehículo del '
  'instructor no es both_branches, la sede que no cubre queda sin filas (no "occupied", '
  'ausente). Los NOT EXISTS de conflicto son globales por instructor_id/vehicle_id, sin '
  'filtro de sede: un instructor u vehículo ocupado en una sede ya bloquea el mismo '
  'horario en la otra. Excluye instructores con type=''theory''. Solo incluye el vehículo '
  'activo del instructor.';
