/**
 * Revisión de accesibilidad con axe en el barrido e2e (spec 0054-b, ASG-i-065).
 *
 * Funciones puras para resumir el resultado de axe y compararlo con la línea base. `runAxe`, que
 * corre axe sobre la página, vive en `a11y-run.ts`: axe no se puede importar fuera del navegador.
 * La comparación es por tema + regla, no por selector: los selectores cambian con cualquier ajuste
 * de diseño y la línea base se volvería ruido.
 */
export type A11yImpact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface A11yViolation {
  rule: string;
  impact: A11yImpact;
  /** Elementos afectados. */
  nodes: number;
  /** Hasta 3 selectores de ejemplo. */
  targets: string[];
}

interface AxeLikeResult {
  violations: {
    id: string;
    impact?: string | null;
    nodes: { target: unknown[] }[];
  }[];
}

/** Reglas WCAG 2.0/2.1 nivel A y AA. */
export const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const BLOCKING: ReadonlySet<A11yImpact> = new Set(['critical', 'serious']);

function targetToString(target: unknown): string {
  // Un selector dentro de un iframe/shadow DOM viene como arreglo de selectores.
  return Array.isArray(target) ? target.map(targetToString).join(' ') : String(target);
}

export function summarizeViolations(result: AxeLikeResult): A11yViolation[] {
  return result.violations.map((v) => ({
    rule: v.id,
    impact: (v.impact ?? 'minor') as A11yImpact,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target.map(targetToString).join(' ')),
  }));
}

/** Claves de la línea base: `"<tema>:<regla>"`, sin repetir y ordenadas. */
export function baselineKeys(theme: string, violations: A11yViolation[]): string[] {
  return [...new Set(violations.map((v) => `${theme}:${v.rule}`))].sort();
}

/** Violaciones serious/critical cuya regla no está en la línea base para ese tema. */
export function newSeriousViolations(
  theme: string,
  violations: A11yViolation[],
  baseline: readonly string[],
): A11yViolation[] {
  const known = new Set(baseline);
  return violations.filter((v) => BLOCKING.has(v.impact) && !known.has(`${theme}:${v.rule}`));
}

export function countByImpact(violations: A11yViolation[]): Record<A11yImpact, number> {
  const out: Record<A11yImpact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) out[v.impact]++;
  return out;
}
