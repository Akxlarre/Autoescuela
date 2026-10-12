# Asignación ASG-i-061 — Dashboard ejecutivo: medir todo el negocio, no solo Clase B

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-10-12
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Para después del piloto.** El dashboard ejecutivo del admin (spec `0044-b`, "fase 1: Clase B")
cuenta como **ingresos solo los pagos de matrículas Clase B**: no incluye Clase Profesional, cursos
singulares ni ventas de servicios especiales. Los gastos, en cambio, son todos los de la sede, así que
el margen que muestra mezcla ingresos parciales con gastos totales.

Durante el piloto se decidió dejarlo así (2026-10-12, en `fix-047-i`): solo Clase B está en
operación completa y Clase Profesional está apartada. Al levantar la fase, su "Ingresos" deja de
cuadrar con Reportes Contables, que ya suma todas las fuentes.

Objetivo: que el dashboard ejecutivo muestre los ingresos de todo el negocio (total, o separado por
línea) y que coincida con Reportes Contables para el mismo rango y sede.

## Alcance sugerido

- Ampliar `exec_dashboard_kpis` y `exec_dashboard_monthly_series` (migración
  `20260927120000_executive_dashboard_rpcs.sql`) para sumar, además de Clase B: pagos de Clase
  Profesional, cursos singulares (`standalone_course_enrollments` pagados) y ventas cobradas de
  servicios especiales (`special_service_sales.paid = true`), por sede.
- Decidir con el cliente si se muestra un total único o el desglose por línea de negocio.
- Revisar que los KPIs que hoy son "de Clase B" (alumnos activos, clases, ensayos) sigan rotulados
  como tales si no se amplían.
- Verificar contra Reportes Contables con el mismo rango y sede.

## Referencias

- `specs/specs/0044-b-dashboard-ejecutivo-admin/` (alcance Clase B, AC-E5)
- `specs/fixes/fix-047-i-servicios-especiales-como-ingreso/fix.md` (decisión de dejarlo fuera del piloto)
- `ASG-i-060` (criterio de qué estados de `payments` cuentan como ingreso): conviene resolverla antes.

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/migrations/20260927120000_executive_dashboard_rpcs.sql` (vía migración nueva)
- `src/app/core/facades/executive-dashboard.facade.ts`

## Notas para quien la reclame

- No hacer antes de levantar la fase piloto: hoy el alcance Clase B es intencional.
- Las RPC usan `SECURITY INVOKER` y `exec_dashboard_assert_admin()`; mantener ese patrón y usar
  `public.chile_today()` en lugar de `CURRENT_DATE` si se agregan fechas (ARCH-28).
