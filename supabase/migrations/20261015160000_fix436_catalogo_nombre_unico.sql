-- ============================================================================
-- fix-436-m — Servicios especiales: no hay dos servicios con el mismo nombre
-- ============================================================================
-- Decisión de negocio (2026-10-15, D05): no se permiten dos servicios con el mismo nombre, sin
-- distinguir mayúsculas. La pantalla lo revisa contra el catálogo en memoria; este índice cubre
-- dos altas simultáneas y escrituras por fuera de la pantalla. La app traduce el 23505 a
-- "Ya existe un servicio con ese nombre.".
--
-- Normalización: lower + btrim + espacios internos colapsados, igual que
-- buscarServicioDuplicado() en core/utils/servicios-especiales.utils.ts.
-- Al escribirla, service_catalog tiene 1 fila: el índice se crea sin conflictos.
-- Idempotente.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_name_unique
  ON public.service_catalog (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
