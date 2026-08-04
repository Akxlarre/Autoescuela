/**
 * Micro-suite de check-bento-classes.js. Sin framework: `node scripts/lib/bento-classes.test.mjs`
 * Exit 1 si algún caso falla.
 */
import { extractBentoClasses, diffBentoClasses } from '../check-bento-classes.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

check(
  'extrae clases .bento-* de un fragmento SCSS',
  [...extractBentoClasses('.bento-square { } .bento-wide, .bento-2x1 { }')].sort().join(',') ===
    'bento-2x1,bento-square,bento-wide',
);
check(
  'no duplica si la misma clase aparece 2 veces',
  extractBentoClasses('.bento-square {} .bento-square:hover {}').size === 1,
);

const noNew = diffBentoClasses(['bento-square', 'bento-wide'], ['bento-square', 'bento-wide']);
check('sin clases nuevas → newClasses vacío', noNew.newClasses.length === 0);
check('sin clases removidas → removedClasses vacío', noNew.removedClasses.length === 0);

const withNew = diffBentoClasses(
  ['bento-square', 'bento-wide', 'bento-nueva-sin-revisar'],
  ['bento-square', 'bento-wide'],
);
check(
  'clase no revisada se detecta como nueva',
  withNew.newClasses.length === 1 && withNew.newClasses[0] === 'bento-nueva-sin-revisar',
);

const withRemoved = diffBentoClasses(['bento-square'], ['bento-square', 'bento-ya-no-existe']);
check(
  'clase que ya no está en el SCSS se detecta como removida (info, no error)',
  withRemoved.removedClasses.length === 1 && withRemoved.removedClasses[0] === 'bento-ya-no-existe',
);
check('clase removida NO cuenta como nueva', withRemoved.newClasses.length === 0);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallidos`);
  process.exit(1);
}
console.log('\n✅ bento-classes: todos los casos pasan');
