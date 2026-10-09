/**
 * Micro-suite de date-discipline.js. Sin framework: `node scripts/lib/date-discipline.test.mjs`
 * Exit 1 si algún caso falla.
 */
import {
  buildDateBaseline,
  compareDateBaseline,
  findDateViolations,
  findSqlDateViolations,
  fixHint,
  isAllowed,
  isDateDisciplineExempt,
  isSqlAudited,
  validateAllowlist,
} from './date-discipline.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

const FACADE = 'src/app/core/facades/ejemplo.facade.ts';
const COMPONENT = 'src/app/features/ejemplo/ejemplo.component.ts';
const EDGE = 'supabase/functions/ejemplo/index.ts';
const kinds = (content, file = FACADE) => findDateViolations(content, file).map((v) => v.kind);

// ── utc-slice ────────────────────────────────────────────────────────────────
check(
  'toISOString().slice(0, 10) detectado',
  kinds(`const hoy = new Date().toISOString().slice(0, 10);`).includes('utc-slice'),
);
check(
  "toISOString().split('T')[0] detectado",
  kinds(`const hoy = d.toISOString().split('T')[0];`).includes('utc-slice'),
);
check('toISOString() completo (un instante) NO marcado', kinds(`const at = new Date().toISOString();`).length === 0);

// ── naive-time-suffix ────────────────────────────────────────────────────────
check(
  'rango de día sin zona detectado',
  kinds('q.gte("paid_at", `${dia}T00:00:00`).lte("paid_at", `${dia}T23:59:59`)').filter(
    (k) => k === 'naive-time-suffix',
  ).length === 2,
);
check(
  "mediodía local ('T12:00:00') detectado",
  kinds(`const d = new Date(iso + 'T12:00:00');`).includes('naive-time-suffix'),
);
check('hora con offset interpolado NO marcada', kinds('const s = `${dia}T00:00:00${offset}`;').length === 0);
check("hora con Z NO marcada", kinds("const s = `${dia}T00:00:00Z`;").length === 0);

// ── format-no-zone ───────────────────────────────────────────────────────────
check(
  'toLocaleDateString sin timeZone detectado',
  kinds(`d.toLocaleDateString('es-CL', { day: '2-digit' })`).includes('format-no-zone'),
);
check(
  'toLocaleDateString con timeZone NO marcado',
  kinds(`d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit' })`).length === 0,
);
check(
  'Intl.DateTimeFormat sin timeZone detectado',
  kinds(`new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(d)`).includes('format-no-zone'),
);
check(
  'Intl.DateTimeFormat con timeZone en varias líneas NO marcado',
  kinds(`new Intl.DateTimeFormat('es-CL', {\n  month: 'long',\n  timeZone: tz,\n}).format(d)`).length === 0,
);
check("toLocaleString de un número NO marcado", kinds(`total.toLocaleString('es-CL')`).length === 0);
check(
  'toLocaleString con opciones de fecha detectado',
  kinds(`x.toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit' })`).includes('format-no-zone'),
);
check(
  'new Date(x).toLocaleString() detectado',
  kinds(`new Date(row.created_at).toLocaleString('es-CL')`).includes('format-no-zone'),
);

// ── local-date-parts ─────────────────────────────────────────────────────────
check('getFullYear() detectado', kinds(`const y = d.getFullYear();`).includes('local-date-parts'));
check('setDate(getDate() + 1) cuenta dos veces', kinds(`d.setDate(d.getDate() + 1);`).length === 2);
check('getTime() y Date.now() NO marcados', kinds(`const ms = d.getTime() - Date.now();`).length === 0);
check('getUTCDay() NO marcado', kinds(`const w = d.getUTCDay();`).length === 0);

// ── ms-day-diff ──────────────────────────────────────────────────────────────
check(
  'resta de instantes dividida por un día detectada',
  kinds(`const dias = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);`).includes('ms-day-diff'),
);
check(
  'división por (1000 * 60 * 60 * 24) detectada',
  kinds(`const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));`).includes('ms-day-diff'),
);
check('multiplicar por un día (sumar una duración) NO marcado', kinds(`const t = Date.now() - 60 * 86_400_000;`).length === 0);

// ── angular-date-pipe ────────────────────────────────────────────────────────
check(
  'pipe date en template inline detectado',
  kinds("template: `<span>{{ row.createdAt | date: 'dd/MM/yyyy' }}</span>`", COMPONENT).includes(
    'angular-date-pipe',
  ),
);
check(
  'pipe date en .html detectado',
  kinds(`<td>{{ pago.fecha | date }}</td>`, 'src/app/features/x/x.component.html').includes(
    'angular-date-pipe',
  ),
);
check('pipe chileDate NO marcado', kinds('template: `{{ row.createdAt | chileDate }}`', COMPONENT).length === 0);
check('unión de tipos en un facade NO marcada como pipe', kinds(`type X = string | date;`).length === 0);

// ── deprecated-date-api ──────────────────────────────────────────────────────
check('toISODate() detectado', kinds(`const hoy = toISODate(new Date());`).includes('deprecated-date-api'));
check(
  'getChileDateTimeRange() detectado',
  kinds(`const r = getChileDateTimeRange(dia);`).includes('deprecated-date-api'),
);
check(
  'la definición en date.utils.ts NO marcada',
  kinds(`export function toISODate(date: Date | string): string {`, 'src/app/core/utils/date.utils.ts').length === 0,
);

