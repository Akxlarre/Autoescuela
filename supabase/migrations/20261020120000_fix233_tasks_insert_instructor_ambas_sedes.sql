-- fix-233-b (S12 del checklist 035, ASG-i-035): la secretaria puede mandar tareas a un instructor
-- "ambas sedes" de la otra sede.
--
-- La policy anterior (20260522000002) exigía que el instructor fuera de la sede de la secretaria,
-- sin mirar `instructors.both_branches`; el selector de destinatarios (fix-030-i) sí los ofrece, y
-- la tarea se rechazaba con 403. Todo lo demás queda igual.
--
-- El EXISTS corre con los permisos de la secretaria: `select_instructors` ya le deja leer a los
-- instructores con `both_branches`, así que no hace falta una función nueva.

DROP POLICY IF EXISTS tasks_insert ON public.tasks;

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT WITH CHECK (
    (
      -- Admin crea tareas en sus sedes visibles
      auth_user_role() = 'admin'
      AND from_user_id = auth_user_id()
      AND from_role = 'admin'
      AND to_role IN ('secretary', 'instructor')
      AND branch_visible(branch_id)
      AND branch_id = (SELECT branch_id FROM public.users WHERE id = to_user_id)
    )
    OR
    (
      -- Secretaria: la tarea queda anclada a su sede
      auth_user_role() = 'secretary'
      AND from_user_id = auth_user_id()
      AND from_role = 'secretary'
      AND to_role IN ('admin', 'instructor')
      AND branch_id = auth_user_branch_id()
      AND (
        -- El admin es de todas las sedes
        to_role = 'admin'
        -- Instructor de la misma sede
        OR branch_id = (SELECT branch_id FROM public.users WHERE id = to_user_id)
        -- fix-233-b: instructor que trabaja en ambas sedes
        OR (
          to_role = 'instructor'
          AND EXISTS (
            SELECT 1 FROM public.instructors i
             WHERE i.user_id = to_user_id AND i.both_branches
          )
        )
      )
    )
  );
