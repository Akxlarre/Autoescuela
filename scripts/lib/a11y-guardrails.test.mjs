/**
 * Micro-suite de a11y-guardrails.js. Sin framework: `node scripts/lib/a11y-guardrails.test.mjs`
 * Exit 1 si algún caso falla.
 */
import { findIconOnlyButtonsWithoutLabel } from './a11y-guardrails.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

// ── Casos que SÍ deben marcarse ───────────────────────────────────────────────
check(
  'icon-only sin nada detectado',
  findIconOnlyButtonsWithoutLabel(
    `<button (click)="x()"><app-icon name="trash-2" [size]="14" /></button>`,
  ).length === 1,
);
check(
  'icon-only con ícono dinámico también se marca',
  findIconOnlyButtonsWithoutLabel(
    `<button (click)="x()"><app-icon [name]="iconVar" [size]="14" /></button>`,
  ).length === 1,
);
check(
  'icon-only con texto vacío entre tags igual se marca',
  findIconOnlyButtonsWithoutLabel(
    `<button (click)="x()">  <app-icon name="x" />  </button>`,
  ).length === 1,
);

// ── Casos que NO deben marcarse (ya accesibles) ───────────────────────────────
check(
  'con aria-label → no cuenta',
  findIconOnlyButtonsWithoutLabel(
    `<button aria-label="Eliminar" (click)="x()"><app-icon name="trash-2" /></button>`,
  ).length === 0,
);
check(
  'con [title] dinámico → no cuenta',
  findIconOnlyButtonsWithoutLabel(
    `<button [title]="iconName"><app-icon [name]="iconName" /></button>`,
  ).length === 0,
);
check(
  'con title= literal → no cuenta',
  findIconOnlyButtonsWithoutLabel(
    `<button title="Cerrar"><app-icon name="x" /></button>`,
  ).length === 0,
);
check(
  'con pButton label= (PrimeNG) → no cuenta (falso positivo conocido, fix-079-b)',
  findIconOnlyButtonsWithoutLabel(
    `<button pButton label="Registrar Servicio"><app-icon name="plus" class="mr-2" /></button>`,
  ).length === 0,
);
check(
  'con texto visible entre tags → no cuenta (no es icon-only)',
  findIconOnlyButtonsWithoutLabel(
    `<button (click)="x()"><app-icon name="plus" /> Agregar</button>`,
  ).length === 0,
);
check(
  'con interpolación como contenido → no cuenta',
  findIconOnlyButtonsWithoutLabel(
    `<button (click)="x()"><app-icon name="check" /> {{ label() }}</button>`,
  ).length === 0,
);
check(
  'botón sin <app-icon> → no cuenta (fuera de alcance de esta regla)',
  findIconOnlyButtonsWithoutLabel(`<button (click)="x()"></button>`).length === 0,
);

// ── Regresión: @if/@else con condición que tiene sus propios paréntesis ──────
// Bug real (fix-079-b): `isGeneratingFicha()` dentro de la condición del @if rompía
// el strip de control-flow con `[^)]*` (paraba en el primer `)`, nunca llegaba al que
// cierra la condición completa) → el botón colaba sin aria-label. 2 instancias reales
// en producción (alumnos-list-content.component.ts:480,630) antes del fix.
check(
  '@if/@else con función en la condición: ambas ramas solo ícono → SÍ se marca',
  findIconOnlyButtonsWithoutLabel(
    `<button pTooltip="Exportar Ficha PDF" [disabled]="isGeneratingFicha() === alumno.id" (click)="exportar(alumno)">
       @if (isGeneratingFicha() === alumno.id) {
         <app-icon name="loader-circle" class="animate-spin" />
       } @else {
         <app-icon name="download" />
       }
     </button>`,
  ).length === 1,
);
check(
  '@if/@else donde UNA rama tiene texto real → NO se marca (no es icon-only)',
  findIconOnlyButtonsWithoutLabel(
    `<button (click)="guardar(item.id)">
       @if (isSaving()) {
         <app-icon name="loader-circle" class="animate-spin" />
         Guardando...
       } @else {
         Guardar
       }
     </button>`,
  ).length === 0,
);

// ── Múltiples botones en el mismo archivo ─────────────────────────────────────
check(
  'cuenta cada botón icon-only por separado',
  findIconOnlyButtonsWithoutLabel(
    `<button (click)="a()"><app-icon name="x" /></button>
     <button aria-label="ok"><app-icon name="check" /></button>
     <button (click)="b()"><app-icon name="trash-2" /></button>`,
  ).length === 2,
);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallidos`);
  process.exit(1);
}
console.log('\n✅ a11y-guardrails: todos los casos pasan');
