-- 20260426000001_students_status_add_archived.sql
-- Soft-delete support: allows students to be set as 'archived' instead of
-- physically deleted. Archived students are hidden from the main alumnos list
-- but their data (payments, classes) remains intact for accounting reports.
--
-- students.status valid values: 'active' | 'pending' | 'inactive' | 'graduated' | 'archived'

COMMENT ON COLUMN public.students.status IS
  'active | pending | inactive | graduated | archived — ''archived'' = soft-deleted (hidden from list, data preserved)';
