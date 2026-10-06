# Fix: Testing — autenticación, sesión, roles y bloqueo de fase piloto
> id: fix-183-b-testing-autenticacion-sesion
> refs: ASG-i-022
> status: in_progress
> created: 2026-10-05

## Root Cause
[Heredado de ASG-i-022.] Track de **testing**, no de un bug puntual: ejecutar el checklist
`specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md` (login, sesión, primer login,
recuperar contraseña, logout, rutas por rol, matriz de fase piloto, menú, pantallas de aviso) y
dejar automatizado en Playwright todo lo marcado "Auto ✓".

Regla de la tanda: **cada bug encontrado va a su propio fix/hotfix**; acá solo se registra el
resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-022). Criterios propios:

- **T1:** cada caso automatizable del checklist tiene un test en `e2e/auth-sesion.spec.ts`
  (o en un spec hermano) y su resultado queda anotado abajo.
- **T2:** la suite corre contra un **build de producción** servido en `localhost:4200` (en
  `ng serve`, `authGuard` deja pasar sin sesión — S14 — y varios casos saldrían distintos).
- **T3:** los casos manuales (red lenta, 2 equipos, correo real, cambios en caliente) quedan
  listados con su resultado o como pendientes con dueño.
- **T4:** cada ❌ tiene su propio track (fix/hotfix) o una decisión registrada.

## Cambio
- `e2e/auth-sesion.spec.ts` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- `npx playwright test e2e/auth-sesion.spec.ts` contra el build de producción en `localhost:4200`.

## Sospechas ya resueltas antes de este track (2026-10-01 → 05)
| Sospecha | Resultado |
|---|---|
| S1 — recuperar contraseña no pide clave nueva | Confirmada → `fix-181-b` (PR #183, pendiente de release) |
| S2 — usuario desactivado sigue entrando | Confirmada en vivo → `fix-180-b`, en producción; bloqueo verificado por el owner |
| S5 — clave inicial = RUT | Confirmada → `fix-182-b`, en producción; prueba de punta a punta OK |
