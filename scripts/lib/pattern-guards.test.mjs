/**
 * Micro-suite de pattern-guards.js. Sin framework: `node scripts/lib/pattern-guards.test.mjs`
 * Exit 1 si algún caso falla.
 */
import {
  classifyDebt,
  componentNames,
  hasGridWithoutFillScreen,
  isBranchScopedWithoutGuard,
  isInRegistry,
  nextDebt,
  stripComments,
  swrGaps,
} from './pattern-guards.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── stripComments ───────────────────────────────────────────────────────────────────────────
check('quita comentario de línea', !stripComments('a(); // createRequestGuard()').includes('Guard'));
check('quita comentario de bloque', !stripComments('/* _initialized */ x').includes('_init'));
check('quita comentario HTML', !stripComments('<!-- bento-grid --><p></p>').includes('bento'));
check('no corta una URL dentro de un string', stripComments("u = 'https://a.cl/x';").includes('a.cl/x'));

// ── ARCH-39 ─────────────────────────────────────────────────────────────────────────────────
const SCOPED = 'const b = this.branchFacade.selectedBranchId();\nthis._data.set(rows);';
check('lee la sede y no tiene guard → falta', isBranchScopedWithoutGuard(SCOPED));
check(
  'lee la sede y crea el guard → cumple',
  !isBranchScopedWithoutGuard(`private g = createRequestGuard();\n${SCOPED}`),
);
check('no lee la sede → no aplica', !isBranchScopedWithoutGuard('this._data.set(rows);'));
check(
  'el guard nombrado solo en un comentario no cuenta',
  isBranchScopedWithoutGuard(`// pendiente: createRequestGuard()\n${SCOPED}`),
);
check(
  'la sede nombrada solo en un comentario no vuelve branch-scoped al Facade',
  !isBranchScopedWithoutGuard('// no usa selectedBranchId()\nthis._data.set(rows);'),
);

// ── ARCH-40 ─────────────────────────────────────────────────────────────────────────────────
check('sin initialize() → no aplica', same(swrGaps('async cargar(): Promise<void> {}'), []));
check(
  'initialize() con las dos piezas → cumple',
  same(
    swrGaps(
      '  private _initialized = false;\n  async initialize() { void this.refreshSilently(); }\n  private async refreshSilently() {}',
    ),
    [],
  ),
);
check(
  'initialize() sin bandera → falta _initialized',
  same(swrGaps('  async initialize() { await this.refreshSilently(); }'), ['_initialized']),
);
check(
  'initialize() sin refresco silencioso → falta refreshSilently',
  same(swrGaps('  private _initialized = false;\n  initialize(): void {}'), ['refreshSilently']),
);
check(
  'una llamada a otro initialize() no es una declaración',
  same(swrGaps('  ngOnInit() { this.facade.initialize(); }'), []),
);
check(
  'public async initialize( cuenta como declaración',
  swrGaps('  public async initialize(): Promise<void> {}').length === 2,
);

// ── ARCH-41 ─────────────────────────────────────────────────────────────────────────────────
check(
  'grilla sin modificador → falta',
  hasGridWithoutFillScreen('<div class="bento-grid" appBentoGridLayout></div>'),
);
check(
  'grilla con --fill-screen-kpi → cumple',
  !hasGridWithoutFillScreen('<div class="bento-grid bento-grid--fill-screen-kpi"></div>'),
);
check('sin grilla → no aplica', !hasGridWithoutFillScreen('<div class="card p-4"></div>'));
check(
  'bento-grid-algo no es la grilla raíz',
  !hasGridWithoutFillScreen('<div class="bento-grid-inner"></div>'),
);
check(
  'dos grillas, una con modificador → cumple (la otra es interna)',
  !hasGridWithoutFillScreen(
    '<div class="bento-grid bento-grid--fill-screen"><div class="bento-grid"></div></div>',
  ),
);

check(
  'nombres de un componente .ts',
  same(componentNames('src/app/features/x/mi-pagina.component.ts'), ['mi-pagina', 'MiPaginaComponent']),
);
check(
  'nombres de un template .html',
  same(componentNames('a/instructor-clase-detail.component.html'), [
    'instructor-clase-detail',
    'InstructorClaseDetailComponent',
  ]),
);
check('el registro lo cita por clase', isInRegistry('a/mi-pagina.component.ts', '| `MiPaginaComponent` |'));
check('el registro lo cita por archivo', isInRegistry('a/mi-pagina.component.ts', 'ver mi-pagina (shared)'));
check(
  'un nombre más largo que lo contiene no cuenta',
  !isInRegistry('a/clase.component.ts', '| `instructor-clase-detail` | `InstructorClaseComponent` |'),
);

// ── Deuda conocida ──────────────────────────────────────────────────────────────────────────
{
  const { fresh, resolved } = classifyDebt(['a.ts', 'c.ts'], ['a.ts', 'b.ts']);
  check('un caso fuera de la lista es nuevo', same(fresh, ['c.ts']));
  check('una entrada que ya cumple queda como resuelta', same(resolved, ['b.ts']));
}
check('la primera vez se registra el estado actual', same(nextDebt(['b.ts', 'a.ts'], undefined), ['a.ts', 'b.ts']));
check('consolidar quita lo resuelto', same(nextDebt(['a.ts'], ['a.ts', 'b.ts']), ['a.ts']));
check('consolidar nunca agrega un caso nuevo', same(nextDebt(['a.ts', 'z.ts'], ['a.ts']), ['a.ts']));

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
