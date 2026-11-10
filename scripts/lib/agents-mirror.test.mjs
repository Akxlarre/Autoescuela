/**
 * Micro-suite de agents-mirror.js (ARCH-30). Sin framework:
 * `node scripts/lib/agents-mirror.test.mjs`. Exit 1 si algún caso falla.
 *
 * Cubre las dos direcciones: que detecte cada forma de desfase, y que NO marque como
 * desfasado un espejo correcto (incluido el caso CRLF/LF, que en Windows es lo normal).
 */
import { diffMirror, sameContent, MIRRORS } from './agents-mirror.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

const b = (s) => Buffer.from(s, 'utf8');
const files = (obj) => new Map(Object.entries(obj).map(([k, v]) => [k, b(v)]));

// --- Espejo correcto: nada que reportar ---
{
  const src = files({ 'swr-pattern.md': 'a\nb\n', 'sdd/SKILL.md': 'x' });
  const r = diffMirror(src, files({ 'swr-pattern.md': 'a\nb\n', 'sdd/SKILL.md': 'x' }));
  check(
    'espejo idéntico → sin diferencias',
    !r.missing.length && !r.stale.length && !r.orphan.length,
  );
}

// --- CRLF vs LF en texto no es un desfase ---
check('texto con CRLF vs LF → igual', sameContent('facades.md', b('a\r\nb\r\n'), b('a\nb\n')));

// --- En un binario sí importa cada byte ---
check('binario con CRLF vs LF → distinto', !sameContent('assets/hero.png', b('a\r\nb'), b('a\nb')));

// --- Contenido distinto: stale ---
{
  const r = diffMirror(
    files({ 'swr-pattern.md': 'regla nueva' }),
    files({ 'swr-pattern.md': 'regla vieja' }),
  );
  check(
    'regla cambiada en .claude → stale',
    r.stale.length === 1 && r.stale[0] === 'swr-pattern.md',
  );
}

// --- Archivo nuevo en la fuente: missing ---
{
  const r = diffMirror(files({ 'a.md': '1', 'b.md': '2' }), files({ 'a.md': '1' }));
  check('regla nueva sin copiar → missing', r.missing.length === 1 && r.missing[0] === 'b.md');
}

// --- Archivo borrado en la fuente: orphan ---
{
  const r = diffMirror(files({ 'a.md': '1' }), files({ 'a.md': '1', 'vieja.md': '0' }));
  check('regla borrada en .claude → orphan', r.orphan.length === 1 && r.orphan[0] === 'vieja.md');
}

// --- Los pares cubren reglas y skills ---
check(
  'MIRRORS cubre rules y skills',
  MIRRORS.some((m) => m.source === '.claude/rules' && m.mirror === '.agents/rules') &&
    MIRRORS.some((m) => m.source === '.claude/skills' && m.mirror === '.agents/skills'),
);

if (failures) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nagents-mirror: todos los casos pasan.');
