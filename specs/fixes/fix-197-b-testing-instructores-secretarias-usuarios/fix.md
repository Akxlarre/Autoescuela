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
| S3 | ❌ Confirmada → **corregida en `fix-201-b`** (PR #219) | El alta tomaba la sede solo del topbar y el campo lo veía solo el admin: la secretaria no podía crear, o usaba la sede guardada por otro usuario. E2E: sin el fix manda `branchId: 2`, con el fix `1` |
| S7 | ❌ Confirmada → **corregida en `fix-202-b`** (PR #220) | `license_status` congelado hasta editar. Estado calculado con la fecha; Agenda marca "· licencia vencida" y avisa (opción B del owner: se sigue ofreciendo) |
| S8 | ❌ Confirmada → **corregida en `hotfix-065-b`** (PR #221) | Práctico sin vehículo no tiene turnos en la Agenda; el alta ahora lo avisa |
| S9 | ❌ Confirmada → **corregida en `fix-205-b`** (PR #225) | Decisión del owner: avisar, no bloquear. Al marcar Inactivo: N clases futuras + vehículo asignado. E2E sin guardar |
| S10 | ❌ Confirmada → **corregida en `hotfix-067-b`** (PR #228) | Reenviar invitación usaba el correo del formulario (400 si se editó sin guardar); ahora el guardado + nota. E2E con la función interceptada |
| S12 | ❌ Confirmada → **corregida en `fix-204-b`** (PR #223, desplegado) | Decisión del owner: materno opcional en los 4 formularios y en `create/update-secretary` |
| S13 | ⚠️ Parcial → **`hotfix-068-b`** (PR #229) | "Se enviará confirmación al nuevo correo" era falso (la API de admin cambia directo): corregido. "No podrá iniciar sesión mientras esté inactiva" ya es cierto desde `fix-180-b` (ban en Auth) |
| S14 | ❌ Confirmada → **pendiente de decisión del owner** | "Último acceso" = `users.updated_at`, que no tiene trigger: en las 8 secretarias es igual a la fecha de creación. El login real está en `auth.users.last_sign_in_at` (requiere función SQL nueva) |
| S15 | ❌ Confirmada → **corregida en `fix-207-b`** (PR #230) | Rango de "hoy" sin offset (Postgres lo leía en UTC) → `getChileDateTimeRange()`; botón "Ver clases activas" sin acción, quitado. Se respeta la decisión de `fix-072-m` (solo hoy) |
| S16 | ❌ Confirmada → **corregida en `fix-208-b`** (PR #231) | Horas acotadas a la lista (sede), error visible, mes actual al abrir, guard de orden. E2E |
| S17 | ❌ Confirmada → **corregida en `hotfix-066-b`** (PR #222) | Decisión del owner: se eliminó `/app/admin/usuarios` |
| S18 | ❌ Confirmada → **corregida en `fix-206-b`** (PR #226, migración aplicada) | Decisión del owner: auditar todo. Triggers en `instructors`, `vehicle_assignments`, `branch_payroll_config`; test SQL 7/7 en prod sin efectos |
| S19 | ❌ Confirmada → **corregida en `fix-209-b`** (PR #232) | Error de carga mostrado como "No hay…" + sin guard de orden en instructores/secretarias. E2E con 500 simulado |
| S20 | ❌ Confirmada → **pendiente de decisión del owner** | Editar acepta licencia vencida (Crear la bloquea; la ficha ya la marca "Vencida") y marca "Número de licencia *" sin validarlo; Crear no lo pide (manda vacío). Las 16 filas actuales tienen número |
| S21 | ✅ Descartada | El botón "Limpiar filtros" ya existe (`app-clear-filters-button`). "Sedes con personal = 1" con una sede elegida es coherente: todos los KPIs de la página se acotan a la sede del topbar |
| S22 | ❌ Confirmada → **corregida en `fix-210-b`** (PR #233) | Decimales (columna INTEGER → error crudo) y 0 habilitaban Guardar; ahora solo enteros > 0, con aviso |

**Hallazgo lateral:** `create-secretary` desplegado tiene código de `fix-182-b` que nunca llegó a
`main` (5 commits subidos a `fix/182-b-secretaria-invitacion` después de mergear el PR #184, entre
ellos `f68e63b2`: chequeo previo de RUT duplicado). Desplegarla desde `main` hoy lo borraría →
decisión del owner (recuperarlos en `main`).
