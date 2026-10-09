# Tasks 0049-b

- [x] T1 — Migración `20261008100000_spec0049_users_lectura_por_sede.sql` (función + política).
- [x] T2 — Test SQL con la migración dentro de un bloque que aborta: AC1, AC2, AC3, AC6 ✓ sin aplicar
  nada (secretaria2: 303 → 199 usuarios visibles). Primera versión: AC6 FALLA en Agenda (16 → 40 ms)
  por los `auth_*()` evaluados por fila → envueltos en `(SELECT …)`: Agenda 16 → 20 ms, Base Alumnos
  35 → 24 ms.
- [x] T3 — Línea base AC5 con la política vieja (`PHASE=antes`): 25 consultas por secretaria, 761 / 870
  filas, 0 `users` en null. Respaldo en el scratchpad de la sesión.
- [x] T4 — `indices/DATABASE.md`.
- [ ] T5 — Aplicar la migración en producción — **esperando aprobación del owner**.
- [ ] T6 — Test SQL con la migración aplicada (AC1–AC3, AC6) + AC4 (instructor y alumno ven su fila).
- [ ] T7 — `PHASE=despues` del e2e AC5: mismas filas y sin `users` en null en las dos sedes.
