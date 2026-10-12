-- fix-219-b: todo usuario autenticado puede leer SU PROPIA fila de `users`, esté activo o no.
--
-- Antes, todas las ramas de `select_users` dependían de `auth_user_role()`, que devuelve NULL para
-- un usuario inactivo (fix-180-b). Una secretaria desactivada con la app abierta no podía leer ni
-- su propia fila: el evento de tiempo real de esa fila no le llegaba (Realtime solo entrega filas
-- legibles) y la app nunca se enteraba de la desactivación — seguía dentro, con todo vacío.
--
-- Qué cambia: se agrega `OR id = (SELECT auth_user_id())` (auth_user_id() no mira `active`).
-- Un inactivo lee una sola fila, la suya; sigue sin leer ninguna otra fila ni tabla. Para los
-- activos no cambia nada: su propia fila ya entraba por las ramas existentes.
-- El resto de la policy es idéntico al de la spec 0049-b. Idempotente.

DROP POLICY IF EXISTS select_users ON public.users;
CREATE POLICY select_users ON public.users
  FOR SELECT
  -- Los auth_*() van envueltos en (SELECT …): Postgres los evalúa una vez por consulta (initplan) y
  -- no por cada fila (spec 0049-b).
  USING (
    ((SELECT public.auth_user_role()) = 'admin')
    OR (
      (SELECT public.auth_user_role()) = 'secretary'
      AND (
        (SELECT public.auth_can_access_both_branches())
        OR branch_id IS NULL
        OR branch_id = (SELECT public.auth_user_branch_id())
        OR id IN (SELECT public.secretary_extra_visible_user_ids())
      )
    )
    -- La fila propia: cualquier rol, activo o inactivo (fix-219-b). Cubre también al instructor y
    -- al alumno, que antes tenían su propia rama por rol.
    OR id = (SELECT public.auth_user_id())
  );
