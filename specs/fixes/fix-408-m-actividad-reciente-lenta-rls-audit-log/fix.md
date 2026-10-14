# Fix: "Actividad reciente" tarda segundos y falla con varias sesiones abiertas
> id: fix-408-m-actividad-reciente-lenta-rls-audit-log
> refs: fix-395-m-testing-dashboards (casos A02, P01) · fix-224-m (política "la secretaria lee sus propias acciones") · fix-405-m
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard de secretaria (2026-10-13, BD de dev, `audit_log` con 71.608 filas):

- Con una sola sesión, la consulta de "Actividad reciente" tarda 4 s; es la más lenta de la
  pantalla y la que decide cuánto dura el skeleton.
- Con 4 dashboards cargando a la vez, la misma consulta supera el límite del servidor y falla con
  `57014 canceling statement due to statement timeout`. Desde `fix-405-m` eso se ve como "No se
  pudo cargar el panel"; antes se veía como "Sin actividad reciente".

## Root Cause

La política `select_audit_log` es
`(auth_user_role() = 'admin') OR (user_id = auth_user_id())`. Escritas así, Postgres evalúa las dos
funciones **por cada fila** que recorre (cada una hace una consulta a `users`). La pantalla pide
las últimas 6 filas por `created_at DESC`: para un usuario con pocas acciones propias el motor
recorre casi toda la tabla llamando a las funciones fila por fila antes de juntar 6.

Medido como `secretaria.multisede@test.com` (1 fila propia): 2.459 ms. Como admin: 1 ms (la
primera fila ya cumple).

## Fix

Migración `20261013162000_fix408_audit_log_policy_initplan.sql` (**la aplica Matías**): la misma
política con las funciones envueltas en `(SELECT …)`, para que se evalúen una vez por consulta y el
motor pueda usar el índice `idx_audit_log_user (user_id, created_at DESC)`. No cambia qué filas ve
cada rol.

## Acceptance Criteria

- [x] AC1 — Cada rol ve exactamente las mismas filas de `audit_log` que antes.
- [x] AC2 — Las últimas 6 acciones de una secretaria con pocas acciones propias salen en decenas
      de milisegundos, no en segundos.
- [x] AC3 — La política sigue siendo solo de lectura y con el mismo nombre.

## Regression Test

- Ensayo de la migración en una transacción con `ROLLBACK` contra la BD de dev: mismas filas y
  tiempos antes/después para admin, secretaria, secretaria multi-sede e instructor.

## Verificación (2026-10-13)

Migración ensayada contra la BD de dev en una transacción deshecha (no quedó aplicada):

| Cuenta | Filas visibles antes / después | Últimas 6, antes | Últimas 6, después |
|---|---|---|---|
| Admin | 71.608 / 71.608 | 1 ms | 0–1 ms |
| Secretaria sede 1 | 1.266 / 1.266 | 10 ms | 1 ms |
| Secretaria sede 2 | — / 186 | — | 1 ms |
| Secretaria multi-sede | 1 / 1 | 2.459 ms | 22–38 ms |
| Instructor | 1 / 1 | 2.227 ms | 24 ms |
| Alumno | — / 1 | — | 24 ms |

- Mismos ids en las últimas 6 filas antes y después, para las cuatro cuentas comparadas.
- Plan con la política nueva: las dos funciones aparecen como `InitPlan` (una evaluación por
  consulta) en vez de filtro por fila.
- La política queda con el mismo nombre, `FOR SELECT`, rol `public`.
- Medición en el navegador antes del fix (dashboard de secretaria, una sesión): `audit_log` 4.071 ms;
  la siguiente consulta más lenta, 1.527 ms. Con 4 sesiones: `audit_log` 500 / `57014` en 3 de 4.

**Falta que Matías aplique la migración.** Hasta entonces, con varias sesiones cargando a la vez el
dashboard de secretaria puede mostrar "No se pudo cargar el panel" (se recupera con "Reintentar").
