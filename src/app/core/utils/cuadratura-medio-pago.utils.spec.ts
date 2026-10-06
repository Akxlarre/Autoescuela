import { medioDePagoLabel } from './cuadratura-medio-pago.utils';

const fila = (claseB = 0, claseA = 0, sence = 0, otros = 0) => ({ claseB, claseA, sence, otros });

describe('medioDePagoLabel (fix-192-b)', () => {
  it('un solo medio → su nombre', () => {
    expect(medioDePagoLabel(fila(50000))).toBe('Efectivo');
    expect(medioDePagoLabel(fila(0, 50000))).toBe('Transf.');
    expect(medioDePagoLabel(fila(0, 0, 50000))).toBe('Voucher');
    expect(medioDePagoLabel(fila(0, 0, 0, 50000))).toBe('Tarjeta');
  });

  it('más de un medio → "Mixto"', () => {
    expect(medioDePagoLabel(fila(20000, 30000))).toBe('Mixto');
  });

  it('ningún monto → "—"', () => {
    expect(medioDePagoLabel(fila())).toBe('—');
  });
});
