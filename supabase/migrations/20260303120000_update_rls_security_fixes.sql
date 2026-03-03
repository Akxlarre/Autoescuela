-- =############################################################################
-- ACTUALIZACIÓN RLS (Correcciones Críticas de Seguridad)
-- =############################################################################

-- Requiere que auth.uid() esté disponible (Supabase lo provee automáticamente).
-- Este script REEMPLAZA las políticas conflictivas creadas en las migraciones iniciales
-- para garantizar que la vista esté correctamente aislada por tenant (branch)
-- y asegurarnos un correcto Audit Trail de finanzas.

-- ============================================================================
-- 1. CORRECCIÓN: Usuarios
-- ============================================================================
-- Se requiere branch_visible para que las secretarias solo vean a usuarios de su misma sede.
DROP POLICY IF EXISTS select_users ON users;

CREATE POLICY select_users ON users
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' 
        AND branch_visible(branch_id) 
        AND (role_id IS NULL OR role_id != (SELECT id FROM roles WHERE name = 'admin')))
    OR (auth_user_role() IN ('instructor', 'student') AND id = auth_user_id())
  );

-- ============================================================================
-- 2. CORRECCIÓN: Matrículas (Enrollments)
-- ============================================================================
-- Acceso ilimitado para instructores bloqueado, ahora limitado por sesiones vinculadas (class_b_sessions)
DROP POLICY IF EXISTS select_enrollments ON enrollments;

CREATE POLICY select_enrollments ON enrollments
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
    OR (auth_user_role() = 'instructor' AND id IN (
        SELECT enrollment_id FROM class_b_sessions WHERE instructor_id = auth_instructor_id()
    ))
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );

-- ============================================================================
-- 3. CORRECCIÓN: Libro de Clases (Class Book)
-- ============================================================================
-- Limitamos el acceso a solo estudiantes vinculados al curso de la promoción.
DROP POLICY IF EXISTS select_class_book ON class_book;

CREATE POLICY select_class_book ON class_book
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' 
        AND promotion_course_id IN (
          SELECT promotion_course_id FROM enrollments 
          WHERE student_id = auth_student_id() AND promotion_course_id IS NOT NULL
        )) 
  );

-- ============================================================================
-- 4. CORRECCIÓN: Pagos (Payments)
-- ============================================================================
-- Bloqueamos cualquier tipo de borrado a nivel secretaria para prevenir destrucción de Audit Trail.
DROP POLICY IF EXISTS delete_payments ON payments;

CREATE POLICY delete_payments ON payments
  FOR DELETE USING (auth_user_role() = 'admin');

