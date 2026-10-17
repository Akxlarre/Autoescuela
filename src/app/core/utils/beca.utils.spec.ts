import { esBecaCompleta } from './beca.utils';

describe('esBecaCompleta (fix-057-i)', () => {
  it('sin nada pagado y sin saldo: la beca cubre el curso', () => {
    expect(esBecaCompleta(0, 0)).toBe(true);
  });

  it('con saldo pendiente no es beca completa (aún no paga)', () => {
    expect(esBecaCompleta(0, 180000)).toBe(false);
  });

  it('con pagos hechos no es beca completa (pagó el curso)', () => {
    expect(esBecaCompleta(180000, 0)).toBe(false);
  });

  it('con algún pago registrado no es beca completa, aunque totales den 0', () => {
    expect(esBecaCompleta(0, 0, 1)).toBe(false);
    expect(esBecaCompleta(0, 0, 0)).toBe(true);
  });
});
