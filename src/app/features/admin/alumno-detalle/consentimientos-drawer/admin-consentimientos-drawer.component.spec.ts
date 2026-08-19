import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { AdminConsentimientosDrawerComponent } from './admin-consentimientos-drawer.component';
import { ConsentsFacade } from '@core/facades/consents.facade';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type { ConsentRow } from '@core/models/ui/consent.model';

/**
 * Spec 0009-m — AC6/AC-E3: consulta y revocación de consentimientos.
 */
describe('AdminConsentimientosDrawerComponent (AC6)', () => {
  let component: AdminConsentimientosDrawerComponent;
  let consentsMock: any;
  let confirmMock: any;

  const row: ConsentRow = {
    id: 7,
    consentType: 'matricula_datos',
    typeLabel: 'Tratamiento de datos de matrícula',
    status: 'otorgado',
    grantedAt: '2026-08-17T12:00:00Z',
    revokedAt: null,
    policyVersion: '2026-08-17',
    source: 'secretaria',
    sourceLabel: 'Matrícula en secretaría',
    ip: '190.44.7.12',
    grantedByRepresentative: false,
  };

  function setup(role: string, alumnoUserId: number | null = 42, error: string | null = null) {
    TestBed.resetTestingModule();
    consentsMock = {
      consents: signal<ConsentRow[]>([row]),
      isLoading: signal(false),
      error: signal<string | null>(error),
      isSaving: signal(false),
      loadByUser: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue(true),
    };
    confirmMock = { confirm: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        { provide: ConsentsFacade, useValue: consentsMock },
        {
          provide: AdminAlumnoDetalleFacade,
          useValue: { alumno: signal(alumnoUserId ? { userId: alumnoUserId } : null) },
        },
        { provide: AuthFacade, useValue: { currentUser: signal({ role }) } },
        { provide: ConfirmModalService, useValue: confirmMock },
      ],
    });

    component = TestBed.runInInjectionContext(() => new AdminConsentimientosDrawerComponent());
    TestBed.tick();
    return component;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('carga los consentimientos del alumno abierto en la ficha', () => {
    setup('admin');
    expect(consentsMock.loadByUser).toHaveBeenCalledWith(42);
  });

  it('no consulta nada si la ficha todavía no resolvió al alumno', () => {
    setup('admin', null);
    expect(consentsMock.loadByUser).not.toHaveBeenCalled();
  });

  // Solo admin tiene policy de UPDATE en `consents`; ofrecerle el botón a una secretaria
  // sería mostrarle una acción que la base va a rechazar.
  it('solo admin ve la acción de revocar', () => {
    expect(setup('admin').canRevoke()).toBe(true);
    expect(setup('secretary').canRevoke()).toBe(false);
  });

  it('revoca tras confirmar (AC-E3)', async () => {
    setup('admin');
    await component.onRevoke(row);

    expect(confirmMock.confirm).toHaveBeenCalled();
    expect(consentsMock.revoke).toHaveBeenCalledWith(7);
  });

  it('si el admin cancela, no revoca nada', async () => {
    setup('admin');
    confirmMock.confirm.mockResolvedValue(false);

    await component.onRevoke(row);

    expect(consentsMock.revoke).not.toHaveBeenCalled();
  });

  it('traduce los tres estados a etiqueta y variante de badge', () => {
    const c = setup('admin');

    expect(c.statusLabel('otorgado')).toBe('Otorgado');
    expect(c.statusLabel('rechazado')).toBe('No autorizó');
    expect(c.statusLabel('revocado')).toBe('Revocado');
    expect(c.statusVariant('otorgado')).toBe('success');
    expect(c.statusVariant('rechazado')).toBe('error');
    expect(c.statusVariant('revocado')).toBe('warning');
  });

  // REGRESIÓN (2026-08-18): un 400 de PostgREST dejaba la lista vacía y el drawer mostraba
  // "Sin consentimientos registrados". En un panel de cumplimiento eso induce la conclusión
  // contraria a la verdad: que el titular nunca consintió.
  it('expone el error de carga en vez de hacerlo pasar por lista vacía', () => {
    const c = setup('admin', 42, 'Error al cargar los consentimientos: column does not exist');

    expect(c.consents.error()).toContain('column does not exist');
    expect(c.rows()).toHaveLength(1); // hay filas mockeadas: el estado vacío no aplica
  });

  it('sin error, la lista vacía sí es una lista vacía', () => {
    const c = setup('admin');
    (c.consents.consents as any).set([]);

    expect(c.consents.error()).toBeNull();
    expect(c.rows()).toHaveLength(0);
  });

  it('muestra un guion cuando no hay fecha, en vez de "Invalid Date"', () => {
    expect(setup('admin').formatDate(null)).toBe('—');
  });
});
