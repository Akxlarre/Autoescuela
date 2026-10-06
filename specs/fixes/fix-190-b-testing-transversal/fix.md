# Fix: Testing transversal — multi-sede, shell, tiempo real, responsive y modo oscuro
> id: fix-190-b-testing-transversal
> refs: ASG-i-037
> status: in_progress
> created: 2026-10-06

## Root Cause
[Heredado de ASG-i-037.] Track de **testing**, no de un bug puntual: ejecutar el checklist
`specs/testing-piloto/037-transversal-multisede-shell.md` (inventarios de edge functions, Realtime,
RLS, RPC y Storage; shell; selector de sede; barrido de rutas × rol × ancho × tema; hora de Chile;
errores; 2 pestañas; accesibilidad) y automatizar lo marcado "Auto ✓".

Regla de la tanda: **cada bug encontrado va a su propio fix/hotfix**; acá solo se registra el
resultado de cada caso (✅ / ❌ + evidencia). Una fuga entre sedes es **P0 inmediato**.

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-037). Criterios propios:

- **T1:** las sospechas S1–S15 quedan confirmadas, descartadas (con el track que las cerró) o como
  decisión pendiente.
- **T2:** el barrido de rutas (§3.B) queda en Playwright contra el build de producción.
- **T3:** las pruebas de API de la sección P que escriben se hacen en transacciones que se deshacen
  o con datos `E2E-` que se borran; nunca dejan cambios en datos reales.
- **T4:** cada ❌ tiene su propio track (fix/hotfix) o una decisión registrada.

## Cambio
- `e2e/*.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- `npx playwright test e2e/barrido-rutas.spec.ts` contra el build de producción en `localhost:4200`.
