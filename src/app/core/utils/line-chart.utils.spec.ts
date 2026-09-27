import { describe, expect, it } from 'vitest';
import { buildLinePath, formatCompactNumber, niceMax, pointY, yTicks } from './line-chart.utils';

describe('niceMax', () => {
  it('redondea hacia arriba a un número "limpio"', () => {
    expect(niceMax(6_995_000)).toBe(8_000_000);
    expect(niceMax(123)).toBe(150);
    expect(niceMax(9)).toBe(10);
    expect(niceMax(1)).toBe(1);
  });

  it('serie vacía o en 0 no divide por cero', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });
});

describe('yTicks', () => {
  it('reparte el eje en N tramos iguales desde 0', () => {
    expect(yTicks(8_000_000, 4)).toEqual([0, 2_000_000, 4_000_000, 6_000_000, 8_000_000]);
  });
});

describe('pointY', () => {
  it('0 queda abajo y el máximo arriba (eje invertido de SVG)', () => {
    expect(pointY(0, 100, 200)).toBe(200);
    expect(pointY(100, 100, 200)).toBe(0);
    expect(pointY(50, 100, 200)).toBe(100);
  });
});

describe('buildLinePath', () => {
  it('une los puntos con M/L en columnas equiespaciadas centradas', () => {
    // 2 puntos en ancho 100 → centros en 25 y 75
    expect(buildLinePath([0, 10], 10, 100, 50)).toBe('M25,50 L75,0');
  });

  it('un null corta la línea (meses futuros)', () => {
    expect(buildLinePath([10, null, 10], 10, 90, 10)).toBe('M15,0 M75,0');
  });

  it('todo null → string vacío', () => {
    expect(buildLinePath([null, null], 10, 100, 50)).toBe('');
  });
});

describe('formatCompactNumber', () => {
  it('compacta millones y miles en es-CL', () => {
    expect(formatCompactNumber(6_995_000)).toBe('7M');
    expect(formatCompactNumber(1_250_000)).toBe('1,3M');
    expect(formatCompactNumber(340_000)).toBe('340K');
    expect(formatCompactNumber(12)).toBe('12');
  });

  it('con prefijo de moneda', () => {
    expect(formatCompactNumber(2_000_000, '$')).toBe('$2M');
  });
});
