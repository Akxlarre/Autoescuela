# Tasks 0049-b

- [x] T1 — Migración `20261008100000_spec0049_users_lectura_por_sede.sql` (función + política).
- [x] T2 — Test SQL con la migración dentro de un bloque que aborta: AC1, AC2, AC3, AC6 ✓ sin aplicar
  nada (secretaria2: 303 → 199 usuarios visibles). Primera versión: AC6 FALLA en Agenda (16 → 40 ms)
  por los `auth_*()` evaluados por fila → envueltos en `(SELECT …)`: Agenda 16 → 20 ms, Base Alumnos
  35 → 24 ms.
- [x] T3 — Línea base AC5 con la política vieja (`PHASE=antes`): 25 consultas por secretaria, 761 / 870
  filas, 0 `users` en null. Respaldo en el scratchpad de la sesión.
- [x] T4 — `indices/DATABASE.md`.
- [x] T5 — Migración aplicada en producción (aprobada por el owner, 2026-10-08) y registrada en
  `schema_migrations`. Política anterior respaldada antes de aplicar.
- [x] T6 — Test SQL con la migración aplicada: AC1, AC2, AC3, AC6 ok (Agenda 24.7 → 20.2 ms, alumnos
  27.3 → 25.1 ms en esa corrida). AC4: un instructor y un alumno ven su propia fila (y el instructor
  solo esa).
- [x] T7 — AC5, `PHASE=despues`:
  - Sede 2: 25/25 consultas idénticas (870 filas), 0 `users` en null.
  - Sede 1: todas las consultas comunes idénticas, 0 `users` en null. 2–5 consultas de Pagos no
    alcanzaron a cargarse según la corrida (la navegación pasa a la siguiente pantalla antes): se
    verificaron por SQL impersonando a la secretaria de la sede 1 — saldos pendientes 26 (= línea
    base) y pagos 62 sin ningún usuario en null, **igual que con la política vieja** restaurada en un
    bloque revertido (62/26). La diferencia 62 vs 63 sin RLS viene de la RLS de otra tabla, no de esta.
  - Fix del propio e2e: la línea base vivía en `test-results/`, que Playwright borra al empezar; ahora
    va a `<tmp>/autoescuela-0049-b/` y la fase "despues" falla si no la encuentra.
