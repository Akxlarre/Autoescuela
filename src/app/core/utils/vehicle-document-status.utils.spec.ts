import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveDocStatus,
  shouldShowVehicleDocWarning,
  vehicleDocWarningLabel,
  vehicleDocWarningLabelGeneric,
  buildVehicleDocWarningMap,
  vehicleDocWarningApplies,
  vehicleDocWarningsNotice,
} from './vehicle-document-status.utils';

// fix-251-b: el aviso salía solo en un tooltip y también en clases que ya pasaron.
describe('vehicleDocWarningApplies (fix-251-b)', () => {
  it('aplica a horarios libres, agendados y en curso', () => {
    expect(vehicleDocWarningApplies('available')).toBe(true);
    expect(vehicleDocWarningApplies('scheduled')).toBe(true);
    expect(vehicleDocWarningApplies('in_progress')).toBe(true);
  });

  it('no aplica a clases que ya pasaron: el estado se calcula contra hoy, no contra ese día', () => {
    expect(vehicleDocWarningApplies('completed')).toBe(false);
    expect(vehicleDocWarningApplies('no_show')).toBe(false);
    expect(vehicleDocWarningApplies('cancelled')).toBe(false);
  });
});

describe('vehicleDocWarningsNotice (fix-251-b)', () => {
  const soap = { expiredDocs: ['SOAP'], expiringSoonDocs: [] };
  const rt = { expiredDocs: [], expiringSoonDocs: ['Revisión Técnica'] };
  const slot = (
    vehicleId: number,
    vehiclePlate: string,
    vehicleDocWarning: typeof soap | null,
    status = 'available',
  ) => ({ vehicleId, vehiclePlate, vehicleDocWarning, status });

  it('un vehículo, aunque tenga muchos horarios → se nombra una sola vez', () => {
    expect(
      vehicleDocWarningsNotice([
        slot(7, 'RTRE29', soap),
        slot(7, 'RTRE29', soap),
        slot(8, 'AB1234', null),
      ]),
    ).toBe('Vehículo RTRE29: SOAP vencido. Sus horas se siguen ofreciendo.');
  });

  it('varios vehículos → cuántos y cuáles, ordenados por patente', () => {
    expect(vehicleDocWarningsNotice([slot(7, 'RTRE29', soap), slot(9, 'BBCL10', rt)])).toBe(
      '2 vehículos con documentos vencidos o por vencer: BBCL10 (Revisión Técnica por vencer), RTRE29 (SOAP vencido). Sus horas se siguen ofreciendo.',
    );
  });

  it('ignora clases que ya pasaron', () => {
    expect(vehicleDocWarningsNotice([slot(7, 'RTRE29', soap, 'completed')])).toBeNull();
  });

  it('sin documentos observados no hay aviso', () => {
    expect(vehicleDocWarningsNotice([slot(8, 'AB1234', null)])).toBeNull();
    expect(vehicleDocWarningsNotice([])).toBeNull();
  });
});

describe('resolveDocStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('I07 (hotfix-081-b): con fecha, manda la fecha aunque el estado guardado diga expired', () => {
    expect(resolveDocStatus('2099-01-01', 'expired')).toBe('valid');
  });

  it('sin fecha, un estado guardado expired se respeta', () => {
    expect(resolveDocStatus(null, 'expired')).toBe('expired');
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

  it('cuenta los días desde el hoy de Chile, no desde el de UTC (spec 0024-m)', () => {
    // 23:30 hora Chile del 6 de octubre: en UTC ya es día 7.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
    // Vence hoy en Chile: todavía no está vencido.
    expect(resolveDocStatus('2026-10-06', null)).toBe('expiring_soon');
    expect(resolveDocStatus('2026-10-05', null)).toBe('expired');
    // A 30 días exactos del hoy de Chile entra en "por vencer"; a 31, no.
    expect(resolveDocStatus('2026-11-05', null)).toBe('expiring_soon');
    expect(resolveDocStatus('2026-11-06', null)).toBe('valid');
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
