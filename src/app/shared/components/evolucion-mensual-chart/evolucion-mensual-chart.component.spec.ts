import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { EvolucionMensualChartComponent } from './evolucion-mensual-chart.component';
import type { EvolucionMensual } from '@core/models/ui/reportes-contables.model';

function mkMes(mes: string, ingresos: number, gastos: number): EvolucionMensual {
  return {
    mes,
    ingresos,
    gastos,
    neto: ingresos - gastos,
    margen: 0,
    sinMovimientos: ingresos === 0 && gastos === 0,
  };
}

describe('EvolucionMensualChartComponent — barras()', () => {
  let component: EvolucionMensualChartComponent;

  function setDatos(datos: EvolucionMensual[]) {
    (component as unknown as { datos: unknown }).datos = signal(datos);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new EvolucionMensualChartComponent());
  });

  it('escala los altos respecto al mayor valor de toda la serie', () => {
    setDatos([mkMes('Julio 2026', 500_000, 250_000), mkMes('Agosto 2026', 1_000_000, 100_000)]);
    const bars = component['barras']();
    // max de la serie = 1_000_000 (ingresos de agosto)
    expect(bars[1].ingresosPct).toBe(100);
    expect(bars[0].ingresosPct).toBe(50);
    expect(bars[0].gastosPct).toBe(25);
    expect(bars[1].gastosPct).toBe(10);
  });

  it('marca netoNegativo cuando los gastos superan los ingresos', () => {
    setDatos([mkMes('Julio 2026', 100_000, 300_000)]);
    const bars = component['barras']();
    expect(bars[0].neto).toBe(-200_000);
    expect(bars[0].netoNegativo).toBe(true);
  });

  it('serie vacía → sin barras y sin dividir por cero', () => {
    setDatos([]);
    expect(component['barras']()).toEqual([]);
  });

  it('todos los valores en cero → pct 0, sin NaN', () => {
    setDatos([mkMes('Julio 2026', 0, 0)]);
    const bars = component['barras']();
    expect(bars[0].ingresosPct).toBe(0);
    expect(bars[0].gastosPct).toBe(0);
    expect(Number.isNaN(bars[0].ingresosPct)).toBe(false);
  });

  it('shortLabel abrevia "Enero 2026" → "ene 26"', () => {
    expect(component['shortLabel']('Enero 2026')).toBe('Ene 26');
  });

  it('propaga sinMovimientos a cada barra (spec 0015-m)', () => {
    setDatos([
      mkMes('Abril 2026', 0, 0), // sin movimientos
      mkMes('Mayo 2026', 300_000, 0), // solo ingresos → con movimiento
    ]);
    const bars = component['barras']();
    expect(bars[0].sinMovimientos).toBe(true);
    expect(bars[1].sinMovimientos).toBe(false);
  });

  it('mantiene todas las columnas del rango, incluidas las de valor 0 (spec 0015-m)', () => {
    setDatos([
      mkMes('Abril 2026', 0, 0),
      mkMes('Mayo 2026', 0, 0),
      mkMes('Junio 2026', 120_000, 20_000),
      mkMes('Julio 2026', 0, 0),
    ]);
    expect(component['barras']()).toHaveLength(4);
  });

  it('compact formatea montos grandes', () => {
    expect(component['compact'](1_200_000)).toBe('$1.2M');
    expect(component['compact'](340_000)).toBe('$340K');
    expect(component['compact'](-200_000)).toBe('-$200K');
  });
});
