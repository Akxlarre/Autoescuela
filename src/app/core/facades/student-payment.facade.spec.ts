import { TestBed } from '@angular/core/testing';

import { StudentPaymentFacade } from './student-payment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

/**
 * Spec de StudentPaymentFacade (fix-017).
 *
 * Desde fix-017 la facade es exclusivamente de pago: ya no gestiona selección de
 * horarios. Estos tests cubren sus decisiones reales: transiciones de paso,
 * estado inicial y computed derivados.
 */
describe('StudentPaymentFacade', () => {
  let facade: StudentPaymentFacade;

  beforeEach(() => {
    const supabaseSpy = {
      client: {
        functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
      },
    };

    TestBed.configureTestingModule({
      providers: [StudentPaymentFacade, { provide: SupabaseService, useValue: supabaseSpy }],
    });

    facade = TestBed.inject(StudentPaymentFacade);
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
});
