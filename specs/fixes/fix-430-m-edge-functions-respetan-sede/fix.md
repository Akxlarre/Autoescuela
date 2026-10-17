# Fix: Las funciones de exportación entregan datos de otra sede a la secretaria
> id: fix-430-m-edge-functions-respetan-sede
> refs: fix-429-m-testing-servicios-especiales (caso K09) · fix-043-i · spec 0047-b
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

Las funciones de staff que exportan listados usan la clave de servicio (saltan RLS) y filtran por
el `branch_id` que manda el navegador. `fix-043-i` exigió un usuario de staff real, pero no miró su
sede: con su propio token, la secretaria de la sede 1 pedía `branch_id: 2` (o `null`) y recibía los
datos de la otra sede. Confirmado en vivo el 2026-10-15 en `export-special-services` (ventas con
nombre y RUT), `generate-financial-report`, `generate-cash-closing-report` y
`export-certificates-zip`. Es la misma regla que la RLS por sede (spec 0047-b), que estas
funciones no heredan porque no consultan con el token del usuario.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: una secretaria sin grant que pide otra sede recibe 403.
- AC-2: una secretaria sin grant que no pide sede (o pide `null`) recibe solo la suya, nunca todas.
- AC-3: admin y secretaria con grant multi-sede siguen pudiendo pedir cualquier sede o todas.
- AC-4: la secretaria sigue exportando su propia sede igual que antes.

## Cambio

- `supabase/functions/_shared/staff-auth.ts` — `requireStaff()` devuelve también `branchId` y
  `canAccessBothBranches`; nuevo `resolveBranchScope(access, pedida)` (núcleo puro).
- `export-special-services`, `export-certificates-zip`, `generate-cash-closing-report`,
  `generate-cash-history-report`, `generate-financial-report`, `generate-payment-report`,
  `generate-payroll-report` — la sede sale de `resolveBranchScope`, no del body.

Fuera de alcance: las funciones que reciben un `enrollment_id` (contrato, ficha, licencia,
certificados) — es alcance por id, no por sede pedida; va en su propio fix si se confirma.

## Test de Regresión

- `supabase/functions/_shared/staff-auth.test.ts` — 8 casos nuevos de `resolveBranchScope` y del
  `ok` con sede (19/19 ✓, `npx deno test --node-modules-dir=none` desde `supabase/functions`).
- `deno check` de las 7 funciones: sin errores nuevos (los `TS2345`/`TS2339` de `new Response` y
  `err?.message` son anteriores).
- Verificación en vivo tras el deploy (2026-10-15, ✅): secretaria A con
  `branch_id: 2` → 403; con `null` → solo sede 1; admin `null` → todas.
