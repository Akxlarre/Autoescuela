import { describe, it, expect } from 'vitest';
import {
  getExpedienteStatus,
  getAlumnoStatusSeverity,
  getAlumnoStatusBadgeVariant,
  tagSeverityToBadgeVariant,
} from './alumno-status.utils';
import type { AlumnoExpediente } from '@core/models/ui/alumno-table-row.model';

const exp = (overrides: Partial<AlumnoExpediente>): AlumnoExpediente => ({
  ci: false,
  foto: false,
  medico: false,
  semep: false,
  ...overrides,
});

describe('getExpedienteStatus()', () => {
  it('retorna Completo cuando los 4 documentos están presentes', () => {
    const status = getExpedienteStatus(exp({ ci: true, foto: true, medico: true, semep: true }));
    expect(status).toEqual({ label: 'Completo', severity: 'success', count: '4/4' });
  });

  it('retorna Pendiente cuando no hay ningún documento', () => {
    const status = getExpedienteStatus(exp({}));
    expect(status).toEqual({ label: 'Pendiente', severity: 'danger', count: '0/4' });
  });

  it('retorna Parcial cuando hay al menos uno pero no todos', () => {
    const status = getExpedienteStatus(exp({ ci: true, foto: true }));
    expect(status).toEqual({ label: 'Parcial', severity: 'warn', count: '2/4' });
  });
});

describe('getAlumnoStatusSeverity()', () => {
  it('mapea cada estado conocido a su severidad', () => {
    expect(getAlumnoStatusSeverity('Activo')).toBe('success');
    expect(getAlumnoStatusSeverity('Finalizado')).toBe('info');
    expect(getAlumnoStatusSeverity('Retirado')).toBe('danger');
    expect(getAlumnoStatusSeverity('Pre-inscrito')).toBe('warn');
    expect(getAlumnoStatusSeverity('Pendiente Pago')).toBe('warn');
    expect(getAlumnoStatusSeverity('Docs Pendientes')).toBe('info');
    expect(getAlumnoStatusSeverity('Inactivo')).toBe('secondary');
  });

  it('cae a secondary para un estado desconocido', () => {
    expect(getAlumnoStatusSeverity('otro' as never)).toBe('secondary');
  });
});

describe('tagSeverityToBadgeVariant()', () => {
  it('mapea cada severidad de p-tag a su variant de app-badge', () => {
    expect(tagSeverityToBadgeVariant('success')).toBe('success');
    expect(tagSeverityToBadgeVariant('warn')).toBe('warning');
    expect(tagSeverityToBadgeVariant('danger')).toBe('error');
    expect(tagSeverityToBadgeVariant('info')).toBe('info');
    expect(tagSeverityToBadgeVariant('secondary')).toBe('neutral');
  });
});

describe('getAlumnoStatusBadgeVariant()', () => {
  it('compone severidad + mapeo a badge en un solo paso', () => {
    expect(getAlumnoStatusBadgeVariant('Activo')).toBe('success');
    expect(getAlumnoStatusBadgeVariant('Retirado')).toBe('error');
    expect(getAlumnoStatusBadgeVariant('Pendiente Pago')).toBe('warning');
  });
});