// ── comentarios, exenciones, mensajes ────────────────────────────────────────
check('patrón dentro de un comentario de línea NO marcado', kinds(`// antes: new Date().toISOString().slice(0, 10)`).length === 0);
check('patrón dentro de un comentario de bloque NO marcado', kinds(`/**\n * d.getFullYear()\n */\nconst a = 1;`).length === 0);
check(
  'la línea reportada no se mueve por los comentarios',
  findDateViolations(`/* uno\n dos */\nconst y = d.getFullYear();`, FACADE)[0].line === 3,
);
check('la util de la app está exenta', isDateDisciplineExempt('src/app/core/utils/chile-time.utils.ts'));
check('la util de edge functions está exenta', isDateDisciplineExempt('supabase/functions/_shared/chile-time.ts'));
check('los specs están exentos', isDateDisciplineExempt('src/app/core/facades/x.facade.spec.ts'));
check('un facade cualquiera NO está exento', !isDateDisciplineExempt(FACADE));
check('edge function: toISOString().slice detectado', kinds(`const d = new Date().toISOString().slice(0, 10);`, EDGE).length === 1);
check('el mensaje nombra la util de la app', fixHint('utc-slice', FACADE).includes('core/utils/chile-time.utils.ts'));
check('el mensaje nombra la util de edge functions', fixHint('utc-slice', EDGE).includes('_shared/chile-time.ts'));

// ── ARCH-28: SQL ─────────────────────────────────────────────────────────────
const sqlKinds = (sql) => findSqlDateViolations(sql).map((v) => v.kind);
check('CURRENT_DATE detectado', sqlKinds(`WHERE end_date < CURRENT_DATE;`).includes('current-date'));
check('now()::date detectado', sqlKinds(`SELECT now()::date;`).includes('now-cast-date'));
check('(now())::date detectado', sqlKinds(`SELECT (now())::date;`).includes('now-cast-date'));
check(
  "conversión explícita a Chile NO marcada",
  sqlKinds(`SELECT (now() AT TIME ZONE 'America/Santiago')::date;`).length === 0,
);
check('LOCALTIMESTAMP detectado', sqlKinds(`SELECT LOCALTIMESTAMP;`).includes('local-timestamp'));
check('columna timestamp sin zona detectada', sqlKinds(`ALTER TABLE t ADD COLUMN at TIMESTAMP NOT NULL;`).includes('timestamp-without-zone'));
check('cast ::timestamp detectado', sqlKinds(`SELECT x::timestamp;`).includes('timestamp-without-zone'));
check('timestamptz NO marcado', sqlKinds(`ALTER TABLE t ADD COLUMN at TIMESTAMPTZ;`).length === 0);
check('timestamp with time zone NO marcado', sqlKinds(`ADD COLUMN at timestamp with time zone;`).length === 0);
check('CURRENT_DATE en un comentario SQL NO marcado', sqlKinds(`-- antes usaba CURRENT_DATE\nSELECT 1;`).length === 0);
check('migración anterior al corte NO se audita', !isSqlAudited('20260301000008_08_misc_and_triggers.sql'));
check('la migración del corte NO se audita', !isSqlAudited('20261008120000_time_fn_chile_today.sql'));
check('migración posterior al corte se audita', isSqlAudited('20261008121000_time_fix_business_day_objects.sql'));

// ── allowlist ────────────────────────────────────────────────────────────────
check(
  'allowlist válido no reporta problemas',
  validateAllowlist([{ file: FACADE, kind: 'local-date-parts', reason: 'Mide la duración de una animación, no una fecha.' }]).length === 0,
);
check('allowlist sin justificación reporta problema', validateAllowlist([{ file: FACADE, kind: 'utc-slice', reason: '' }]).length === 1);
check('allowlist con tipo desconocido reporta problema', validateAllowlist([{ file: FACADE, kind: 'otro', reason: 'x'.repeat(30) }]).length === 1);
check('isAllowed exige archivo y tipo', isAllowed([{ file: FACADE, kind: 'utc-slice' }], FACADE, 'utc-slice') && !isAllowed([{ file: FACADE, kind: 'utc-slice' }], FACADE, 'format-no-zone'));

// ── baseline ─────────────────────────────────────────────────────────────────
const counts = new Map([
  [FACADE, { 'utc-slice': { count: 2, sample: 'a' }, 'local-date-parts': { count: 1, sample: 'b' } }],
]);
const baseline = buildDateBaseline(counts);
check('baseline suma por archivo y por tipo', baseline.total === 3 && baseline.kinds['utc-slice'] === 2 && baseline.files[FACADE]['local-date-parts'] === 1);
check('mismo estado: sin regresiones', compareDateBaseline(counts, baseline).regressions.length === 0);
const worse = new Map([[FACADE, { 'utc-slice': { count: 3, sample: 'a' } }]]);
check('un archivo que supera su cuota es regresión', compareDateBaseline(worse, baseline).regressions.length === 1);
const moved = new Map([
  [FACADE, { 'utc-slice': { count: 1, sample: 'a' } }],
  [COMPONENT, { 'utc-slice': { count: 1, sample: 'a' } }],
]);
check('una ocurrencia nueva en otro archivo es regresión aunque el total no suba', compareDateBaseline(moved, baseline).regressions.length === 1);
const better = new Map([[FACADE, { 'utc-slice': { count: 1, sample: 'a' } }]]);
const cmp = compareDateBaseline(better, baseline);
check('backlog menor: mejora sin regresiones', cmp.improved && cmp.regressions.length === 0);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasan.');
