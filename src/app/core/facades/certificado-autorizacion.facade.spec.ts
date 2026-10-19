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
  let overrides: { insert: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    confirmModal = {
      confirm: vi.fn().mockResolvedValue(true),
      confirmWithReason: vi.fn().mockResolvedValue('Paga el viernes'),
    };
    toast = { error: vi.fn() };
    overrides = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
    };
    TestBed.configureTestingModule({
      providers: [
        CertificadoAutorizacionFacade,
        { provide: SupabaseService, useValue: { client: { from: vi.fn(() => overrides) } } },
        { provide: AuthFacade, useValue: { currentUser: () => ({ dbId: 77 }) } },
        { provide: ConfirmModalService, useValue: confirmModal },
        { provide: ToastService, useValue: toast },
      ],
    });
    facade = TestBed.inject(CertificadoAutorizacionFacade);
  });

  describe('confirmarAvisos()', () => {
    it('sin avisos: true sin abrir ningún modal', async () => {
      await expect(facade.confirmarAvisos({ nombre: 'Ana', pctTeoria: null })).resolves.toBe(true);
      expect(confirmModal.confirm).not.toHaveBeenCalled();
    });

    it('con avisos: abre el modal y devuelve lo que se elija', async () => {
      confirmModal.confirm.mockResolvedValueOnce(false);
      const input = { nombre: 'Ana', practicasIncompletas: { completadas: 9, requeridas: 12 } };
      await expect(facade.confirmarAvisos(input)).resolves.toBe(false);
      expect(confirmModal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('9/12') }),
      );
    });
  });

  it('confirmarRegeneracion(): modal de fix-464-m', async () => {
    await facade.confirmarRegeneracion();
    expect(confirmModal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Regenerar certificado', confirmLabel: 'Regenerar' }),
    );
  });

  it('confirmarEnvioEmail(): modal con el correo', async () => {
    await facade.confirmarEnvioEmail({ nombre: 'Ana', email: 'ana@test.com', yaEnviado: false });
    expect(confirmModal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Enviar certificado',
        message: expect.stringContaining('ana@test.com'),
      }),
    );
  });

  describe('autorizarDeuda() (spec 0010-i)', () => {
    it('pide motivo con el saldo y registra la habilitación', async () => {
      await expect(facade.autorizarDeuda(42, 'Saldo pendiente de $180.000.')).resolves.toBe(true);
      expect(confirmModal.confirmWithReason).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('$180.000'),
          reason: expect.objectContaining({ minLength: 5 }),
        }),
      );
      expect(overrides.insert).toHaveBeenCalledWith({
        enrollment_id: 42,
        kind: 'certificado',
        reason: 'Paga el viernes',
        created_by: 77,
      });
    });

    it('si se cancela, no registra', async () => {
      confirmModal.confirmWithReason.mockResolvedValueOnce(null);
      await expect(facade.autorizarDeuda(42, 'Saldo')).resolves.toBe(false);
      expect(overrides.insert).not.toHaveBeenCalled();
    });

    it('si la habilitación no se guarda, devuelve false y muestra el error', async () => {
      overrides.select.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
      await expect(facade.autorizarDeuda(42, 'Saldo')).resolves.toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
