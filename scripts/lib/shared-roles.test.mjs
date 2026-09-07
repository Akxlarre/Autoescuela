/**
 * Micro-suite de shared-roles.js (ARCH-24). Sin framework:
 * `node scripts/lib/shared-roles.test.mjs`. Exit 1 si algún caso falla.
 *
 * Cubre las DOS direcciones a propósito. Un guard que solo se testea por el lado de "bloquea
 * lo malo" termina siendo peor que no tenerlo: el falso positivo que este fix vino a arreglar
 * (LayoutDrawerFacadeService contado como Facade de dominio) habría pasado un test de una
 * sola dirección sin que nadie lo note.
 */
import {
  findSharedRoleViolations,
  findInjectedFacades,
  isSharedComponent,
  normalizeRepoPath,
  loadOrganismAllowlist,
} from './shared-roles.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

const ALLOWLIST = {
  transversalFacades: ['AuthFacade', 'BranchFacade'],
  organisms: {
    'src/app/shared/components/mi-drawer/mi-drawer.component.ts': { facade: 'MiDominioFacade' },
    'src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts': {
      allowTransversal: ['AuthFacade', 'BranchFacade'],
    },
  },
};

const DUMB = 'src/app/shared/components/kpi-card/kpi-card.component.ts';
const ORGANISM = 'src/app/shared/components/mi-drawer/mi-drawer.component.ts';
const AJUSTES = 'src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts';

// ── Alcance ───────────────────────────────────────────────────────────────────
check('shared component está en alcance', isSharedComponent(DUMB));
check(
  'smart component de features/ NO está en alcance',
  !isSharedComponent('src/app/features/admin/alumnos/admin-alumnos.component.ts'),
);
check(
  'facade de core/ NO está en alcance',
  !isSharedComponent('src/app/core/facades/auth.facade.ts'),
);
check(
  'un .ts de shared/ que no es componente NO está en alcance',
  !isSharedComponent('src/app/shared/utils/formatea.ts'),
);
check(
  'normalizeRepoPath convierte absoluto a relativo posix',
  normalizeRepoPath('/repo/src/app/shared/a.component.ts', '/repo') ===
    'src/app/shared/a.component.ts',
);

// ── DEBE BLOQUEAR ─────────────────────────────────────────────────────────────
const dumbConFacade = `
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
export class KpiCardComponent { private f = inject(AdminAlumnosFacade); }`;
const vDumb = findSharedRoleViolations(dumbConFacade, DUMB, ALLOWLIST);
check('Dumb que inyecta un Facade de dominio → violación', vDumb.length === 1);
check('…tipada como dumb-injects-facade', vDumb[0]?.type === 'dumb-injects-facade');
check('…nombra el facade concreto', vDumb[0]?.facade === 'AdminAlumnosFacade');

const organismoTransversal = `
import { MiDominioFacade } from '@core/facades/mi-dominio.facade';
import { BranchFacade } from '@core/facades/branch.facade';
export class MiDrawerComponent {
  private d = inject(MiDominioFacade);
  private b = inject(BranchFacade);
}`;
const vOrg = findSharedRoleViolations(organismoTransversal, ORGANISM, ALLOWLIST);
check('Organismo que inyecta un transversal sin waiver → violación', vOrg.length === 1);
check('…tipada como organism-injects-transversal', vOrg[0]?.type === 'organism-injects-transversal');
check('…señala el transversal, no el de dominio', vOrg[0]?.facade === 'BranchFacade');

// ── DEBE DEJAR PASAR ──────────────────────────────────────────────────────────
const dumbPuro = `
export class KpiCardComponent { valor = input.required<number>(); }`;
check('Dumb sin inyecciones → sin violación', findSharedRoleViolations(dumbPuro, DUMB, ALLOWLIST).length === 0);

const soloDrawerService = `
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
export class AlumnosListContentComponent { private d = inject(LayoutDrawerFacadeService); }`;
check(
  'LayoutDrawerFacadeService (services/ui/) NO cuenta como Facade de dominio',
  findSharedRoleViolations(soloDrawerService, DUMB, ALLOWLIST).length === 0,
);
check(
  '…y findInjectedFacades tampoco lo lista',
  findInjectedFacades(soloDrawerService).length === 0,
);

const organismoOk = `
import { MiDominioFacade } from '@core/facades/mi-dominio.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
export class MiDrawerComponent {
  private f = inject(MiDominioFacade);
  private d = inject(LayoutDrawerFacadeService);
}`;
check(
  'Organismo con su Facade de dominio → sin violación',
  findSharedRoleViolations(organismoOk, ORGANISM, ALLOWLIST).length === 0,
);

const ajustes = `
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
export class AjustesDrawerComponent {
  protected readonly auth = inject(AuthFacade);
  private branch = inject(BranchFacade);
}`;
check(
  'Organismo con waiver explícito de transversales → sin violación',
  findSharedRoleViolations(ajustes, AJUSTES, ALLOWLIST).length === 0,
);

check(
  'Smart component de features/ con Facade → fuera de alcance, sin violación',
  findSharedRoleViolations(dumbConFacade, 'src/app/features/admin/x.component.ts', ALLOWLIST)
    .length === 0,
);

// ── Fail-closed del allowlist ────────────────────────────────────────────────
const vacio = loadOrganismAllowlist('/ruta/que/no/existe.json');
check('allowlist ausente → sin organismos (fail-closed, no fail-open)', Object.keys(vacio.organisms).length === 0);
check('…pero conserva los transversales por defecto', vacio.transversalFacades.includes('AuthFacade'));

// ── El allowlist REAL del repo describe el código REAL ───────────────────────
// Si alguien agrega un organismo al allowlist con un path mal escrito, el guard lo trataría
// como Dumb sin avisar. Este caso ata el archivo de gobierno al filesystem.
import fs from 'fs';
const real = loadOrganismAllowlist();
const rutasInexistentes = Object.keys(real.organisms).filter((p) => !fs.existsSync(p));
check(
  `todos los organismos del allowlist existen en disco${rutasInexistentes.length ? ` (faltan: ${rutasInexistentes.join(', ')})` : ''}`,
  rutasInexistentes.length === 0,
);

if (failures > 0) {
  console.error(`\n❌ ${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\n✅ shared-roles: todos los casos pasan.');
