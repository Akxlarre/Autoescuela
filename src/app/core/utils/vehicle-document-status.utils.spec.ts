import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveDocStatus,
  shouldShowVehicleDocWarning,
  vehicleDocWarningLabel,
  vehicleDocWarningLabelGeneric,
  buildVehicleDocWarningMap,
} from './vehicle-document-status.utils';

describe('resolveDocStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna expired si rawStatus ya viene marcado como expired', () => {
    expect(resolveDocStatus('2099-01-01', 'expired')).toBe('expired');
  });

  it('retorna valid si no hay expiryDate', () => {
    expect(resolveDocStatus(null, null)).toBe('valid');
  });

  it('retorna expired si expiryDate ya pasó', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(resolveDocStatus('2026-08-01', null)).toBe('expired');
  });

  it('retorna expiring_soon si expiryDate está dentro de 30 días', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(resolveDocStatus('2026-08-20', null)).toBe('expiring_soon');
  });

  it('retorna valid si expiryDate está a más de 30 días', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(resolveDocStatus('2026-12-01', null)).toBe('valid');
  });
});

describe('shouldShowVehicleDocWarning', () => {
  it('oculta el badge si no hay advertencia, aunque showVehicleWarnings sea true', () => {
    expect(shouldShowVehicleDocWarning(null, true)).toBe(false);
  });

  it('oculta el badge si la advertencia no tiene documentos en ninguna lista', () => {
    expect(shouldShowVehicleDocWarning({ expiredDocs: [], expiringSoonDocs: [] }, true)).toBe(
      false,
    );
  });

  it('muestra el badge si hay documentos vencidos o por vencer y showVehicleWarnings es true', () => {
    expect(shouldShowVehicleDocWarning({ expiredDocs: ['SOAP'], expiringSoonDocs: [] }, true)).toBe(
      true,
    );
    expect(
      shouldShowVehicleDocWarning({ expiredDocs: [], expiringSoonDocs: ['Seguro'] }, true),
    ).toBe(true);
  });

  it('oculta el badge si showVehicleWarnings es false, aunque haya advertencia (flujo público)', () => {
    expect(
      shouldShowVehicleDocWarning({ expiredDocs: ['SOAP'], expiringSoonDocs: [] }, false),
    ).toBe(false);
  });
});

describe('vehicleDocWarningLabel', () => {
  it('lista un solo documento vencido', () => {
    expect(vehicleDocWarningLabel('ABCD-12', { expiredDocs: ['SOAP'], expiringSoonDocs: [] })).toBe(
      'Vehículo ABCD-12: SOAP vencido',
    );
  });

  it('lista varios documentos vencidos, unidos con "y"', () => {
    expect(
      vehicleDocWarningLabel('ABCD-12', {
        expiredDocs: ['SOAP', 'Seguro'],
        expiringSoonDocs: [],
      }),
    ).toBe('Vehículo ABCD-12: SOAP y Seguro vencidos');
  });

  it('lista un documento por vencer', () => {
    expect(
      vehicleDocWarningLabel('ABCD-12', {
        expiredDocs: [],
        expiringSoonDocs: ['Revisión Técnica'],
      }),
    ).toBe('Vehículo ABCD-12: Revisión Técnica por vencer');
  });

  it('combina vencidos y por vencer en un solo mensaje', () => {
    expect(
      vehicleDocWarningLabel('ABCD-12', {
        expiredDocs: ['SOAP'],
        expiringSoonDocs: ['Revisión Técnica'],
      }),
    ).toBe('Vehículo ABCD-12: SOAP vencido; Revisión Técnica por vencer');
  });

  it('retorna string vacío si no hay advertencia', () => {
    expect(vehicleDocWarningLabel('ABCD-12', null)).toBe('');
    expect(vehicleDocWarningLabel('ABCD-12', { expiredDocs: [], expiringSoonDocs: [] })).toBe('');
  });
});

describe('vehicleDocWarningLabelGeneric', () => {
  it('lista los documentos específicos, sin patente', () => {
    expect(vehicleDocWarningLabelGeneric({ expiredDocs: ['SOAP'], expiringSoonDocs: [] })).toBe(
      'Vehículo con SOAP vencido',
    );
  });

  it('retorna string vacío si no hay advertencia', () => {
    expect(vehicleDocWarningLabelGeneric(null)).toBe('');
  });
});

describe('buildVehicleDocWarningMap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignora vehículos con documentos vigentes', () => {
    const map = buildVehicleDocWarningMap([
      { vehicle_id: 1, type: 'soap', expiry_date: '2026-12-01', status: null },
    ]);
    expect(map.has(1)).toBe(false);
  });

  it('agrupa documentos específicos vencidos y por vencer por vehículo', () => {
    const map = buildVehicleDocWarningMap([
      { vehicle_id: 1, type: 'soap', expiry_date: '2026-08-01', status: null }, // expired
      { vehicle_id: 1, type: 'insurance', expiry_date: '2026-08-20', status: null }, // expiring_soon
      { vehicle_id: 2, type: 'technical_inspection', expiry_date: '2026-08-01', status: null }, // expired
    ]);
    expect(map.get(1)).toEqual({ expiredDocs: ['SOAP'], expiringSoonDocs: ['Seguro'] });
    expect(map.get(2)).toEqual({ expiredDocs: ['Revisión Técnica'], expiringSoonDocs: [] });
  });

  it('acumula varios documentos vencidos del mismo vehículo en la misma lista', () => {
    const map = buildVehicleDocWarningMap([
      { vehicle_id: 1, type: 'soap', expiry_date: '2026-08-01', status: null },
      { vehicle_id: 1, type: 'insurance', expiry_date: '2026-08-01', status: null },
    ]);
    expect(map.get(1)?.expiredDocs).toEqual(['SOAP', 'Seguro']);
  });

  it('usa el value crudo como fallback si el type no está en VEHICLE_DOC_TYPES', () => {
    const map = buildVehicleDocWarningMap([
      { vehicle_id: 1, type: 'unknown_doc', expiry_date: '2026-08-01', status: null },
    ]);
    expect(map.get(1)?.expiredDocs).toEqual(['unknown_doc']);
  });
});
