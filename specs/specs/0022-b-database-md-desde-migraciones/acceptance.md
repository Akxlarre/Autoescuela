# Acceptance 0022-b — DATABASE.md desde migraciones (2026-07-01)

> Ejecutado por Fable 5. Evidencia: `scripts/lib/sql-schema.test.mjs` (21 casos) + parse
> real de las 133 migraciones (535 KB de SQL).

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| AC1 (estado acumulado) | ✅ | 133 migraciones en orden lexicográfico → 76 tablas; CREATE + ALTER ADD/DROP/RENAME + DROP aplicados (test suite cubre cada reducer) |
| AC2 (contenido por tabla) | ✅ | Columnas con tipo/null/default/PK/UQ/FK; RLS flag; descripción tomada del `COMMENT ON TABLE` de las propias migraciones |
| AC3 (policies vigentes) | ✅ | 274 policies con cmd + USING/CHECK truncados; `DROP POLICY` respeta (test) |
| AC4 (fidelidad) | ✅ | `users`: 15/15 columnas idénticas a migración 01 (incl. `can_access_both_branches` RF-013), FKs a roles/branches, 4 policies con el `branch_visible` de fix-027; `enrollments` y `notifications` con descripciones y columnas completas |
| AC5 (manual intacto) | ✅ | Marcadores agregados AL FINAL; las 158 líneas manuales previas byte-idénticas |
| AC6 (idempotencia + cache) | ✅ | Cache por stamp `count:maxMtime` que guarda el markdown renderizado (string — sin el problema Maps→JSON); segunda corrida "sin cambios" |
| AC7 (fallo honesto) | ✅ | Warnings con archivo de origen + tabla marcada `⚠ parse parcial`. Estado final del repo real: **0 warnings, 0 parciales** (tras 3 fixes de parser encontrados por esta misma red: ver T3/T4) |
| AC-E1 (idempotencia SQL) | ✅ | CREATE IF NOT EXISTS repetido → primera definición gana (test) |
| AC-E2 (funciones/vistas) | ✅ | 40 funciones (firma) + 4 vistas `v_*` en secciones propias |
| AC-E3 (RENAME) | ✅ | RENAME TO y RENAME COLUMN aplican el nombre nuevo (test) |

## Hallazgos del parser sobre SQL real (AC7 funcionando como red)

1. Un `$$` dentro de un comentario `--` desalineaba el pareo dollar-quote → los comentarios
   se quitan primero.
2. Defaults JSONB con comas rompían el split de columnas → splitTopLevel quote-aware.
3. `NUMERIC(5,1)` en ALTER COLUMN TYPE.
4. Policies de `storage.objects` (schema Supabase, no del app) → ignoradas conscientemente;
   siguen documentadas a mano en la sección "Storage Buckets".

## Señal de salud detectada

**Las 76 tablas tienen RLS habilitado** — cero tablas expuestas.

## Decisiones cerradas (§9)

- Parser: regex por sentencia, cero dependencias (pgsql-parser innecesario: 0 warnings).
- Seeds: NO se indexan.

## Estado: DONE
