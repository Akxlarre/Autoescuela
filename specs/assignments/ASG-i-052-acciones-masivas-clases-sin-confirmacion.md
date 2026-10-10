# Asignación ASG-i-052 — "Borrar horarios" y "Reactivar" cambian clases en masa sin confirmación

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-10-10
> **resulting_track:** fix-364-m-acciones-masivas-clases-sin-confirmacion

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29).

1. **"Borrar horarios"** (alerta del dashboard "N alumnos con 2+ clases sin asistir"): con un clic
   y sin diálogo pone `status='cancelled'` a **todas** las sesiones `scheduled`, pasadas y
   futuras, de todas las matrículas afectadas, sin registrar motivo. Además la alerta cuenta
   clases `scheduled` cuya hora ya pasó, no faltas reales: un alumno con 2 clases en la mañana
   que nadie "inició" todavía ya cae ahí (`dashboard-alerts.facade.ts:126-140`;
   `alerts-drawer.component.ts:203-220`).
2. **"Reactivar"** (Asistencia B): pasa a `scheduled` todas las clases `cancelled` de la
   matrícula, incluidas las de fechas pasadas y las canceladas por penalización, sin archivar la
   falta ni revisar disponibilidad (`asistencia-clase-b.facade.ts:277-299`).

## Alcance sugerido

- **Paso 1, confirmar** leyendo el código y, si se prueba, **solo** con un alumno de prueba creado
  para eso (la acción cancela clases reales de la BD compartida).
- (1): diálogo de confirmación que diga cuántas clases y de quiénes se cancelan; limitar a
  clases futuras; registrar motivo; corregir el criterio de la alerta (faltas reales).
- (2): reactivar solo clases futuras y revisar disponibilidad (Triple Match) antes.
- Definir la regla de negocio con el dueño si hay dudas (ver §5 de `027` y `030`).

## Referencias

- `specs/testing-piloto/027-asistencia-clase-b.md` S3, S4 · `030-dashboards.md` S1
- `ASG-i-038` (decisión de la nota y del cron en el piloto)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/dashboard-alerts.facade.ts`, `alerts-drawer.component.ts`,
  `src/app/core/facades/asistencia-clase-b.facade.ts`

## Notas para quien la reclame

- Con el portal Instructor bloqueado, la alerta se dispara mucho más seguido (nadie marca en tiempo
  real), así que el riesgo de cancelar clases por error es alto en el piloto.
