import { roundPercentagesTo100 } from './percentage.utils';

describe('roundPercentagesTo100', () => {
  it('siempre suma exactamente 100 (caso 87.5/12.5 que antes daba 101)', () => {
    const result = roundPercentagesTo100([87.5, 12.5]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result).toEqual([88, 12]);
  });

  it('reparte el remanente a las mayores fracciones descartadas en un caso de 3 valores', () => {
    // 40/90, 30/90, 20/90 -> 44.44%, 33.33%, 22.22% -> floors 44+33+22=99, falta 1
    // la mayor fracción descartada es 44.44 (.44), así que se lleva el punto extra
    const result = roundPercentagesTo100([40, 30, 20]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result).toEqual([45, 33, 22]);
  });

  it('devuelve todos 0 si el total es 0', () => {
    expect(roundPercentagesTo100([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('funciona con un solo valor (100%)', () => {
    expect(roundPercentagesTo100([500000])).toEqual([100]);
  });

  it('no rompe con valores que ya redondean exacto a 100', () => {
    expect(roundPercentagesTo100([50, 50])).toEqual([50, 50]);
    expect(roundPercentagesTo100([25, 25, 25, 25])).toEqual([25, 25, 25, 25]);
  });
});
