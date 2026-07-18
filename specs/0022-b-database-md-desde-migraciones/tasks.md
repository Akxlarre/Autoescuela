# Tasks 0022-b

- [x] T1 — `scripts/lib/sql-schema.js`: splitStatements (dollar-quotes, strings, comentarios) + reducer de sentencias + renderDatabaseMd
- [x] T2 — Micro-suite `scripts/lib/sql-schema.test.mjs` (21 casos)
- [x] T3 — (descubierta) Comentarios se quitan ANTES del enmascarado dollar-quote: un `$$` dentro de un `--` comentario desalineaba el pareo (caso real en create_website_config.sql)
- [x] T4 — (descubierta) splitTopLevel quote-aware (JSONB defaults con comas), TYPE con coma (`NUMERIC(5,1)`), policies de `storage.*` ignoradas conscientemente
- [x] T5 — Colector en indices-sync con cache por stamp `count:maxMtime` (guarda el markdown renderizado, no Maps)
- [x] T6 — Marcadores AUTO-GENERATED al final de DATABASE.md (contenido manual intacto)
- [x] T7 — Verificación: 21/21 tests, 133 migraciones → 76 tablas / 0 warnings / 0 parse parcial, fidelidad users/enrollments/notifications, idempotencia
