import { describe, expect, it } from 'vitest';
import {
  baselineKeys,
  countByImpact,
  newSeriousViolations,
  summarizeViolations,
  type A11yViolation,
} from './a11y';

const AXE_RESULT = {
  violations: [
    {
      id: 'color-contrast',
      impact: 'serious',
      nodes: [
        { target: ['.micro-label'] },
        { target: ['.kpi-label'] },
        { target: ['p'] },
        { target: ['span'] },
      ],
    },
    { id: 'region', impact: 'moderate', nodes: [{ target: ['main > div'] }] },
    { id: 'button-name', impact: 'critical', nodes: [{ target: [['iframe', 'button']] }] },
  ],
};

describe('summarizeViolations', () => {
  it('resume regla, impacto, cantidad de nodos y hasta 3 selectores', () => {
    expect(summarizeViolations(AXE_RESULT)).toEqual([
      {
        rule: 'color-contrast',
        impact: 'serious',
        nodes: 4,
        targets: ['.micro-label', '.kpi-label', 'p'],
      },
      { rule: 'region', impact: 'moderate', nodes: 1, targets: ['main > div'] },
      { rule: 'button-name', impact: 'critical', nodes: 1, targets: ['iframe button'] },
    ]);
  });

  it('impacto ausente se trata como "minor"', () => {
    expect(summarizeViolations({ violations: [{ id: 'x', nodes: [] }] })[0].impact).toBe('minor');
  });
});

const VIOLACIONES: A11yViolation[] = summarizeViolations(AXE_RESULT);

describe('baselineKeys', () => {
  it('una clave por tema y regla, sin repetir y ordenadas', () => {
    expect(baselineKeys('dark', [...VIOLACIONES, VIOLACIONES[0]])).toEqual([
      'dark:button-name',
      'dark:color-contrast',
      'dark:region',
    ]);
  });
});

describe('newSeriousViolations', () => {
  it('sin línea base, todas las serious/critical son nuevas', () => {
    expect(newSeriousViolations('light', VIOLACIONES, []).map((v) => v.rule)).toEqual([
      'color-contrast',
      'button-name',
    ]);
  });

  it('las que ya están en la línea base de ese tema no cuentan', () => {
    expect(
      newSeriousViolations('light', VIOLACIONES, ['light:color-contrast']).map((v) => v.rule),
    ).toEqual(['button-name']);
  });

  it('la línea base de otro tema no cubre', () => {
    expect(
      newSeriousViolations('dark', VIOLACIONES, ['light:color-contrast', 'light:button-name']),
    ).toHaveLength(2);
  });

  it('moderate y minor nunca bloquean', () => {
    expect(newSeriousViolations('light', [VIOLACIONES[1]], [])).toEqual([]);
  });
});

describe('countByImpact', () => {
  it('cuenta reglas por impacto', () => {
    expect(countByImpact(VIOLACIONES)).toEqual({ critical: 1, serious: 1, moderate: 1, minor: 0 });
  });
});
