# Plan 0022-b — DATABASE.md desde migraciones

> **Status:** approved
> **Approved by:** Akxlarre ("empecemos entonces, todas menos la 23", 2026-07-01)
> **Modelo ejecutor:** Fable 5

## Decisión §9 (cerrada): parser regex por sentencia, cero dependencias

133 migraciones / 535KB de SQL convencional e idempotente. AC7 (fallo honesto) es la red:
toda sentencia DDL no entendida se reporta con archivo, nunca se omite en silencio.
`pgsql-parser` queda como escalada futura solo si AC7 dispara seguido. Seeds NO se indexan.

## Diseño

### `scripts/lib/sql-schema.js` (nuevo, testeable)

- `splitStatements(sql)`: protege cuerpos dollar-quoted (`$$…$$`, `$tag$…$tag$`),
  quita comentarios (`--`, `/* */`), separa por `;`.
- `applyStatement(state, stmt, file)` — reducer sobre `state = { tables, views, functions, warnings }`:
  - `CREATE TABLE [IF NOT EXISTS]` → columnas (nombre, tipo, NOT NULL, DEFAULT, REFERENCES
    inline, PK/UNIQUE), constraints de tabla (FOREIGN KEY compuesto, PRIMARY KEY).
    Repetido idempotente → no-op (AC-E1).
  - `ALTER TABLE`: ADD/DROP/RENAME COLUMN, RENAME TO (AC-E3), ADD CONSTRAINT FK,
    ALTER COLUMN SET DEFAULT/TYPE/NOT NULL, ENABLE ROW LEVEL SECURITY.
  - `DROP TABLE` → remueve del estado.
  - `CREATE [UNIQUE] INDEX` → lista por tabla. `DROP INDEX` → remueve.
  - `CREATE POLICY` (cmd + USING/CHECK truncados) / `DROP POLICY` (AC3).
  - `CREATE [OR REPLACE] FUNCTION` (solo firma) / `CREATE VIEW` / drops (AC-E2).
  - `COMMENT ON TABLE` → descripción de la tabla (¡las migraciones ya la traen!).
  - Ignorados conscientes: INSERT/UPDATE/DELETE (seeds), GRANT/REVOKE, CREATE EXTENSION,
    DO, SET, COMMENT ON COLUMN, ALTER PUBLICATION, CREATE TRIGGER (límite conocido §4).
  - Cualquier otro CREATE/ALTER/DROP → `warnings` + tabla marcada `⚠ parse parcial` (AC7).
- `parseMigrations(dir)`: archivos `.sql` en orden lexicográfico (timestamp) → estado final.
- `renderDatabaseMd(state)`: por tabla → descripción, tabla de columnas
  (Columna/Tipo/Null/Default/FK), RLS + policies, índices; secciones de vistas y funciones;
  bloque de warnings AC7 al final.

### `scripts/indices-sync.js`

- Colector con cache liviano: stamp `count:maxMtime` del directorio → si no cambió, reusa
  el **markdown renderizado** guardado en el cache (string, sin Maps) sin re-parsear (AC6).
- `injectGenerated` sobre `indices/DATABASE.md` con marcadores agregados AL FINAL del
  contenido manual actual (AC5: nada del contenido existente se toca).

### Micro-suite `scripts/lib/sql-schema.test.mjs`

Migración sintética con: CREATE + repeat idempotente, ALTER ADD/DROP/RENAME COLUMN,
RENAME TO, DROP TABLE, POLICY + DROP POLICY, función con `$$` (el `;` interno no rompe
el split), vista, sentencia desconocida → warning.

## Verificación (AC4)

Comparar salida de `users`, `enrollments` y `notifications` contra las migraciones
(columnas clave, FKs, policies) por inspección dirigida.
