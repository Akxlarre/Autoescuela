import { PRIMERA_CLASE_CON_SEGUNDO_PAGO, resolverEstadoPagoClase } from './estado-pago-clase.utils';

/**
 * Spec 0010-i — misma regla que el trigger block_class_b_without_second_payment:
 * la clase 7+ con saldo > 0 se bloquea salvo habilitación sin pago.
 */
describe('resolverEstadoPagoClase', () => {
  it('la primera clase que exige el segundo pago es la 7', () => {
    expect(PRIMERA_CLASE_CON_SEGUNDO_PAGO).toBe(7);
  });

  it('clases 1–6 siempre libres aunque haya deuda (AC2)', () => {
    for (const n of [1, 6]) {
      expect(resolverEstadoPagoClase(n, 180000, false)).toEqual({ estado: 'libre', saldo: 180000 });
    }
  });

  it('clase 7 con deuda y sin habilitación → bloqueada (AC1/AC3)', () => {
    expect(resolverEstadoPagoClase(7, 180000, false)).toEqual({
      estado: 'bloqueada',
      saldo: 180000,
    });
  });

  it('clase 12 con deuda y sin habilitación → bloqueada', () => {
    expect(resolverEstadoPagoClase(12, 1, false).estado).toBe('bloqueada');
  });

  it('clase 7+ con deuda pero habilitada → habilitada_sin_pago (AC5/AC10)', () => {
    expect(resolverEstadoPagoClase(9, 90000, true)).toEqual({
      estado: 'habilitada_sin_pago',
      saldo: 90000,
    });
  });

  it('clase 7+ sin deuda → libre, esté o no habilitada (AC4)', () => {
    expect(resolverEstadoPagoClase(7, 0, false).estado).toBe('libre');
    expect(resolverEstadoPagoClase(7, 0, true).estado).toBe('libre');
  });

  it('saldo negativo o nulo se trata como sin deuda', () => {
    expect(resolverEstadoPagoClase(8, -500, false)).toEqual({ estado: 'libre', saldo: 0 });
    expect(resolverEstadoPagoClase(8, null, false)).toEqual({ estado: 'libre', saldo: 0 });
  });

  it('clase sin número (slot sin alumno) → libre', () => {
    expect(resolverEstadoPagoClase(null, 180000, false).estado).toBe('libre');
  });
});
