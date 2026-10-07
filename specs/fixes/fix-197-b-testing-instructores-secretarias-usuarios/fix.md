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

## Sospechas — estado (2026-10-07)

| # | Resultado | Evidencia / track |
|---|---|---|
| S1 | ✅ Descartada | La cerró `fix-179-b` (`authorizeInstructorEdit`: `userId` = dueño del instructor, rol instructor, sede). Su test de BD sigue pasando en producción |
| S2 | ✅ Descartada | La cerró `fix-179-b` (RLS de `users` para secretaria + columnas protegidas `can_access_both_branches`/`supabase_uid`). Test `fix-179-b-users-secretaria.sql` verde en producción |
| S4 | ❌ Confirmada → **corregida en `fix-198-b`** (PR #214, desplegado) | `create-instructor` usaba el `branchId` del body; `activate-instructor-account` reenviaba de cualquier sede. En vivo, secretaria sede 1: crear en sede 2 → 403, reenviar de sede 2 → 403 |
| S5 | ❌ Confirmada → **corregida en `fix-199-b`** (PR #215, desplegado) | Los 3 `update-*` cambiaban Auth antes que `users` sin revertir. En vivo: correo de otro usuario → 409 y nada cambia (ni `users` ni Auth) |
| S6 (servidor) | ❌ Confirmada → **`fix-199-b`** | `includes('already registered')` no calzaba con "…already been registered": 409 → 500. Ahora `isEmailTakenError` |
| S6 (front) | ❌ Confirmada → **corregida en `fix-200-b`** (PR #217) | Crear instructor, crear/editar secretaria y reenviar invitación mostraban un texto genérico (DG-085); ahora un 4xx muestra el motivo real |
| S11 | ✅ Descartada | La cerró `fix-182-b` (secretaria sin clave inicial = RUT) |

**Hallazgo lateral:** `create-secretary` desplegado tiene código de `fix-182-b` que nunca llegó a
`main` (5 commits subidos a `fix/182-b-secretaria-invitacion` después de mergear el PR #184, entre
ellos `f68e63b2`: chequeo previo de RUT duplicado). Desplegarla desde `main` hoy lo borraría →
decisión del owner (recuperarlos en `main`).
