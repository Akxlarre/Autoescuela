-- fix-234-b (S21 del checklist 035, ASG-i-035): una secretaria solo crea notificaciones para
-- usuarios de su sede.
--
-- Antes `insert_notifications` solo pedía rol admin o secretaria: una secretaria podía notificar a
-- cualquier usuario de cualquier sede, con cualquier texto. El admin sigue igual. Las notificaciones
-- de triggers SECURITY DEFINER y de Edge Functions (service role) no pasan por esta policy.

-- La secretaria no puede leer usuarios de otra sede (RLS de users), así que la comprobación va en
-- una función SECURITY DEFINER. branch_visible(NULL) es verdadero: cubre al admin, que no tiene sede.
CREATE OR REPLACE FUNCTION public.secretary_can_notify(p_recipient_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = p_recipient_id
       AND (
         public.branch_visible(u.branch_id)
         -- Instructor que trabaja en ambas sedes: recibe tareas de las dos (fix-233-b).
         OR EXISTS (
           SELECT 1 FROM public.instructors i WHERE i.user_id = u.id AND i.both_branches
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.secretary_can_notify(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secretary_can_notify(integer) TO authenticated, service_role;

DROP POLICY IF EXISTS insert_notifications ON public.notifications;

CREATE POLICY insert_notifications ON public.notifications
  FOR INSERT WITH CHECK (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND public.secretary_can_notify(recipient_id)
    )
  );
