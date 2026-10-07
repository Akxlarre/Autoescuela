import { TestBed } from '@angular/core/testing';
import { SecretariasFacade } from './secretarias.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';

describe('SecretariasFacade', () => {
  let facade: SecretariasFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let branchFacadeSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn() };
    branchFacadeSpy = { selectedBranchId: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        functions: {
          invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        SecretariasFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
      ],
    });

    facade = TestBed.inject(SecretariasFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.secretarias()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalSecretarias()).toBe(0);
  });

  it('selectSecretaria should update signal', () => {
    const sec = { id: 1 } as any;
    facade.selectSecretaria(sec);
    expect(facade.selectedSecretaria()).toBe(sec);
  });

  describe('crearSecretaria — cuenta sin clave RUT (fix-182-b)', () => {
    const payload = {
      firstNames: 'Ana',
      paternalLastName: 'Pérez',
      maternalLastName: 'Soto',
      rut: '11.111.111-1',
      email: 'ana@test.cl',
      telefono: '',
      branchId: 1,
    } as any;

    beforeEach(() => {
      (supabaseSpy.client as any).functions = { invoke: vi.fn() };
      vi.spyOn(facade as any, 'refreshSilently').mockResolvedValue(undefined);
    });

    it('correo enviado → avisa que le llegará un correo para activar la cuenta', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValue({
        data: { success: true, inviteSent: true },
        error: null,
      });

      expect(await facade.crearSecretaria(payload)).toBe(true);
      expect(toastSpy.success).toHaveBeenCalledWith(
        'Secretaria creada',
        'Le enviamos un correo a ana@test.cl para que active su cuenta y cree su contraseña.',
      );
    });

    it('correo no enviado → indica activar con "recuperar contraseña"', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValue({
        data: { success: true, inviteSent: false },
        error: null,
      });

      expect(await facade.crearSecretaria(payload)).toBe(true);
      expect(toastSpy.success).toHaveBeenCalledWith(
        'Secretaria creada',
        'No pudimos enviar el correo de activación. Pídele que use "¿Olvidaste tu contraseña?" con ana@test.cl.',
      );
    });
  });

  // fix-200-b (S6 de ASG-i-034): el toast mostraba un texto genérico; ahora un 4xx muestra el
  // mensaje de la función y un 5xx el genérico.
  describe('errores reales de la Edge Function — fix-200-b', () => {
    const httpError = (status: number, error: string) =>
      Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        name: 'FunctionsHttpError',
        context: { status, json: vi.fn().mockResolvedValue({ error }) },
      });

    it('crearSecretaria() con 409 de RUT → muestra el mensaje de la función', async () => {
      (supabaseSpy.client as any).functions = {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: httpError(409, 'Ese RUT ya está registrado como instructor.'),
        }),
      };
      expect(await facade.crearSecretaria({ email: 'a@test.cl' } as any)).toBe(false);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Error',
        'Ese RUT ya está registrado como instructor.',
      );
    });

    it('editarSecretaria() con 409 → muestra el mensaje; con 500 → el genérico', async () => {
      const edit = { email: 'x@test.cl', currentEmail: 'y@test.cl' } as any;
      (supabaseSpy.client as any).functions = {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: httpError(409, 'Ya existe un usuario con ese correo electrónico'),
        }),
      };
      expect(await facade.editarSecretaria(1, edit)).toBe(false);
      expect(toastSpy.error).toHaveBeenLastCalledWith(
        'Error',
        'Ya existe un usuario con ese correo electrónico',
      );

      (supabaseSpy.client as any).functions = {
        invoke: vi.fn().mockResolvedValue({ data: null, error: httpError(500, 'boom técnico') }),
      };
      expect(await facade.editarSecretaria(1, edit)).toBe(false);
      expect(toastSpy.error).toHaveBeenLastCalledWith('Error', 'Error al actualizar secretaria');
    });
  });
});
