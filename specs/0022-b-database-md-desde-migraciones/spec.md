# Spec 0022-b — DATABASE.md auto-generado desde migraciones SQL

> **Status:** done (2026-07-01 — ver acceptance.md)
> **Created:** 2026-07-01
> **Owner:** Akxlarre
> **Priority:** P2
> **Modelo Claude:** `claude-fable-5` (Fable 5) u `claude-opus-4-8` (Opus 4.8) — es el proyecto pesado del lote: diseñar un parser acumulativo de SQL (CREATE + ALTERs + policies en orden cronológico) con decisiones de representación y de tolerancia a dialecto Postgres. Un modelo menor produciría un parser frágil que minaría la confianza en el índice.

---

## 1. Contexto de negocio

**Origen:** Sesión de análisis del tooling AST (2026-07-01). DATABASE.md es el único índice
crítico 100% manual, y el Context Guard **depende de él** para dejar programar.

**Persona afectada:** El agente: si DATABASE.md miente (columna renombrada, policy nueva no
documentada), programa contra un esquema falso y el error aparece recién en runtime/RLS.

**Problema que resuelve:**
Las migraciones en `supabase/migrations/` son la fuente de verdad del esquema, pero el índice
que el agente consulta se actualiza a mano y deriva. Es la misma clase de problema que
`collectStyles` resolvió para el DS: derivar el índice de la fuente en vez de duplicarla.

**Hipótesis de valor:**
Un DATABASE.md que nunca miente sobre columnas, FKs y policies elimina toda una clase de bugs
de "programé contra un esquema que ya no existe".

---

## 2. User Stories

- **US1**: Como agente, quiero que `indices:sync` reconstruya el esquema efectivo desde las
  migraciones, para consultar columnas/FKs/policies reales sin leer N archivos SQL.
- **US2**: Como humano, quiero que las notas de negocio manuales de DATABASE.md sobrevivan a
  cada regeneración, para no perder el contexto que el SQL no expresa.
- **US3**: Como agente, quiero ver las policies RLS por tabla, para razonar sobre visibilidad
  de datos (sede, rol) sin reconstruirlas mentalmente.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 (estado acumulado)**: Given las migraciones ordenadas cronológicamente por timestamp
  del filename, When corre el colector, Then el estado final refleja la acumulación:
  `CREATE TABLE` + `ALTER TABLE ADD/DROP/ALTER COLUMN` + `DROP TABLE` aplicados en orden.
- **AC2 (contenido por tabla)**: Given una tabla del estado final, Then su sección muestra:
  columnas (nombre, tipo, nullable, default), PK, FKs (columna → tabla.columna referenciada),
  índices, y si RLS está habilitado.
- **AC3 (policies)**: Given los `CREATE POLICY` de las migraciones, Then cada tabla lista sus
  policies vigentes (nombre, comando SELECT/INSERT/UPDATE/DELETE, resumen del USING/WITH CHECK
  truncado) respetando `DROP POLICY` posteriores.
- **AC4 (verificación de fidelidad)**: Given 3 tablas conocidas elegidas como fixture (`users`,
  `enrollments`, `notifications`), When se compara la salida contra el esquema real de Supabase
  (`npx supabase db dump --schema-only` o inspección manual), Then coinciden columnas y FKs.
- **AC5 (secciones manuales intactas)**: Given contenido manual fuera de los marcadores
  AUTO-GENERATED en DATABASE.md, When se regenera, Then queda byte-idéntico.
- **AC6 (idempotencia + cache)**: Given dos corridas sin migraciones nuevas, Then la segunda
  no re-parsea (cache por mtime del directorio de migraciones) y no cambia el archivo.
- **AC7 (fallo honesto)**: Given una sentencia SQL que el parser no entiende, Then NO se omite
  en silencio: la tabla afectada se marca `⚠ parse parcial — revisar <archivo.sql>` en el
  índice y la corrida lo reporta en consola.

### Edge cases obligatorios

- **AC-E1 (idempotencia SQL)**: Given `CREATE TABLE IF NOT EXISTS` repetido en 2 migraciones,
  Then la tabla aparece una vez con el esquema de la primera + ALTERs posteriores.
- **AC-E2 (funciones y vistas)**: Given `CREATE OR REPLACE FUNCTION` (helpers RLS como
  `branch_visible()`) y `CREATE VIEW v_*`, Then se listan en secciones propias (firma/nombre,
  sin cuerpo completo).
- **AC-E3 (RENAME)**: Given `ALTER TABLE ... RENAME TO / RENAME COLUMN`, Then el estado final
  usa el nombre nuevo.

---

## 4. Out of scope

- ❌ Validar que las migraciones sean correctas o idempotentes (eso es del hook SQL existente).
- ❌ Ejecutar SQL o conectarse a Supabase — parsing estático puro (el dump de AC4 es solo
  verificación de la spec, no dependencia de runtime).
- ❌ Generar diagramas ER.
- ❌ Triggers y grants (documentar como límite conocido si aparecen).

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- `supabase/migrations/` con naming `YYYYMMDDHHMMSS_*.sql` (ordenable lexicográficamente).
- `indices-sync.js` con marcadores AUTO-GENERATED y cache.
- DATABASE.md existente (se le agregan marcadores preservando todo el contenido actual como
  sección manual hasta que la auto-generada demuestre fidelidad).

### Capacidades nuevas requeridas
- Parser SQL: **decisión abierta** — regex estructurado por sentencia (cero dependencias,
  alineado con la preferencia del proyecto) vs. devDependency tipo `pgsql-parser` (AST real,
  más robusto). Ver §9.

---

## 6. Datos y modelo (preliminar)

Modelo interno del colector: `Map<tableName, { columns: Map<name, {type, nullable, default}>,
pk, fks[], indexes[], rlsEnabled, policies: Map<name, {cmd, using, check}> }>` construido por
un reducer que consume sentencias en orden cronológico.

---

## 7. UX y flujos (preliminar)

DATABASE.md: sección manual arriba (diccionario de dominio, notas de negocio) + bloque
AUTO-GENERATED abajo con una subsección por tabla. Rollout: primera versión convive con la
doc manual actual (no se borra nada) hasta validar AC4.

---

## 8. Métricas de éxito post-launch

- Cero discrepancias detectadas entre DATABASE.md y el esquema real en las revisiones.
- El Context Guard valida contra un índice que se regenera solo.

---

## 9. Notas / decisiones abiertas

- [ ] **Parser: ¿regex por sentencia o `pgsql-parser` como devDependency?** La preferencia
  "cero dependencias externas" del proyecto aplica a lo que el cliente administra; una
  devDependency de tooling no lo afecta, pero decide el humano. (Propuesta: empezar con regex
  por sentencia + AC7 de fallo honesto; escalar a pgsql-parser solo si el AC7 dispara seguido.)
- [ ] ¿Se indexan también los seeds (`supabase/seed.sql`) o solo migraciones? (Propuesta: solo
  migraciones — los seeds son datos, no esquema.)

---

## Changelog

- 2026-07-01 — draft inicial por Akxlarre (redactado por Claude a partir del análisis AST de la sesión).
