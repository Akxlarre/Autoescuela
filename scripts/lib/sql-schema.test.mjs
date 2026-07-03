/**
 * Micro-suite de sql-schema.js (spec 0022): `node scripts/lib/sql-schema.test.mjs`
 */
import { splitStatements, applyStatement } from './sql-schema.js';

let failures = 0;
const check = (label, cond, detail = '') => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FALLO ${label} ${detail}`); failures++; }
};

const SQL = `
-- comentario que se ignora
CREATE TABLE IF NOT EXISTS demo (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name TEXT UNIQUE,
  amount NUMERIC(10,2) DEFAULT 0,
  old_col TEXT,
  drop_me TEXT,
  status TEXT DEFAULT 'pending' -- comentario inline
);

CREATE TABLE IF NOT EXISTS demo (
  id SERIAL PRIMARY KEY,
  esta_definicion_no_gana TEXT
);

COMMENT ON TABLE demo IS 'Tabla de demostración; con punto y coma interno';

ALTER TABLE demo ADD COLUMN IF NOT EXISTS extra BOOLEAN DEFAULT false;
ALTER TABLE demo DROP COLUMN drop_me;
ALTER TABLE demo RENAME COLUMN old_col TO new_col;
ALTER TABLE demo ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo ALTER COLUMN amount SET DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_demo_user ON demo(user_id);

CREATE POLICY "select_demo" ON demo FOR SELECT USING (user_id = auth_user_id());
CREATE POLICY "delete_demo" ON demo FOR DELETE USING (true);
DROP POLICY IF EXISTS "delete_demo" ON demo;

CREATE OR REPLACE FUNCTION demo_helper(p_id INT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN true; -- el ; interno no debe romper el split
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW v_demo AS SELECT * FROM demo;

CREATE TABLE IF NOT EXISTS borrar (id SERIAL PRIMARY KEY);
DROP TABLE IF EXISTS borrar;

CREATE TABLE IF NOT EXISTS renombrar (id SERIAL PRIMARY KEY);
ALTER TABLE renombrar RENAME TO renombrada;

INSERT INTO demo (name) VALUES ('seed que se ignora');

CREATE COLLATION rara (locale = 'es_CL');
`;

const state = { tables: new Map(), views: new Map(), functions: new Map(), warnings: [] };
const stmts = splitStatements(SQL);
for (const stmt of stmts) applyStatement(state, stmt, 'test.sql');

const demo = state.tables.get('demo');
check('tabla demo existe', !!demo);
check('idempotencia: primera definición gana (AC-E1)', demo.columns.has('name') && !demo.columns.has('esta_definicion_no_gana'));
check('PK detectada', demo.columns.get('id')?.pk === true);
check('FK inline', demo.columns.get('user_id')?.fk?.table === 'users');
check('NOT NULL', demo.columns.get('user_id')?.notNull === true);
check('tipo con precisión', demo.columns.get('amount')?.type === 'NUMERIC(10,2)');
check('ADD COLUMN', demo.columns.has('extra'));
check('DROP COLUMN', !demo.columns.has('drop_me'));
check('RENAME COLUMN', !demo.columns.has('old_col') && demo.columns.has('new_col'));
check('ENABLE RLS', demo.rls === true);
check('ALTER SET DEFAULT', demo.columns.get('amount')?.default === '100');
check('índice', demo.indexes.has('idx_demo_user'));
check('policy viva', demo.policies.has('select_demo') && demo.policies.get('select_demo').cmd === 'SELECT');
check('DROP POLICY (AC3)', !demo.policies.has('delete_demo'));
check('COMMENT → descripción', demo.description?.includes('demostración'));
check('función con $$ (split no roto)', state.functions.has('demo_helper'));
check('vista', state.views.has('v_demo'));
check('DROP TABLE', !state.tables.has('borrar'));
check('RENAME TO (AC-E3)', !state.tables.has('renombrar') && state.tables.has('renombrada'));
check('seed ignorado sin warning', !state.warnings.some(w => w.includes('INSERT')));
check('AC7: sentencia desconocida → warning', state.warnings.some(w => w.includes('CREATE COLLATION')), JSON.stringify(state.warnings));

if (failures > 0) { console.error(`\n${failures} caso(s) fallidos`); process.exit(1); }
console.log('\n✅ sql-schema: todos los casos pasan');
