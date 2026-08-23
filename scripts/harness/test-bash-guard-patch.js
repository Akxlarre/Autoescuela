#!/usr/bin/env node
/**
 * test-bash-guard-patch.js — Regresión del parche de `bash-guard.js` (ASG-b-097).
 *
 * Verifica las DOS direcciones. Un guard "arreglado" que deje pasar escrituras reales de
 * fuente es PEOR que el falso positivo que corrige, así que no alcanza con probar que lo que
 * antes fallaba ahora pasa: hay que probar que lo que debe bloquearse sigue bloqueado.
 *
 * Uso (contra el hook vigente, o contra una copia antes de aplicar el parche):
 *   node scripts/harness/test-bash-guard-patch.js .claude/hooks/bash-guard.js
 *
 * Resultado esperado:
 *   - hook SIN parchear  → 5 pass · 2 fail  (los 2 falsos positivos se reproducen)
 *   - hook parcheado     → 7 pass · 0 fail
 *
 * Los comandos de prueba se arman por concatenación a propósito: si este archivo contuviera
 * literalmente el patrón que el guard busca, el propio guard bloquearía su escritura.
 */
import { spawnSync } from 'child_process';

const HOOK = process.argv[2];
if (!HOOK) {
  console.error('Uso: node scripts/harness/test-bash-guard-patch.js <ruta a bash-guard.js>');
  process.exit(1);
}

const SRC = 'src/' + 'app/';

/** [descripción, comando, exitEsperado] — 2 = bloqueado, 0 = permitido */
const cases = [
  [
    'BLOQUEAR: escribir un componente por Bash',
    'echo "export class X {}" ' + '>' + ' ' + SRC + 'features/x/x.component.ts',
    2,
  ],
  ['BLOQUEAR: cat redirigido a un componente', 'cat tpl ' + '>' + ' ' + SRC + 'shared/y.component.html', 2],
  ['BLOQUEAR: append a un scss de fuente', 'printf "a" ' + '>>' + ' ' + SRC + 'styles/z.component.scss', 2],
  ['BLOQUEAR: tee a un componente', 'echo x | tee ' + SRC + 'features/a/a.component.ts', 2],
  [
    'PERMITIR (era falso positivo): tsc con redirect + vitest sobre specs',
    'npx tsc --noEmit -p tsconfig.app.json ' + '>' + '/dev/null 2' + '>' + '&1; npx vitest run ' +
      SRC + 'core/utils/period-window.utils.spec.ts',
    0,
  ],
  [
    'PERMITIR (era falso positivo): tsc 2>&1 | head y luego grep sobre un componente',
    'npx tsc --noEmit 2' + '>' + '&1 | head -5; grep -n "filtroAnio" ' + SRC +
      'features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts',
    0,
  ],
  ['PERMITIR: solo leer un componente', 'grep -n "input(" ' + SRC + 'shared/components/icon/icon.component.ts', 0],
];

let ok = 0;
let fail = 0;

for (const [desc, command, expected] of cases) {
  const res = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
  });
  const got = res.status;
  const pass = got === expected;
  pass ? ok++ : fail++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${got === 2 ? 'bloqueado' : 'permitido'}]  ${desc}`);
  if (!pass) console.log(`        esperado exit ${expected}, obtenido ${got}`);
}

console.log(`\n${ok} pass · ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
