import { describe, it, expect } from 'vitest';
import { latestConsentPerBranch } from './consent-view.utils';
import type { ConsentRow } from '@core/models/ui/consent.model';

function row(partial: Partial<ConsentRow>): ConsentRow {
  return {
    id: 1,
    consentType: 'comunicaciones_promocionales',
    branchId: 1,
    branchName: 'Autoescuela Chillán',
    typeLabel: 'Comunicaciones promocionales',
    status: 'otorgado',
    grantedAt: '2026-09-01T12:00:00Z',
    revokedAt: null,
    policyVersion: '2026-08-17',
    source: 'public',
    sourceLabel: 'Matrícula online',
    ip: null,
    grantedByRepresentative: false,
    ...partial,
  };
}

// spec 0061-b (AC10): un consentimiento promocional por escuela, el más reciente ante cada una.
describe('latestConsentPerBranch', () => {
  it('devuelve el más reciente de cada escuela, ordenado por escuela', () => {
    const result = latestConsentPerBranch(
      [
        row({ id: 1, branchId: 2, branchName: 'Conductores Chillán', grantedAt: '2026-09-01T12:00:00Z' }),
        row({ id: 2, branchId: 1, grantedAt: '2026-08-01T12:00:00Z' }),
        row({ id: 3, branchId: 2, branchName: 'Conductores Chillán', grantedAt: '2026-10-01T12:00:00Z', status: 'rechazado' }),
      ],
      'comunicaciones_promocionales',
    );
    expect(result.map((r) => r.id)).toEqual([2, 3]);
  });

  it('ignora otros tipos de consentimiento', () => {
    const result = latestConsentPerBranch(
      [row({ id: 1, consentType: 'matricula_datos' }), row({ id: 2 })],
      'comunicaciones_promocionales',
    );
    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it('sin consentimientos del tipo → lista vacía', () => {
    expect(latestConsentPerBranch([], 'comunicaciones_promocionales')).toEqual([]);
  });
});
