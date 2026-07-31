import { describe, expect, it } from 'vitest';
import { formatKpiEsCl } from './kpi-es-cl-format.util';

describe('formatKpiEsCl', () => {
  describe('enteros', () => {
    it('deja los enteros chicos tal cual', () => {
      expect(formatKpiEsCl(0)).toBe('0');
      expect(formatKpiEsCl(7)).toBe('7');
      expect(formatKpiEsCl(999)).toBe('999');
    });

    it('aplica separador de miles es-CL (punto, no coma)', () => {
      expect(formatKpiEsCl(1240)).toBe('1.240');
      expect(formatKpiEsCl(1000000)).toBe('1.000.000');
    });

    it('no agrega decimales a un entero', () => {
      expect(formatKpiEsCl(5)).not.toContain(',');
    });
  });

  describe('decimales', () => {
    it('usa coma decimal es-CL', () => {
      expect(formatKpiEsCl(0.8)).toBe('0,8');
      expect(formatKpiEsCl(12.5)).toBe('12,5');
    });

    it('trunca a 1 decimal (misma regla que animateCounter)', () => {
      expect(formatKpiEsCl(3.14159)).toBe('3,1');
    });

    it('combina separador de miles y coma decimal', () => {
      expect(formatKpiEsCl(1234.5)).toBe('1.234,5');
    });
  });

  describe('negativos', () => {
    it('conserva el signo', () => {
      expect(formatKpiEsCl(-42)).toBe('-42');
      expect(formatKpiEsCl(-0.5)).toBe('-0,5');
    });
  });

  describe('valores no finitos', () => {
    // Un KPI que divide por cero (ej: promedio sin muestras) no debe pintar
    // "NaN" ni "∞" en la barra del hero.
    it('devuelve el guion largo en vez de NaN/Infinity', () => {
      expect(formatKpiEsCl(NaN)).toBe('—');
      expect(formatKpiEsCl(Infinity)).toBe('—');
      expect(formatKpiEsCl(-Infinity)).toBe('—');
    });
  });
});
