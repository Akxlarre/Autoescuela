/**
 * Tema visual de sede para el flujo público de inscripción (`/inscripcion`).
 *
 * Cada landing Astro (`webs/`) es una empresa distinta con su propia paleta. El wizard
 * Angular hereda esa identidad tematizándose por `branchId` — el tenant que llega en la URL.
 * El mapping es determinista y hardcodeado, espejo del de las webs:
 *   - sede 1 → `azul`
 *   - sede 2 → `roja`
 *
 * Las ramps de color de cada tema viven en `styles/themes/_public-enrollment.scss`
 * (`[data-public-theme="azul"|"roja"]`).
 */
export type SedeTheme = 'azul' | 'roja';

/**
 * Tema usado cuando el `branchId` no se reconoce (ausente o inválido).
 *
 * Es solo un valor seguro para el atributo `[data-public-theme]` del root del wizard:
 * NO implica que el flujo continúe. La decisión de mostrar la pantalla de orientación ante
 * un `branchId` ausente/inválido vive en el Facade (`entryState`), que valida contra las
 * sedes reales cargadas de BD — no contra este mapping de presentación.
 */
export const DEFAULT_SEDE_THEME: SedeTheme = 'azul';

/** Mapping determinista `branchId → SedeTheme`, idéntico al de las landing pages. */
const BRANCH_THEME_MAP: Readonly<Record<number, SedeTheme>> = {
  1: 'azul',
  2: 'roja',
};

/**
 * Devuelve el tema visual de sede para un `branchId`.
 *
 * @param id `branchId` del query param (`null` si no vino en la URL).
 * @returns `'azul'` o `'roja'`. Para `null` o un id desconocido devuelve {@link DEFAULT_SEDE_THEME}.
 */
export function branchIdToTheme(id: number | null): SedeTheme {
  if (id === null) return DEFAULT_SEDE_THEME;
  return BRANCH_THEME_MAP[id] ?? DEFAULT_SEDE_THEME;
}
