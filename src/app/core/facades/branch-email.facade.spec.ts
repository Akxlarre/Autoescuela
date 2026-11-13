import { TestBed } from '@angular/core/testing';
import { BranchEmailFacade } from './branch-email.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

/**
 * Spec 0061-b — configuración de correo por escuela (AC11, AC12, AC-E6).
 * Lee y escribe las columnas de correo de `branches`; prueba el envío con
 * `send-branch-test-email`.
 */
describe('BranchEmailFacade', () => {
  let facade: BranchEmailFacade;
  let toastSpy: any;
  let invokeSpy: any;
  let updateSpy: any;

  const ROWS = [
    {
      id: 1,
      name: 'Autoescuela Chillán',
      email_sender_name: 'Autoescuela Chillán',
      email_sender_address: 'autoescuela-chillan@gestordeautoescuelas.cl',
      email: 'otecchillan@gmail.com',
      phone: '+56 42 232 7800',
    },
    {
      id: 2,
      name: 'Conductores Chillán',
      email_sender_name: null,
      email_sender_address: null,
      email: null,
      phone: null,
    },
  ];

  function setup(opts: { readError?: any; writeError?: any; writeRows?: any[] } = {}) {
    updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: opts.writeRows ?? [{ id: 1 }],
          error: opts.writeError ?? null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: opts.readError ? null : ROWS,
          error: opts.readError ?? null,
        }),
      }),
      update: updateSpy,
    });
    invokeSpy = vi.fn();
    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        BranchEmailFacade,
        { provide: SupabaseService, useValue: { client: { from, functions: { invoke: invokeSpy } } } },
        { provide: ToastService, useValue: toastSpy },
      ],
    });
    facade = TestBed.inject(BranchEmailFacade);
  }

  beforeEach(() => TestBed.resetTestingModule());

  describe('load()', () => {
    it('mapea las columnas de branches al modelo del formulario (AC11)', async () => {
      setup();
      await facade.load();
      expect(facade.configs()).toEqual([
        {
          branchId: 1,
          branchName: 'Autoescuela Chillán',
          senderName: 'Autoescuela Chillán',
          senderAddress: 'autoescuela-chillan@gestordeautoescuelas.cl',
          replyTo: 'otecchillan@gmail.com',
          phone: '+56 42 232 7800',
        },
        {
          branchId: 2,
          branchName: 'Conductores Chillán',
          senderName: null,
          senderAddress: null,
          replyTo: null,
          phone: null,
        },
      ]);
      expect(facade.isLoading()).toBe(false);
    });

    it('una lectura fallida deja error y lista vacía, no "sin configuración"', async () => {
      setup({ readError: { message: 'boom' } });
      await facade.load();
      expect(facade.configs()).toEqual([]);
      expect(facade.error()).toBeTruthy();
    });
  });

  describe('save()', () => {
    const FORM = {
      senderName: ' Autoescuela Chillán ',
      senderAddress: 'Autoescuela-Chillan@gestordeautoescuelas.cl',
      replyTo: 'nuevo@gmail.com',
      phone: '+56 42 232 7800',
    };

    it('guarda normalizado en las columnas de branches y actualiza el estado', async () => {
      setup();
      await facade.load();
      const ok = await facade.save(1, FORM);
      expect(ok).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith({
        email_sender_name: 'Autoescuela Chillán',
        email_sender_address: 'autoescuela-chillan@gestordeautoescuelas.cl',
        email: 'nuevo@gmail.com',
        phone: '+56 42 232 7800',
      });
      expect(facade.configs()[0].replyTo).toBe('nuevo@gmail.com');
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('AC-E6: no guarda una dirección de envío fuera del dominio autenticado', async () => {
      setup();
      await facade.load();
      const ok = await facade.save(1, { ...FORM, senderAddress: 'escuela@gmail.com' });
      expect(ok).toBe(false);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(facade.error()).toContain('@gestordeautoescuelas.cl');
    });

    it('un error de escritura no deja el cambio aplicado en memoria', async () => {
      setup({ writeError: { message: 'denied' } });
      await facade.load();
      const ok = await facade.save(1, FORM);
      expect(ok).toBe(false);
      expect(facade.configs()[0].replyTo).toBe('otecchillan@gmail.com');
      expect(toastSpy.error).toHaveBeenCalled();
    });

    it('0 filas actualizadas (RLS: no es admin) cuenta como fallo', async () => {
      setup({ writeRows: [] });
      await facade.load();
      expect(await facade.save(1, FORM)).toBe(false);
    });
  });

  describe('enviarPrueba() — AC12', () => {
    it('invoca la función con la escuela y avisa a qué correo llegó', async () => {
      setup();
      invokeSpy.mockResolvedValue({ data: { success: true, recipientEmail: 'admin@x.cl' }, error: null });
      const ok = await facade.enviarPrueba(2);
      expect(ok).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('send-branch-test-email', { body: { branchId: 2 } });
      expect(toastSpy.success.mock.calls[0].join(' ')).toContain('admin@x.cl');
    });

    it('muestra el error del servidor de correo (respuesta 422)', async () => {
      setup();
      const context = new Response(
        JSON.stringify({ error: 'El servidor de correo rechazó el envío: 550 denied' }),
        { status: 422 },
      );
      invokeSpy.mockResolvedValue({ data: null, error: { message: 'non-2xx', context } });
      const ok = await facade.enviarPrueba(2);
      expect(ok).toBe(false);
      expect(facade.error()).toContain('550 denied');
      expect(facade.isSendingTest()).toBe(false);
    });
  });
});
