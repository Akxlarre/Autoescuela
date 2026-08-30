import { describe, expect, it } from 'vitest';
import { buildCuadraturaHeroKpis } from './cuadratura-hero-kpis.utils';
import { formatCLP } from './date.utils';

const baseInput = {
  fondoInicial: 50_000,
  ingresosEfectivo: 120_000,
  egresosEfectivo: 14_000,
  saldoTeorico: 156_000,
};

describe('buildCuadraturaHeroKpis', () => {
  it('expone apertura, ingresos efvo., egresos efvo. y saldo esperado en ese orden', () => {
    const kpis = buildCuadraturaHeroKpis(baseInput);
    expect(kpis.map((k) => k.id)).toEqual([
      'fondo-inicial',
      'ingresos-efectivo',
      'egresos-efectivo',
      'saldo-esperado',
    ]);
  });

  it('etiqueta los KPIs de flujo dejando explícito que son solo efectivo', () => {
    const kpis = buildCuadraturaHeroKpis(baseInput);
    expect(kpis[1].label).toBe('Ingresos del día (efectivo)');
    expect(kpis[2].label).toBe('Egresos del día (efectivo)');
  });

  it('coloca cada monto en su slot y formatea a CLP', () => {
    const kpis = buildCuadraturaHeroKpis(baseInput);
    expect(kpis[0].value).toBe(formatCLP(50_000));
    expect(kpis[1].value).toBe(formatCLP(120_000));
    expect(kpis[2].value).toBe(formatCLP(14_000));
    expect(kpis[3].value).toBe(formatCLP(156_000));
  });

  it('pinta ingresos de success y egresos de warning; apertura y saldo neutros', () => {
    const kpis = buildCuadraturaHeroKpis(baseInput);
    expect(kpis[0].color).toBeUndefined();
    expect(kpis[1].color).toBe('success');
    expect(kpis[2].color).toBe('warning');
    expect(kpis[3].color).toBeUndefined();
  });

  it('el saldo esperado usa el valor teórico recibido, no lo recalcula', () => {
    const kpis = buildCuadraturaHeroKpis({ ...baseInput, saldoTeorico: -7_500 });
    expect(kpis[3].value).toBe(formatCLP(-7_500));
  });

  it('los 4 KPIs cuadran: apertura + ingresos efvo. − egresos efvo. = saldo', () => {
    // No es una aserción sobre la función (no hace la suma), sino sobre el
    // contrato de los datos que se le pasan: la franja debe ser coherente.
    const { fondoInicial, ingresosEfectivo, egresosEfectivo, saldoTeorico } = baseInput;
    expect(fondoInicial + ingresosEfectivo - egresosEfectivo).toBe(saldoTeorico);
  });
});
