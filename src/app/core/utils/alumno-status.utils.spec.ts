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

describe('getExpedienteStatus() (fix-035-i: solo CI + Foto cuentan para el estado)', () => {
  it('retorna Completo cuando CI y Foto están presentes', () => {
    const status = getExpedienteStatus(exp({ ci: true, foto: true }));
    expect(status).toEqual({ label: 'Completo', severity: 'success', count: '2/2' });
  });

  it('retorna Pendiente cuando no hay ni CI ni Foto', () => {
    const status = getExpedienteStatus(exp({}));
    expect(status).toEqual({ label: 'Pendiente', severity: 'danger', count: '0/2' });
  });

  it('retorna Parcial cuando hay uno de los dos pero no ambos', () => {
    const status = getExpedienteStatus(exp({ ci: true, foto: false }));
    expect(status).toEqual({ label: 'Parcial', severity: 'warn', count: '1/2' });
  });

  it('medico y semep en true no afectan el resultado si CI+Foto ya están completos', () => {
    const status = getExpedienteStatus(exp({ ci: true, foto: true, medico: true, semep: true }));
    expect(status).toEqual({ label: 'Completo', severity: 'success', count: '2/2' });
  });

  it('medico y semep en false no degradan el resultado si CI+Foto ya están completos', () => {
    const status = getExpedienteStatus(exp({ ci: true, foto: true, medico: false, semep: false }));
    expect(status).toEqual({ label: 'Completo', severity: 'success', count: '2/2' });
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
