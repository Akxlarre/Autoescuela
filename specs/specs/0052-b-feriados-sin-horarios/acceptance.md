# Acceptance — Spec 0052-b (feriados sin horarios)

> **Resultado:** ✅ PASA (2026-10-19)

| AC | Evidencia |
|---|---|
| AC1 | Migración `20261019120000` aplicada y registrada. `holidays` con RLS: la secretaria la lee y **no** puede escribir (test 0052-b, como `authenticated`). |
| AC2 | `sync-holidays` v1 desplegada (`verify_jwt = true`). Ejecutada con la misma llamada del cron: `200`, 2026 y 2027 con 16 feriados nacionales + el 20 de agosto `local` cada uno (34 filas). Segunda ejecución: siguen 34 (idempotente). |
| AC3 | Cron `sync-holidays-monthly` (`0 7 1 * *`) activo. |
| AC4 | Producción: 8-dic-2026, 25-dic-2026 y 1-ene-2027 con 0 bloques. Test 0052-b 6/6 (feriado de prueba sin bloques; el día siguiente sí). |
| AC5 | Test 0052-b lee la vista como secretaria sin error; fix-224/226/227/228-b en verde en producción. e2e de la Agenda (`agenda.spec.ts` + `agenda-2.spec.ts`) 40/40 (1 omitido como siempre). |
| AC-E1 | Por código: si ninguna fuente responde para un año (`fetchHolidaysForYear` → `null`), solo se asegura el feriado local y no se borra nada (`upsert`, sin `delete`); queda un `console.warn`. No se forzó la caída de las tres APIs en producción. |

Tiempo de la vista (EXPLAIN ANALYZE): una semana 213 ms, igual que antes de la spec.
