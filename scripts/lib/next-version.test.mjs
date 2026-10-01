/**
 * Micro-suite de next-version.js (fix-177-b, F1). Sin framework:
 * `node scripts/lib/next-version.test.mjs`. Exit 1 si algún caso falla.
 *
 * Protege el número que "Publicar en producción" le pone a cada versión. Un error acá crea un
 * tag repetido (el push falla) o, peor, uno menor que el publicado (el rollback y el historial de
 * Releases quedan desordenados).
 */
import { nextVersion, latestVersion, parseVersion } from './next-version.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}
function throws(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

const tags = ['v0.1.0', 'v0.1.4', 'v0.1.5', 'v0.1.6'];

check('arreglo sube el patch', nextVersion(tags, 'arreglo') === 'v0.1.7');
check('mejora sube el minor y resetea el patch', nextVersion(tags, 'mejora') === 'v0.2.0');
check('orden semver, no lexicográfico (v0.10.0 > v0.9.0)', nextVersion(['v0.9.0', 'v0.10.0', 'v0.2.0'], 'arreglo') === 'v0.10.1');
check('orden semver en el major (v10.0.0 > v9.9.9)', latestVersion(['v9.9.9', 'v10.0.0']) === 'v10.0.0');
check('ignora tags que no son semver puro', nextVersion([...tags, 'v0.0.0-ace5', 'v9.9.9-rc1', 'release-2', 'v1.2'], 'arreglo') === 'v0.1.7');
check('acepta el orden de entrada desordenado', nextVersion(['v0.1.6', 'v0.1.0', 'v0.1.5'], 'arreglo') === 'v0.1.7');
check('repo sin tags semver → v0.1.0 (arreglo)', nextVersion([], 'arreglo') === 'v0.1.0');
check('repo sin tags semver → v0.1.0 (mejora)', nextVersion(['v0.0.0-x'], 'mejora') === 'v0.1.0');
check('tolera espacios y líneas vacías (salida de git tag)', nextVersion(['', '  v0.1.6  ', '\n'], 'arreglo') === 'v0.1.7');
check('tipo desconocido lanza error', throws(() => nextVersion(tags, 'grande')));
check('latestVersion sin tags → null', latestVersion(['v0.0.0-ace5']) === null);
check('parseVersion rechaza ceros a la izquierda ambiguos', parseVersion('v01.2.3') === null);
check('parseVersion acepta v0.0.0', JSON.stringify(parseVersion('v0.0.0')) === '[0,0,0]');

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
