# Fix: Testing — Tareas/observaciones, notificaciones y comunicados
> id: fix-230-b-testing-tareas-notificaciones-comunicados
> refs: ASG-i-035
> status: in_progress
> created: 2026-10-20

## Root Cause
[Heredado de ASG-i-035, a confirmar]: todo lo que comunica al equipo o al alumno — tareas/observaciones
internas, notificaciones en tiempo real (disparadas por triggers SQL y facades) y comunicados masivos a
alumnos por email e in-app con consentimiento (Ley 21.719). Depende de Realtime, que ya falló 2 veces en
silencio porque las tablas no estaban publicadas (`fix-031-i`, `fix-227-m`).

Track de **testing**: se ejecuta el checklist `specs/testing-piloto/035-tareas-notificaciones-comunicados.md`
y se recorre `indices/NOTIFICATIONS-MAP.md` completo. Regla de la tanda: **cada bug encontrado va a su
propio fix/hotfix**; acá solo se registra el resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-035). Criterios propios:

- **T1:** las sospechas del checklist quedan confirmadas (con su track), descartadas o como decisión.
- **T2:** ninguna prueba envía correos reales ni deja datos: lo que escribe usa alumnos E2E- (los limpia
  el harness) o cuentas de prueba restauradas al final; los envíos de correo se interceptan.
- **T3:** los casos automatizables quedan en `e2e/`.

## Cambio
- `e2e/*.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- Los tests nuevos de este track, contra `localhost:4200`.
