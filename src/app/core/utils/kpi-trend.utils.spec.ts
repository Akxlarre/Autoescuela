import { describe, expect, it } from 'vitest';
import { formatTrendDisplay, kpiTrendColor, trendView } from './kpi-trend.utils';

describe('trendView', () => {
  it('combina color, ícono y texto', () => {
    expect(trendView(-3, '%', true)).toEqual({
      color: 'var(--state-success)',
      icon: 'trending-down',
      text: '3%',
    });
    expect(trendView(12, '%')).toEqual({
      color: 'var(--state-success)',
      icon: 'trending-up',
      text: '+12%',
    });
  });
});

describe('kpiTrendColor', () => {
  it('por defecto subir es success y bajar es error', () => {
    expect(kpiTrendColor(5)).toBe('var(--state-success)');
    expect(kpiTrendColor(0)).toBe('var(--state-success)');
    expect(kpiTrendColor(-5)).toBe('var(--state-error)');
  });

  it('invertido (ej. gastos): subir es error y bajar es success', () => {
    expect(kpiTrendColor(5, true)).toBe('var(--state-error)');
    expect(kpiTrendColor(-5, true)).toBe('var(--state-success)');
  });

  it('variación 0 invertida sigue siendo neutra-positiva', () => {
    expect(kpiTrendColor(0, true)).toBe('var(--state-success)');
  });
});

describe('formatTrendDisplay', () => {
  it('agrega "+" a los positivos; los negativos sin signo (la flecha da la dirección)', () => {
    expect(formatTrendDisplay(12, '%')).toBe('+12%');
    expect(formatTrendDisplay(-3, '%')).toBe('3%');
  });

  it('un decimal si no es entero', () => {
    expect(formatTrendDisplay(14.7, '%')).toBe('+14.7%');
    expect(formatTrendDisplay(-0.25, '%')).toBe('0.3%');
  });
});
