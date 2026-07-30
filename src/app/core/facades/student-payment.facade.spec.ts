import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { StudentPaymentFacade } from './student-payment.facade';
import { StudentEnrollmentContextFacade } from './student-enrollment-context.facade';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

// initialize() cuando ya está _initialized dispara refreshSilently() como
// fire-and-forget (void, sin await) — hay que flushear el microtask antes de assertar.
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Spec de StudentPaymentFacade (fix-017 + spec-0034).
 *
 * Desde fix-017 la facade es exclusivamente de pago: ya no gestiona selección de
 * horarios. Estos tests cubren sus decisiones reales: transiciones de paso,
 * estado inicial y computed derivados.
 *
 * spec-0034: el facade ahora consulta el estado de la matrícula ACTIVA de
 * StudentEnrollmentContextFacade (no la que adivina pickEnrollmentToShow() sola),
 * y resetea el step al step 1 cuando el alumno cambia de matrícula.
 */
describe('StudentPaymentFacade', () => {
  let facade: StudentPaymentFacade;
  let invokeSpy: ReturnType<typeof vi.fn>;

  function setup(opts: { dbId?: number | null; activeEnrollmentId?: number | null } = {}) {
    TestBed.resetTestingModule();
    invokeSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabaseSpy = {
      client: {
        functions: { invoke: invokeSpy },
      },
    };
    const mockAuth = {
      currentUser: vi.fn(() => (opts.dbId === null ? null : { dbId: opts.dbId ?? 7 })),
    };
    const mockContext = {
      initialize: vi.fn().mockResolvedValue(undefined),
      activeEnrollmentId: vi.fn(() => opts.activeEnrollmentId ?? 100),
    };

    TestBed.configureTestingModule({
      providers: [
        StudentPaymentFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: mockAuth },
        { provide: StudentEnrollmentContextFacade, useValue: mockContext },
      ],
    });

    return { facade: TestBed.inject(StudentPaymentFacade), mockContext };
  }

  beforeEach(() => {
    facade = setup().facade;
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('estado inicial: step 1, sin status ni enrollment', () => {
    expect(facade.step()).toBe(1);
    expect(facade.status()).toBeNull();
    expect(facade.enrollment()).toBeNull();
    expect(facade.isClassB()).toBe(false);
    expect(facade.payments()).toEqual([]);
  });

  it('goDirectToConfirm avanza directo al step de pago (3), sin pasar por horarios', () => {
    facade.goDirectToConfirm();
    expect(facade.step()).toBe(3);
  });

  it('backToSummary vuelve al step 1 (resumen)', () => {
    facade.goDirectToConfirm();
    expect(facade.step()).toBe(3);
    facade.backToSummary();
    expect(facade.step()).toBe(1);
  });

  it('resetError limpia el signal de error', () => {
    facade.resetError();
    expect(facade.error()).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────
  // spec-0034: la matrícula activa (no pickEnrollmentToShow()) manda
  // ────────────────────────────────────────────────────────────────────────

  it('initialize() envía el enrollmentId de la matrícula activa en el body del invoke', async () => {
    const { facade } = setup({ activeEnrollmentId: 42 });

    await facade.initialize();

    expect(invokeSpy).toHaveBeenCalledWith(
      'student-payment',
      expect.objectContaining({
        body: expect.objectContaining({ action: 'load-enrollment-status', enrollmentId: 42 }),
      }),
    );
  });

  it('al cambiar de matrícula activa, la siguiente carga pide el nuevo enrollmentId', async () => {
    const { facade, mockContext } = setup({ activeEnrollmentId: 42 });

    await facade.initialize();
    expect(invokeSpy).toHaveBeenLastCalledWith(
      'student-payment',
      expect.objectContaining({ body: expect.objectContaining({ enrollmentId: 42 }) }),
    );

    mockContext.activeEnrollmentId.mockReturnValue(99);
    void facade.initialize(); // ya inicializado → SWR refresh silencioso (fire-and-forget)
    await flushMicrotasks();

    expect(invokeSpy).toHaveBeenLastCalledWith(
      'student-payment',
      expect.objectContaining({ body: expect.objectContaining({ enrollmentId: 99 }) }),
    );
  });

  it('al cambiar de matrícula activa, el step vuelve a 1 (no arrastra el step de la anterior)', async () => {
    const { facade, mockContext } = setup({ activeEnrollmentId: 42 });

    await facade.initialize();
    facade.goDirectToConfirm();
    expect(facade.step()).toBe(3);

    mockContext.activeEnrollmentId.mockReturnValue(99);
    void facade.initialize();
    await flushMicrotasks();

    expect(facade.step()).toBe(1);
  });

  it('si la matrícula activa NO cambia entre cargas, el step no se resetea (sin regresión al revisitar)', async () => {
    const { facade } = setup({ activeEnrollmentId: 42 });

    await facade.initialize();
    facade.goDirectToConfirm();
    expect(facade.step()).toBe(3);

    void facade.initialize(); // revisita sin cambiar de matrícula (SWR refresh)
    await flushMicrotasks();

    expect(facade.step()).toBe(3);
  });
});
