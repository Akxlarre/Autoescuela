import { describe, it, expect } from 'vitest';
import { cycleStartMonday, cycleEnd, cycleClassDates, formatCycleLabel } from './theory-cycle';

// Referencia de días (ISO, 1=Lun … 7=Dom) para 2026-03:
//   2026-03-09 = Lunes, 2026-03-10 = Martes, 2026-03-11 = Miércoles,
//   2026-03-12 = Jueves, 2026-03-13 = Viernes, 2026-03-14 = Sábado, 2026-03-15 = Domingo,
//   2026-03-16 = Lunes (semana siguiente).

describe('cycleStartMonday', () => {
  it('Lun/Mar/Mié → lunes de la semana en curso (RF-04)', () => {
    expect(cycleStartMonday('2026-03-09')).toBe('2026-03-09'); // lunes
    expect(cycleStartMonday('2026-03-10')).toBe('2026-03-09'); // martes
    expect(cycleStartMonday('2026-03-11')).toBe('2026-03-09'); // miércoles
  });

  it('Jue/Vie/Sáb/Dom → lunes de la semana siguiente (RF-05)', () => {
    expect(cycleStartMonday('2026-03-12')).toBe('2026-03-16'); // jueves
    expect(cycleStartMonday('2026-03-13')).toBe('2026-03-16'); // viernes
    expect(cycleStartMonday('2026-03-14')).toBe('2026-03-16'); // sábado
    expect(cycleStartMonday('2026-03-15')).toBe('2026-03-16'); // domingo
  });
});

describe('cycleEnd', () => {
  it('end = viernes de la semana siguiente (start + 11 días)', () => {
    expect(cycleEnd('2026-03-09')).toBe('2026-03-20'); // viernes semana 2
  });
});

describe('cycleClassDates', () => {
  it('genera 6 clases en Lun/Mié/Vie de las dos semanas (offsets 0,2,4,7,9,11)', () => {
    expect(cycleClassDates('2026-03-09')).toEqual([
      '2026-03-09', // L sem 1
      '2026-03-11', // X sem 1
      '2026-03-13', // V sem 1
      '2026-03-16', // L sem 2
      '2026-03-18', // X sem 2
      '2026-03-20', // V sem 2
    ]);
  });
});

describe('formatCycleLabel', () => {
  it('rotula el ciclo con el lunes de inicio capitalizado', () => {
    expect(formatCycleLabel('2026-03-09')).toBe('Ciclo — Lunes 9 de marzo');
  });

  it('agrega la sede al final cuando se provee branchName (para distinguir ciclos entre sedes)', () => {
    expect(formatCycleLabel('2026-03-09', 'Autoescuela Chillán')).toBe(
      'Ciclo — Lunes 9 de marzo · Autoescuela Chillán',
    );
  });

  it('sin branchName no agrega separador ni sede', () => {
    expect(formatCycleLabel('2026-03-09', undefined)).toBe('Ciclo — Lunes 9 de marzo');
  });
});
