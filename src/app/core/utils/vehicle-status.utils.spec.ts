import { describe, it, expect } from 'vitest';
import { resolveVehicleStatus } from './vehicle-status.utils';

describe('resolveVehicleStatus', () => {
  it('mapea "operational" (valor real de BD y seed) a "available"', () => {
    expect(resolveVehicleStatus('operational')).toBe('available');
  });

  it('mapea "in_use" a "in_class"', () => {
    expect(resolveVehicleStatus('in_use')).toBe('in_class');
  });

  it('mapea "maintenance" a "maintenance"', () => {
    expect(resolveVehicleStatus('maintenance')).toBe('maintenance');
  });

  it('mapea "out_of_service" a "out_of_service"', () => {
    expect(resolveVehicleStatus('out_of_service')).toBe('out_of_service');
  });

  it('mapea "blocked" a "out_of_service"', () => {
    expect(resolveVehicleStatus('blocked')).toBe('out_of_service');
  });

  it('es case-insensitive', () => {
    expect(resolveVehicleStatus('OPERATIONAL')).toBe('available');
  });

  it('cae a "available" para un valor desconocido', () => {
    expect(resolveVehicleStatus('algo-raro')).toBe('available');
  });

  it('cae a "available" para null/undefined', () => {
    expect(resolveVehicleStatus(null)).toBe('available');
    expect(resolveVehicleStatus(undefined)).toBe('available');
  });
});
