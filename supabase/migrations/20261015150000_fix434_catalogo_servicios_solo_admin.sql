-- ============================================================================
-- fix-434-m — Servicios especiales: solo el admin administra el catálogo
-- ============================================================================
-- service_catalog no tiene sede: es un catálogo único para las dos sedes. Las policies de
-- INSERT/UPDATE/DELETE admitían a la secretaria, así que la de una sede cambiaba precios o
-- desactivaba servicios de la otra (probado el 2026-10-15: UPDATE como secretaria → 1 fila).
-- Decisión de negocio (2026-10-15, M08): el catálogo sigue siendo común y solo el admin lo crea,
-- edita y borra; la secretaria solo vende. SELECT no cambia (cualquier usuario logueado).
--
-- Rollback: recrear las 3 policies con auth_user_role() = ANY (ARRAY['admin','secretary']).
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

DROP POLICY IF EXISTS insert_service_catalog ON public.service_catalog;
CREATE POLICY insert_service_catalog ON public.service_catalog
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

DROP POLICY IF EXISTS update_service_catalog ON public.service_catalog;
CREATE POLICY update_service_catalog ON public.service_catalog
  FOR UPDATE USING (auth_user_role() = 'admin');

DROP POLICY IF EXISTS delete_service_catalog ON public.service_catalog;
CREATE POLICY delete_service_catalog ON public.service_catalog
  FOR DELETE USING (auth_user_role() = 'admin');
