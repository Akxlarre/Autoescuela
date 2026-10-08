#!/usr/bin/env node
/**
 * Corre los tests sensibles a fechas con el proceso en distintas zonas horarias.
 *
 * Un test que pasa en America/Santiago y falla en UTC o Asia/Tokyo delata código que
 * depende del reloj del equipo en vez de pasar por core/utils/chile-time.utils.ts.
 *
 * Uso:
 *   node scripts/test-tz.mjs                 → specs por defecto
 *   node scripts/test-tz.mjs <spec> [<spec>] → specs indicados
 */
import { spawnSync } from 'node:child_process';

const ZONES = ['UTC', 'Asia/Tokyo', 'America/Santiago'];

const DEFAULT_SPECS = [
  'src/app/core/utils/chile-time.utils.spec.ts',
  'src/app/core/utils/date.utils.spec.ts',
];

const specs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_SPECS;
const failed = [];

for (const zone of ZONES) {
  const env = { ...process.env, TZ: zone };

  // Sin esto, una plataforma que ignore TZ haría pasar todo en la zona del equipo.
  const probe = spawnSync(
    process.execPath,
    ['-e', 'process.stdout.write(Intl.DateTimeFormat().resolvedOptions().timeZone)'],
    { env, encoding: 'utf8' },
  );
  const effective = (probe.stdout || '').trim();
  if (effective !== zone) {
    console.error(`✖ TZ=${zone} no surtió efecto (el proceso quedó en "${effective}").`);
    failed.push(zone);
    continue;
  }

  console.log(`\n=== TZ=${zone} ===`);
  const run = spawnSync('npx', ['vitest', 'run', ...specs], { env, stdio: 'inherit', shell: true });
  if (run.status !== 0) failed.push(zone);
}

if (failed.length > 0) {
  console.error(`\n✖ Fallaron las zonas: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\n✔ ${specs.length} spec(s) en verde en ${ZONES.join(', ')}`);
