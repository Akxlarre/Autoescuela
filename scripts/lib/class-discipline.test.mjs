/**
 * Micro-suite de class-discipline.js. Sin framework: `node scripts/lib/class-discipline.test.mjs`
 * Exit 1 si algún caso falla.
 */
import {
  findAdhocPills,
  findButtonSizeOverrides,
  findArbitraryTextSizes,
  findAdhocTypography,
  isPillWhitelisted,
  isTypographyWhitelisted,
  buildBaseline,
  compareWithBaseline,
} from './class-discipline.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

// ── ARCH-15: pills ad-hoc ────────────────────────────────────────────────────
check(
  'pill clásico detectado',
  findAdhocPills(`<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">`).length === 1,
);
check(
  'pill con text-[10px] detectado',
  findAdhocPills(`<span class="rounded-full px-2 py-0.5 text-[10px] uppercase">`).length === 1,
);
check(
  'pill con text-[11px] detectado',
  findAdhocPills(`<span class="px-2.5 rounded-full text-[11px]">`).length === 1,
);
check(
  'avatar (w-8 h-8, sin px-) NO marcado',
  findAdhocPills(`<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">`).length === 0,
);
check(
  'círculo fijo w-6 h-6 con px- NO marcado (dot/avatar)',
  findAdhocPills(`<div class="w-6 h-6 px-1 rounded-full text-xs">`).length === 0,
);
check(
  'dot decorativo (solo rounded-full) NO marcado',
  findAdhocPills(`<span class="inline-block rounded-full bg-brand">`).length === 0,
);
check(
  'texto normal con rounded-full y px NO marcado (text-sm no es micro)',
  findAdhocPills(`<a class="rounded-full px-4 py-2 text-sm">`).length === 0,
);
check(
  'binding dinámico [class] no analizado',
  findAdhocPills(`<span [class]="pillClasses()">`).length === 0,
);
check('whitelist: components/badge/', isPillWhitelisted('src\\app\\shared\\components\\badge\\badge.component.ts'));
check('whitelist: task-status-badge', isPillWhitelisted('src/app/shared/components/task-status-badge/task-status-badge.component.ts'));
check('no-whitelist: página cualquiera', !isPillWhitelisted('src/app/features/admin/pagos/admin-pagos.component.ts'));

// ── ARCH-15 refinamiento fix-083-b: <button> con (click) NO es una pill ──────
// 3 falsos positivos reales confirmados (asistencia-clase-b-content,
// public-context-banner ×2) antes de este refinamiento.
check(
  '<button> con (click) y forma de pill → NO se marca (es un filtro/toggle)',
  findAdhocPills(
    `<button (click)="toggle()" class="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors">`,
  ).length === 0,
);
check(
  '<span> con la MISMA forma de pill → SÍ se marca (es un badge real)',
  findAdhocPills(
    `<span class="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors">`,
  ).length === 1,
);
check(
  '<button> SIN (click) y forma de pill → SÍ se marca (button decorativo, no filtro)',
  findAdhocPills(
    `<button class="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors">`,
  ).length === 1,
);
check(
  '<div> con (click) [output] y forma de pill → SÍ se marca (la exclusión es solo <button>)',
  findAdhocPills(
    `<div (click)="toggle()" class="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors">`,
  ).length === 1,
);

// ── ARCH-16: overrides de tamaño sobre btn-* ─────────────────────────────────
const o1 = findButtonSizeOverrides(`<button class="btn-primary text-xs px-3 py-1.5">`);
check('btn-primary + text-xs/px/py detectado', o1.length === 1 && o1[0].offenders.length === 3);
check(
  'btn-primary + rounded-xl detectado',
  findButtonSizeOverrides(`<button class="btn-primary rounded-xl shrink-0">`).length === 1,
);
check(
  'btn-danger-ghost + p-1 detectado',
  findButtonSizeOverrides(`<button class="btn-danger-ghost p-1">`).length === 1,
);
check(
  'layout puro permitido (w-full flex gap-2 justify-center h-11)',
  findButtonSizeOverrides(`<button class="btn-primary w-full flex items-center gap-2 justify-center h-11 shrink-0">`).length === 0,
);
check(
  'texto sin btn-* NO marcado',
  findButtonSizeOverrides(`<span class="text-xs px-3 rounded-lg">`).length === 0,
);
check(
  'btn-primary text-[13px] detectado',
  findButtonSizeOverrides(`<button class="btn-primary text-[13px]">`).length === 1,
);

