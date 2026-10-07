# Fix: Testing — Gestión de instructores, secretarias y usuarios
> id: fix-197-b-testing-instructores-secretarias-usuarios
> refs: ASG-i-034
> status: in_progress
> created: 2026-10-07

## Root Cause
[Heredado de ASG-i-034, a confirmar]: Alta y edición de personal (instructores, secretarias) y
usuarios en general: cuentas de Auth + tabla pública, invitación/activación, asignación de sede y
grants multi-sede. Un error acá deja personas sin acceso, con acceso de más, o con Auth y BD
desincronizados.

Track de **testing**: se ejecuta el checklist `specs/testing-piloto/034-instructores-secretarias-usuarios.md`
(sospechas S1–S22 + casos A–V). Regla de la tanda: **cada bug encontrado va a su propio
fix/hotfix**; acá solo se registra el resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-034). Criterios propios:

- **T1:** las sospechas S1–S22 quedan confirmadas (con su track), descartadas o como decisión.
- **T2:** ninguna prueba deja cambios en cuentas reales: lo que escribe se hace en transacciones
  revertidas, con valores idénticos (no-op) o sobre cuentas de prueba creadas y retiradas.
- **T3:** los casos marcados para Playwright quedan en `e2e/`.

## Cambio
- `e2e/*.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- Los tests nuevos de este track, contra el build de producción en `localhost:4200`.
