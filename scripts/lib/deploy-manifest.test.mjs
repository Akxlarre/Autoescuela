/**
 * Micro-suite de deploy-manifest.js (spec 0046-b, AC-E3). Sin framework:
 * `node scripts/lib/deploy-manifest.test.mjs`. Exit 1 si algún caso falla.
 *
 * Lo que se protege: el pipeline FTP solo puede borrar archivos que él mismo subió hace DOS
 * versiones. Borrar antes rompe a quien tiene abierta la versión anterior (sus chunks lazy
 * dejan de existir); borrar algo que no subió el pipeline puede tumbar el SSL de cPanel
 * (`.well-known/`) o la config del sitio (`.htaccess`).
 */
import { planDeploy, MANIFEST_VERSION } from './deploy-manifest.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}
const sorted = (arr) => [...arr].sort();
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
/** El manifiesto nunca registra rutas protegidas: `.htaccess` viaja en el build pero no se lista. */
const tracked = (files) => files.filter((f) => f !== '.htaccess');

const v1 = ['index.html', 'main-AAAAAAAA.js', 'chunk-11111111.js', 'styles-SSSSSSSS.css', '.htaccess'];
const v2 = ['index.html', 'main-BBBBBBBB.js', 'chunk-11111111.js', 'chunk-22222222.js', 'styles-SSSSSSSS.css', '.htaccess'];
const v3 = ['index.html', 'main-CCCCCCCC.js', 'chunk-22222222.js', 'chunk-33333333.js', 'styles-SSSSSSSS.css', '.htaccess'];

// 1er deploy: no hay manifiesto remoto.
{
  const r = planDeploy({ currentFiles: v1, remoteManifest: null });
  check('1er deploy (sin manifiesto) no borra nada', r.toDelete.length === 0);
  check('1er deploy: current = archivos del build (sin protegidos)', same(r.nextManifest.current, tracked(v1)));
  check('1er deploy: previous vacío', r.nextManifest.previous.length === 0);
  check('manifiesto lleva versión de formato', r.nextManifest.version === MANIFEST_VERSION);
}

// 2º deploy: hay gracia de una versión → todavía no borra lo de v1.
const m1 = planDeploy({ currentFiles: v1, remoteManifest: null }).nextManifest;
const r2 = planDeploy({ currentFiles: v2, remoteManifest: m1 });
{
  check('2º deploy no borra nada (gracia de una versión)', r2.toDelete.length === 0);
  check('2º deploy: previous = current anterior', same(r2.nextManifest.previous, tracked(v1)));
}

// 3er deploy: borra solo lo de v1 que ni v3 ni v2 usan.
{
  const r3 = planDeploy({ currentFiles: v3, remoteManifest: r2.nextManifest });
  check('3er deploy borra solo N-2 ∖ (N ∪ N-1)', same(r3.toDelete, ['main-AAAAAAAA.js']));
  check('3er deploy NO borra chunk de v1 que v2 sigue usando', !r3.toDelete.includes('chunk-11111111.js'));
}

// Un archivo que reaparece en N no se borra aunque estuviera en N-2 y no en N-1.
{
  const a = ['index.html', 'chunk-XXXXXXXX.js'];
  const b = ['index.html'];
  const c = ['index.html', 'chunk-XXXXXXXX.js'];
  const mA = planDeploy({ currentFiles: a, remoteManifest: null }).nextManifest;
  const mB = planDeploy({ currentFiles: b, remoteManifest: mA }).nextManifest;
  const rC = planDeploy({ currentFiles: c, remoteManifest: mB });
  check('archivo que reaparece en N no se borra', rC.toDelete.length === 0);
}

// Nunca propone archivos protegidos, aunque aparezcan en un manifiesto viejo.
{
  const protectedPaths = ['.htaccess', '.deploy-manifest.json', 'cgi-bin/x.cgi', '.well-known/acme-challenge/t'];
  const remote = { version: MANIFEST_VERSION, current: ['index.html'], previous: ['index.html', ...protectedPaths] };
  const r = planDeploy({ currentFiles: ['index.html'], remoteManifest: remote });
  check('nunca borra .htaccess / manifiesto / cgi-bin / .well-known', r.toDelete.length === 0);
  check('nunca registra rutas protegidas en el manifiesto nuevo', !r.nextManifest.current.some((p) => protectedPaths.includes(p)));
}

// Falla segura: manifiesto corrupto o de formato desconocido → no borra nada.
{
  const casos = [
    ['string', 'no-soy-json'],
    ['objeto vacío', {}],
    ['versión desconocida', { version: 999, current: ['a.js'], previous: ['b.js'] }],
    ['previous no es array', { version: MANIFEST_VERSION, current: [], previous: 'b.js' }],
    ['rutas con ..', { version: MANIFEST_VERSION, current: [], previous: ['../public_html/index.php'] }],
  ];
  for (const [nombre, remote] of casos) {
    const r = planDeploy({ currentFiles: ['index.html'], remoteManifest: remote });
    check(`manifiesto inválido (${nombre}) → borra 0`, r.toDelete.length === 0);
  }
}

// Rutas normalizadas: separadores de Windows y "./" no generan borrados fantasma.
{
  const remote = { version: MANIFEST_VERSION, current: ['assets/a.png'], previous: ['assets/a.png'] };
  const r = planDeploy({ currentFiles: ['./assets\\a.png'], remoteManifest: remote });
  check('normaliza ./ y \\ al comparar', r.toDelete.length === 0);
}

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
