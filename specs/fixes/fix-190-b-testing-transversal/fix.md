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

## Sospechas — estado (2026-10-06)

| # | Resultado | Evidencia / track |
|---|---|---|
| S1 | ❌ **Confirmada y peor: ejecutable SIN sesión** | Como `anon`, `confirm_enrollment_with_payment` activó un borrador con un "pago" de $1 (prueba deshecha). Inventario: 12 funciones `SECURITY DEFINER` que escriben, todas con `EXECUTE` para `anon`. → **corregido en `fix-191-b`** (aplicado; PR #198) |
| P16 | ❌ Confirmada (mismo inventario) | `mark_end_of_day_*`, `cleanup_*`, `auto_transition_*`, etc. → `fix-191-b` |
| S2 | ✅ Descartada | La cerró `0047-b` (RLS por sede en `students`); su prueba pasa |
| S3 | ✅ Descartada | Sin sesión → **401** (`requireStaff`, `fix-043-i`, versión desplegada verificada) |
| S4 | ✅ Descartada | Sin sesión → **401**; el código exige admin (`requireStaff(['admin'])`) |
| S5 | Pendiente — de otra asignación | `audit_log` falsificable = punto 3 de **ASG-i-047** (Matías); nota dejada en esa asignación |
| S6 | ✅ Descartada | La cerró `fix-178-b` (`website-public` sin subida anónima ni sobrescritura entre sedes) |
| S7 | ❌ Confirmada → **decisión del owner** | Sin sesión, `public-enrollment` responde `load-instructors` (nombres + patentes) y `check-duplicate` (si un RUT tiene matrícula en curso: enumeración de alumnos). `reserve-slots`/`submit-pre-inscription` siguen en el código (no ejecutadas: escriben). `student-payment` conserva `reserve-slots`/`release-slots` legacy |
| S8 | ✅ Descartada | La cerró `0047-b` (`standalone_*`, `instructor_advances`, `certificates`, `discount_applications`, `absence_evidence`, `school_documents`…) |
| S9 | ❌ Confirmada por código | `layout-drawer.component.ts` / `layout-drawer.facade.service.ts`: sin listener de Escape, sin cierre en `router.events`, sin `role="dialog"`/`aria-modal` (el único `role="dialog"` del shell es el del modal de confirmación) |
| S10 | ❌ Confirmada por código | `app-shell.component.ts:118` pinta el mensaje del modal con `[innerHTML]` |
| S12 | ❌ Confirmada por código | `BranchFacade` no escucha el evento `storage`: la sede elegida no se sincroniza entre pestañas hasta recargar → **decisión** (K03) |
| S15 | ❌ Confirmada por código | El selector de sede de Ajustes ("Sede activa") no mira `lockReason`/`disabledBranchIds` |

## Barrido de rutas (§3.B) — `e2e/barrido-rutas.spec.ts`, build de producción, 2026-10-06

52 rutas (29 admin + 23 secretaria sede 2) × 3 celdas (375 claro, 1440 claro, 1440 oscuro) =
156 cargas, 5,8 min con 3 workers. Capturas por celda en `test-results/barrido-rutas-*`.
`E2E_BARRIDO_FULL=1` corre la matriz completa (6 celdas).

| Resultado | Rutas |
|---|---|
| ✅ 49/52 limpias en las 3 celdas | C1 consola sin errores · C2 red sin 4xx/5xx · C3 sin scroll horizontal · C4 app-like en 1440 |
| ❌ **B12 secretaria `/contabilidad/cuadratura`** | 1440/claro y 1440/oscuro: **no app-like**, `.shell-content` sobra **392 px**: "Egresos / Retiros" queda debajo de "Ingresos" y la página scrollea (la spec `0004-i` la dejó con Egresos en la columna derecha). → **track propio (pendiente)** |
| ⚠️ B10 `/matricula` (admin y secretaria) | 1440: `.shell-content` 14 px más ancho que su caja; no se ve (tiene `overflow-x-hidden`) → observación menor, sin track |

**Limitación del barrido:** el admin corre con "Todas las sedes". En las pantallas que exigen elegir
sede (Caja Diaria, Nueva Matrícula) mide el selector de sede, no la pantalla real — por eso B12 admin
"pasó". El caso real de Caja quedó cubierto por la secretaria.
