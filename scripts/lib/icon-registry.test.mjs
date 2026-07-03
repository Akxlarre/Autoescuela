/**
 * Micro-suite de icon-registry.js (spec 0020): `node scripts/lib/icon-registry.test.mjs`
 */
import { createRequire } from 'module';
import { kebabToPascal, collectUsedIcons, parseRegisteredIcons } from './icon-registry.js';

const require = createRequire(import.meta.url);
const ts = require('typescript');

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`ok    ${label}`);
  else { console.error(`FALLO ${label}: esperado ${e}, obtuvo ${a}`); failures++; }
};

// kebab → Pascal
check('kebabToPascal simple', kebabToPascal('trending-up'), 'TrendingUp');
check('kebabToPascal dígito', kebabToPascal('trash-2'), 'Trash2');
check('kebabToPascal ccw', kebabToPascal('rotate-ccw'), 'RotateCcw');
check('kebabToPascal single', kebabToPascal('menu'), 'Menu');

// Estáticos, multi-línea y ternarios
const tpl = `
  <app-icon name="radio" [size]="16" class="text-error" />
  <lucide-icon name="car"></lucide-icon>
  <app-icon
    [name]="cls.status === 'completed' ? 'chevron-right' : 'play'"
    [size]="14" />
  <app-icon [name]="item.icon" />
  <input name="email" />
`;
const used = collectUsedIcons(tpl);
check('statics de tags', used.statics, ['radio', 'car']);
check('ternario resoluble (sin literal de condición)', used.ternaryLiterals, ['chevron-right', 'play']);
check('binding opaco cuenta como dinámico', used.dynamicCount, 1);

// Configs TS
const cfg = `const menu = [{ icon: 'layout-dashboard', label: 'Inicio' }, { icon: 'pi-times' }];`;
check('icon: config TS (excluye pi-*)', collectUsedIcons(cfg).statics, ['layout-dashboard']);

// pick() con shorthand y alias
const appCfg = `
  import { LucideAngularModule, ArrowLeft, AlertCircle } from 'lucide-angular';
  export const appConfig = {
    providers: [
      importProvidersFrom(
        LucideAngularModule.pick({
          ArrowLeft,
          CircleAlert: AlertCircle,
        }),
      ),
    ],
  };
`;
const reg = parseRegisteredIcons(appCfg, ts);
check('pick shorthand', reg.has('ArrowLeft'), true);
check('pick alias cuenta la CLAVE', reg.has('CircleAlert'), true);
check('pick alias no cuenta el valor', reg.has('AlertCircle'), false);

if (failures > 0) { console.error(`\n${failures} caso(s) fallidos`); process.exit(1); }
console.log('\n✅ icon-registry: todos los casos pasan');
