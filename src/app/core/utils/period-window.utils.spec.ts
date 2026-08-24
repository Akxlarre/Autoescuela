import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERIOD_WINDOW,
  PERIOD_WINDOW_MONTHS,
  applyPeriodWindow,
  periodCutoffIso,
  type PeriodWindow,
} from './period-window.utils';

interface Row {
  id: number;
  fecha: string | null;
}

const CUTOFF = '2025-08-22'; // 12 meses antes de 2026-08-22

const viejo: Row = { id: 1, fecha: '2024-03-10' }; // fuera de la ventana
const reciente: Row = { id: 2, fecha: '2026-07-01' }; // dentro
const borde: Row = { id: 3, fecha: CUTOFF }; // exactamente en el corte
const sinFecha: Row = { id: 4, fecha: null };

const dateOf = (r: Row) => r.fecha;

function apply(window: PeriodWindow, hasActiveSearch: boolean, items: Row[] = [viejo, reciente]) {
  return applyPeriodWindow(items, { window, hasActiveSearch, dateOf, cutoffIso: CUTOFF });
}

describe('periodCutoffIso', () => {
  it('devuelve null para "all" — no hay corte que aplicar', () => {
    expect(periodCutoffIso('all')).toBeNull();
  });

  it('devuelve el corte recibido para la ventana de 12 meses', () => {
    expect(periodCutoffIso('last-12-months', CUTOFF)).toBe(CUTOFF);
  });

  it('sin corte explícito calcula uno real y anterior a hoy', () => {
    const cutoff = periodCutoffIso('last-12-months');
    expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cutoff! < new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it('el default del proyecto es la ventana de 12 meses', () => {
    expect(DEFAULT_PERIOD_WINDOW).toBe('last-12-months');
    expect(PERIOD_WINDOW_MONTHS).toBe(12);
  });
});

describe('applyPeriodWindow — browse mode (sin búsqueda)', () => {
  it('recorta los registros anteriores al corte', () => {
    expect(apply('last-12-months', false).map((r) => r.id)).toEqual([reciente.id]);
  });

  it('incluye el registro que cae exactamente en la fecha de corte', () => {
    const out = apply('last-12-months', false, [borde, viejo]);
    expect(out.map((r) => r.id)).toEqual([borde.id]);
  });

  it('con ventana "all" no recorta nada', () => {
    expect(apply('all', false).map((r) => r.id)).toEqual([viejo.id, reciente.id]);
  });

  it('conserva los registros sin fecha en vez de descartarlos en silencio', () => {
    const out = apply('last-12-months', false, [viejo, sinFecha]);
    expect(out.map((r) => r.id)).toEqual([sinFecha.id]);
  });
});

describe('applyPeriodWindow — la búsqueda NUNCA queda atrapada por el período', () => {
  // Regla no negociable de ASG-b-087 / research §2.1: buscar a alguien con matrícula vieja
  // debe encontrarlo. Si el período lo filtra, el usuario lee "0 resultados" como "no existe".
  it('con búsqueda activa devuelve también los registros fuera de la ventana', () => {
    expect(apply('last-12-months', true).map((r) => r.id)).toEqual([viejo.id, reciente.id]);
  });

  it('la búsqueda activa manda incluso sobre la ventana más restrictiva', () => {
    const out = applyPeriodWindow([viejo], {
      window: 'last-12-months',
      hasActiveSearch: true,
      dateOf,
      cutoffIso: '2026-08-01',
    });
    expect(out).toHaveLength(1);
  });
});

describe('applyPeriodWindow — ventana de año concreto (fix-147-b, unificación con el filtro de año)', () => {
  // En ex-alumnos Clase B ya existía un filtro por año. Se unificaron en UN solo control de
  // tiempo: elegir un año es otra ventana, no un filtro aparte que compita con esta.
  const de2024: Row = { id: 10, fecha: '2024-06-15' };
  const de2026: Row = { id: 11, fecha: '2026-02-01' };

  it('deja solo los registros del año elegido', () => {
    const out = applyPeriodWindow([de2024, de2026], {
      window: 'year-2024',
      hasActiveSearch: false,
      dateOf,
      cutoffIso: CUTOFF,
    });
    expect(out.map((r) => r.id)).toEqual([de2024.id]);
  });

  it('un año viejo NO queda vacío por la ventana de 12 meses — es su propia ventana', () => {
    // Regresión del bug que motivó la unificación: con dos controles compitiendo, elegir 2024
    // devolvía 0 filas y el filtro de año parecía roto.
    const out = applyPeriodWindow([de2024], {
      window: 'year-2024',
      hasActiveSearch: false,
      dateOf,
      cutoffIso: CUTOFF,
    });
    expect(out).toHaveLength(1);
  });

  it('la búsqueda activa también atraviesa la ventana de año', () => {
    const out = applyPeriodWindow([de2024, de2026], {
      window: 'year-2024',
      hasActiveSearch: true,
      dateOf,
      cutoffIso: CUTOFF,
    });
    expect(out).toHaveLength(2);
  });

  it('periodCutoffIso devuelve null para una ventana de año (no es un corte, es un rango)', () => {
    expect(periodCutoffIso('year-2024')).toBeNull();
  });
});

describe('applyPeriodWindow — pureza', () => {
  it('no muta el arreglo original', () => {
    const items = [viejo, reciente];
    apply('last-12-months', false, items);
    expect(items).toHaveLength(2);
  });

  it('devuelve un arreglo nuevo, no la misma referencia', () => {
    const items = [viejo, reciente];
    expect(apply('all', false, items)).not.toBe(items);
  });
});
