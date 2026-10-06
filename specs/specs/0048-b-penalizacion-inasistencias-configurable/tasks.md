# Tasks 0048-b — Cancelación automática por inasistencias configurable por sede

## Progreso
- [x] Migración `20261006140000_spec0048_branch_absence_penalty_config.sql` escrita
- [x] Prueba `supabase/tests/agenda/spec-0048-b-penalizacion-configurable.sql` — 8/8 ok con la migración puesta, en un envío que se deshizo entero (verificado después: la tabla no existe)
- [x] `AbsencePenaltyConfigFacade` + spec (8 tests, TDD)
- [x] `AsistenciaClaseBFacade`: aviso AC-E2 (`-1`) y `recorded_at` en el "Ausente" manual (+3 tests)
- [x] Drawer `penalizacion-inasistencias-drawer` (p-toggleswitch por sede, solo lectura para secretaria)
- [x] Ajustes agrupado (AC8) + tarjetas unificadas a `.card` (ARCH-25)
- [x] `ng build` OK · `npm run lint:arch` 0 errores · `npm run test:ci` 3310/3310 · capturas admin y secretaria revisadas
- [x] Aplicada en la BD del piloto con aprobación del owner ("si dale") y registrada en `schema_migrations` (`20261006140000`); las 2 sedes quedaron desactivadas
- [x] Prueba SQL con la migración aplicada: 8/8 ok
- [x] App contra la BD real: admin activó la sede 1 (BD con `enabled_since` y `updated_by`) y la desactivó; secretaria ve solo su sede en solo lectura. Estado final: ambas sedes desactivadas
- [x] `indices/` actualizados (DATABASE, FACADES, COMPONENTS); commit y PR
