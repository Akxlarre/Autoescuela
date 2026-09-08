import { describe, it, expect } from 'vitest';
import { moduloPct, getSemaforo, getSemaforoBadgeVariant } from './alumno-profesional-status.utils';

describe('moduloPct()', () => {
  it('calcula el porcentaje redondeado de módulos aprobados', () => {
    expect(moduloPct(3, 7)).toBe(43);
    expect(moduloPct(7, 7)).toBe(100);
    expect(moduloPct(0, 7)).toBe(0);
  });

  it('retorna 0 cuando el total es 0 (evita división por cero)', () => {
    expect(moduloPct(0, 0)).toBe(0);
  });
});

describe('getSemaforo()', () => {
  it('mapea cada flag a su label + severidad', () => {
    expect(getSemaforo('green')).toEqual({ label: 'Al día', severity: 'success' });
    expect(getSemaforo('yellow')).toEqual({ label: 'En riesgo', severity: 'warn' });
    expect(getSemaforo('red')).toEqual({ label: 'Crítico', severity: 'danger' });
  });

  it('retorna "Sin datos" cuando el flag es null', () => {
    expect(getSemaforo(null)).toEqual({ label: 'Sin datos', severity: 'secondary' });
  });
});

describe('getSemaforoBadgeVariant()', () => {
  it('mapea cada flag al variant de app-badge equivalente', () => {
    expect(getSemaforoBadgeVariant('green')).toBe('success');
    expect(getSemaforoBadgeVariant('yellow')).toBe('warning');
    expect(getSemaforoBadgeVariant('red')).toBe('error');
    expect(getSemaforoBadgeVariant(null)).toBe('neutral');
  });
});
