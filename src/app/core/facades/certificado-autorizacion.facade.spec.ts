import { TestBed } from '@angular/core/testing';
import { CertificadoAutorizacionFacade } from './certificado-autorizacion.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('CertificadoAutorizacionFacade (fix-466-m)', () => {
  let facade: CertificadoAutorizacionFacade;
  let confirmModal: {
    confirm: ReturnType<typeof vi.fn>;
    confirmWithReason: ReturnType<typeof vi.fn>;
  };
  let toast: { error: ReturnType<typeof vi.fn> };
  let insertSpy: ReturnType<typeof vi.fn>;

  /** Mock de `from()` con el saldo y la cantidad de habilitaciones previas. */
  function mockDb(pendingBalance: number, overrides: number) {
    insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
    });
    return vi.fn().mockImplementation((table: string) => {
      if (table === 'enrollments') {
        return {
          select: () => ({
            eq: () => ({
              single: vi
                .fn()
                .mockResolvedValue({ data: { pending_balance: pendingBalance }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ eq: vi.fn().mockResolvedValue({ count: overrides, error: null }) }),
        }),
        insert: insertSpy,
      };
    });
  }

  function setup(pendingBalance: number, overrides = 0) {
    confirmModal = {
      confirm: vi.fn().mockResolvedValue(true),
      confirmWithReason: vi.fn().mockResolvedValue('Paga el viernes'),
    };
    toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        CertificadoAutorizacionFacade,
        {
          provide: SupabaseService,
          useValue: { client: { from: mockDb(pendingBalance, overrides) } },
        },
        { provide: AuthFacade, useValue: { currentUser: () => ({ dbId: 77 }) } },
        { provide: ConfirmModalService, useValue: confirmModal },
        { provide: ToastService, useValue: toast },
      ],
    });
    facade = TestBed.inject(CertificadoAutorizacionFacade);
  }

  const request = { enrollmentId: 42, nombre: 'Ana Pérez', accion: 'generar' as const };

  it('sin deuda: confirmación simple, sin motivo ni registro', async () => {
    setup(0);
    await expect(facade.confirmarEmision(request)).resolves.toBe(true);
    expect(confirmModal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Generar certificado', confirmLabel: 'Generar' }),
    );
    expect(confirmModal.confirmWithReason).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('cancelar el modal devuelve false', async () => {
    setup(0);
    confirmModal.confirm.mockResolvedValue(false);
    await expect(facade.confirmarEmision(request)).resolves.toBe(false);
  });

  it('spec 0010-i: con deuda sin habilitación pide motivo y la registra', async () => {
    setup(90000);
    await expect(facade.confirmarEmision(request)).resolves.toBe(true);
    expect(confirmModal.confirmWithReason).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('$90.000') }),
    );
    expect(insertSpy).toHaveBeenCalledWith({
      enrollment_id: 42,
      kind: 'certificado',
      reason: 'Paga el viernes',
      created_by: 77,
    });
  });

  it('con deuda y sin motivo (cancelado): no registra y devuelve false', async () => {
    setup(90000);
    confirmModal.confirmWithReason.mockResolvedValue(null);
    await expect(facade.confirmarEmision(request)).resolves.toBe(false);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('con deuda ya autorizada: confirmación simple, sin volver a pedir motivo', async () => {
    setup(90000, 1);
    await expect(facade.confirmarEmision(request)).resolves.toBe(true);
    expect(confirmModal.confirmWithReason).not.toHaveBeenCalled();
    expect(confirmModal.confirm).toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('autorizarDeuda (respaldo) pide motivo y registra', async () => {
    setup(0);
    await expect(facade.autorizarDeuda(42, 'Saldo de $5.000')).resolves.toBe(true);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ kind: 'certificado' }));
  });
});
