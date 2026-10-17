import { describe, expect, it } from 'vitest';
import {
  etiquetaAnularIngreso,
  formatAnulacionDetalle,
  ingresoSeAnula,
  resumenConAnulados,
} from './anulacion-pago.utils';

describe('ingresoSeAnula — fix-443-m', () => {
  it('un pago y una venta de servicio especial se anulan; un curso singular se revierte', () => {
    expect(ingresoSeAnula('payment')).toBe(true);
    expect(ingresoSeAnula('special_service')).toBe(true);
    expect(ingresoSeAnula('singular')).toBe(false);
  });

  it('la etiqueta nombra lo que se anula', () => {
    expect(etiquetaAnularIngreso('payment')).toBe('Anular pago');
    expect(etiquetaAnularIngreso('special_service')).toBe('Anular venta');
  });
});

const anulacion = { motivo: 'Pago duplicado', por: 'Ana Rojas', cuando: '13-10-2026 23:30' };

describe('formatAnulacionDetalle — spec 0025-m', () => {
  it('arma motivo, quién y cuándo en una línea', () => {
    expect(formatAnulacionDetalle(anulacion)).toBe('Pago duplicado · Ana Rojas · 13-10-2026 23:30');
  });

  it('sin nombre legible dice "Administrador"', () => {
    expect(formatAnulacionDetalle({ ...anulacion, por: null })).toBe(
      'Pago duplicado · Administrador · 13-10-2026 23:30',
    );
  });

  it.each([null, undefined])('un pago vigente (%s) no tiene detalle', (value) => {
    expect(formatAnulacionDetalle(value)).toBe('');
  });
});

describe('resumenConAnulados — spec 0025-m', () => {
  const vigente = { anulacion: null };
  const anulado = { anulacion };

  it('sin anulados cuenta todo', () => {
    expect(resumenConAnulados([vigente, vigente], 'ingreso', 'ingresos')).toBe(
      'Mostrando 2 ingresos',
    );
  });

  it('los anulados se informan aparte y no cuentan como ingresos', () => {
    expect(resumenConAnulados([vigente, anulado], 'ingreso', 'ingresos')).toBe(
      'Mostrando 1 ingreso · 1 anulado',
    );
    expect(resumenConAnulados([anulado, anulado], 'ingreso', 'ingresos')).toBe(
      'Mostrando 0 ingresos · 2 anulados',
    );
  });

  it('una fila sin el campo cuenta como vigente', () => {
    expect(resumenConAnulados([{}], 'ingreso', 'ingresos')).toBe('Mostrando 1 ingreso');
  });
});