// ── ARCH-17: text-[NNpx] arbitrario ──────────────────────────────────────────
check(
  'text-[10px] y text-[11px] detectados',
  findArbitraryTextSizes(`<p class="text-[10px]"></p><p class="mt-1 text-[11px] uppercase"></p>`).length === 2,
);
check('text-[13px] detectado', findArbitraryTextSizes(`<p class="text-[13px]">`).length === 1);
check('con variante sm:text-[10px] detectado', findArbitraryTextSizes(`<p class="sm:text-[10px]">`).length === 1);
check('escala oficial text-xs NO marcada', findArbitraryTextSizes(`<p class="text-xs text-sm text-base">`).length === 0);
check('text-[15rem] NO marcado (solo px)', findArbitraryTextSizes(`<p class="text-[15rem]">`).length === 0);

// ── Ratchet: baseline y regresiones ──────────────────────────────────────────
const counts = {
  'ARCH-15': new Map([
    ['src/app/a.ts', { count: 2, sample: 'rounded-full px-3 text-xs' }],
    ['src/app/b.ts', { count: 1, sample: 'rounded-full px-2 text-[10px]' }],
  ]),
  'ARCH-16': new Map([['src/app/a.ts', { count: 1, sample: 'btn-primary text-xs' }]]),
  'ARCH-17': new Map(),
};
const baseline = buildBaseline(counts);
check('baseline: total ARCH-15 = 3', baseline.rules['ARCH-15'].total === 3);
check('baseline: total ARCH-17 = 0', baseline.rules['ARCH-17'].total === 0);

// Sin cambios → sin regresiones
const same = compareWithBaseline(counts, baseline);
check('sin cambios → 0 regresiones', same.regressions.length === 0 && !same.improved);

// Un archivo empeora + aparece archivo nuevo
const worse = {
  'ARCH-15': new Map([
    ['src/app/a.ts', { count: 3, sample: 'x' }],
    ['src/app/b.ts', { count: 1, sample: 'y' }],
    ['src/app/nuevo.ts', { count: 1, sample: 'z' }],
  ]),
  'ARCH-16': counts['ARCH-16'],
  'ARCH-17': new Map(),
};
const regr = compareWithBaseline(worse, baseline);
check('regresión detectada en a.ts (2→3) y nuevo.ts (0→1)', regr.regressions.length === 2);

// El backlog baja → improved
const better = {
  'ARCH-15': new Map([['src/app/a.ts', { count: 1, sample: 'x' }]]),
  'ARCH-16': new Map(),
  'ARCH-17': new Map(),
};
const impr = compareWithBaseline(better, baseline);
check('mejora detectada (4→1)', impr.improved && impr.regressions.length === 0);

// Baseline ausente → todo cuenta como regresión (primer run la crea aparte)
const noBase = compareWithBaseline(counts, null);
check('sin baseline → cada archivo con violaciones regresa', noBase.regressions.length === 3);

// ── ARCH-19: clusters tipográficos ad-hoc ────────────────────────────────────
check(
  'overline ad-hoc detectado (xs + semibold + wide)',
  findAdhocTypography(`<p class="text-xs font-semibold uppercase tracking-wide text-text-muted">`)
    .length === 1,
);
check(
  'overline ad-hoc detectado en OTRO orden de clases',
  findAdhocTypography(`<p class="uppercase text-text-muted tracking-widest font-bold text-xs">`)
    .length === 1,
);
check(
  'overline familia text-2xs también entra (deuda conocida de fix-078-b)',
  findAdhocTypography(`<p class="text-2xs font-bold uppercase tracking-wider text-text-muted">`)
    .length === 1,
);
check(
  'ya migrado a .micro-label → NO es violación (idempotencia del ratchet)',
  findAdhocTypography(`<p class="micro-label mb-1">`).length === 0,
);
check(
  'item-title ad-hoc detectado (semibold)',
  findAdhocTypography(`<p class="text-sm font-semibold text-text-primary truncate">`).length === 1,
);
check(
  'item-title ad-hoc detectado (bold)',
  findAdhocTypography(`<p class="font-bold text-sm text-text-primary">`).length === 1,
);
check(
  'ya migrado a .item-title → NO es violación',
  findAdhocTypography(`<p class="item-title truncate">`).length === 0,
);
check(
  'uppercase + primary NO es item-title (es otro rol)',
  findAdhocTypography(`<p class="text-sm font-bold text-text-primary uppercase">`).length === 0,
);
check(
  'text-sm sin peso fuerte NO es item-title',
  findAdhocTypography(`<p class="text-sm text-text-primary">`).length === 0,
);
check(
  'overline sin uppercase NO cuenta',
  findAdhocTypography(`<p class="text-xs font-semibold text-text-muted">`).length === 0,
);
check(
  'archivo de tokens está whitelisted',
  isTypographyWhitelisted('src/styles/tokens/_variables.scss') &&
    !isTypographyWhitelisted('src/app/shared/components/task-card/task-card.component.ts'),
);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallidos`);
  process.exit(1);
}
console.log('\n✅ class-discipline: todos los casos pasan');
