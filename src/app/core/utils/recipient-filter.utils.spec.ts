import { describe, it, expect } from 'vitest';
import {
  applyBulkAction,
  filterRecipients,
  includedCount,
  onlyExcluded,
} from './recipient-filter.utils';
import type { RecipientPreview } from '@core/models/ui/announcement.model';

function r(userId: number, name: string, extra: Partial<RecipientPreview> = {}): RecipientPreview {
  return {
    userId,
    name,
    email: `a${userId}@test.com`,
    included: true,
    exclusionReason: null,
    ...extra,
  };
}

const LISTA: RecipientPreview[] = [
  r(1, 'Ana Pérez'),
  r(2, 'Benjamín Soto'),
  r(3, 'Carla Muñoz'),
  r(4, 'Ana María Díaz'),
  r(5, 'Diego Rojas', { included: false, exclusionReason: 'sin_consentimiento' }),
];

describe('filterRecipients()', () => {
  it('sin término devuelve la lista completa', () => {
    expect(filterRecipients(LISTA, '')).toHaveLength(5);
    expect(filterRecipients(LISTA, '   ')).toHaveLength(5);
  });

  it('filtra por nombre, sin distinguir mayúsculas', () => {
    expect(filterRecipients(LISTA, 'ana').map((x) => x.userId)).toEqual([1, 4]);
  });

  it('ignora acentos: buscar "benjamin" encuentra "Benjamín"', () => {
    expect(filterRecipients(LISTA, 'benjamin').map((x) => x.userId)).toEqual([2]);
  });

  it('y al revés: buscar con acento encuentra al que no lo tiene', () => {
    expect(filterRecipients([r(9, 'Munoz Lopez')], 'muñoz')).toHaveLength(1);
  });

  it('coincide en cualquier parte del nombre, no solo al inicio', () => {
    expect(filterRecipients(LISTA, 'soto').map((x) => x.userId)).toEqual([2]);
  });

  it('AC-E1 · sin coincidencias devuelve lista vacía', () => {
    expect(filterRecipients(LISTA, 'zzz')).toEqual([]);
  });
});

describe('includedCount()', () => {
  it('cuenta solo los incluidos', () => {
    expect(includedCount(LISTA)).toBe(4);
  });

  // AC-E1 — la regla que sostiene todo: buscar cambia QUÉ SE VE, no a quién le llega.
  // Sin esto, filtrar se sentiría como excluir y la secretaria mandaría de menos sin saberlo.
  it('AC-E1 · el alcance NO depende del filtro: se cuenta sobre la lista completa', () => {
    const filtrada = filterRecipients(LISTA, 'ana');

    expect(filtrada).toHaveLength(2);
    expect(includedCount(LISTA)).toBe(4);
  });
});

describe('applyBulkAction()', () => {
  it('quitar sobre toda la lista excluye a todos los que estaban incluidos', () => {
    const result = applyBulkAction(LISTA, LISTA, 'quitar', []);

    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  // AC-E3 — un botón que dice "todos" y toca 185 cuando ves 12 es una trampa.
  it('AC-E3 · quitar con filtro activo afecta SOLO a los visibles', () => {
    const visibles = filterRecipients(LISTA, 'ana');

    const result = applyBulkAction(LISTA, visibles, 'quitar', []);

    expect(result.sort((a, b) => a - b)).toEqual([1, 4]);
  });

  it('quitar preserva las exclusiones previas de los no visibles', () => {
    const visibles = filterRecipients(LISTA, 'ana');

    const result = applyBulkAction(LISTA, visibles, 'quitar', [2]);

    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 4]);
  });

  it('incluir con filtro activo reincorpora solo a los visibles', () => {
    const visibles = filterRecipients(LISTA, 'ana');

    const result = applyBulkAction(LISTA, visibles, 'incluir', [1, 2, 4]);

    expect(result).toEqual([2]);
  });

  // Quien está fuera por consentimiento no puede volver con un botón: esa exclusión
  // no la decide la secretaria, la decide el alumno.
  it('incluir NO reincorpora a quien está excluido por falta de consentimiento', () => {
    const result = applyBulkAction(LISTA, LISTA, 'incluir', []);

    expect(result).toEqual([]);
    expect(LISTA.find((x) => x.userId === 5)?.included).toBe(false);
  });

  it('quitar tampoco agrega a la lista manual a quien ya está fuera por consentimiento', () => {
    const result = applyBulkAction(LISTA, LISTA, 'quitar', []);

    expect(result).not.toContain(5);
  });

  it('lista vacía de visibles no cambia nada', () => {
    expect(applyBulkAction(LISTA, [], 'quitar', [3])).toEqual([3]);
  });
});

describe('onlyExcluded()', () => {
  it('devuelve los excluidos por consentimiento y los quitados a mano', () => {
    const result = onlyExcluded(LISTA, [2]);

    expect(result.map((x) => x.userId).sort((a, b) => a - b)).toEqual([2, 5]);
  });

  it('marca el motivo de cada uno', () => {
    const result = onlyExcluded(LISTA, [2]);

    expect(result.find((x) => x.userId === 5)?.exclusionReason).toBe('sin_consentimiento');
    expect(result.find((x) => x.userId === 2)?.exclusionReason).toBe('excluido_manualmente');
  });

  it('sin exclusiones manuales devuelve solo los de consentimiento', () => {
    expect(onlyExcluded(LISTA, []).map((x) => x.userId)).toEqual([5]);
  });
});
