# Asignación ASG-i-030 — Testing: Dashboards (admin, ejecutivo y secretaria)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/030-dashboards.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Los dashboards no generan datos, los agregan: KPIs, clases en vivo, alertas y actividad reciente
salen de todos los demás módulos. Son el lugar donde el cliente "ve" si el sistema está bien, y
el dashboard ejecutivo de admin (spec `0044-b`) es nuevo y recibió 5 fixes en su primera semana.

**Clasificación:** **Integración** · dificultad **Media** · rutas: `/app/admin/dashboard` (incluye
el ejecutivo), `/app/secretaria/dashboard`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de spec `0044-b` (28 ACs) y `fix-172-b` … `fix-176-b` (pending_payment excluido, effect de
  sede, carga stale, presets re-resueltos, filtro personalizado), `fix-227-m` (Realtime de clases
  actuales), `ASG-b-018` (KPIs vehículos/ingresos), `fix-029-m` (clases canceladas visibles).

**2. E2E manual**
- Cada KPI contra su fuente: alumnos activos vs Base de Alumnos, ingresos del mes vs Reportes,
  vehículos vs Flota, clases de hoy vs Agenda.
- Dashboard ejecutivo: presets de período, rango personalizado, comparación con el período
  anterior, cambio de sede rápido (sin datos de otra sede ni skeleton pegado).
- "Clases actuales" en tiempo real con 2 sesiones.
- Alertas (documentos vencidos, pagos pendientes, cierre de clase atrasado) → coinciden con los
  datos reales y llevan a donde corresponde.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- KPIs contra datos sembrados conocidos (admin y cada sede).
- Cambio de sede rápido → los KPIs finales corresponden a la última sede elegida.

## Fuera de alcance

- Dashboards de instructor y alumno (fuera del piloto).

## Referencias

- `specs/specs/0044-b-dashboard-ejecutivo-admin/` · `docs/UAT-PLAN.md` Paquete 4

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- Conviene correrla al final: los KPIs se validan mejor cuando los otros módulos ya generaron
  datos conocidos.
