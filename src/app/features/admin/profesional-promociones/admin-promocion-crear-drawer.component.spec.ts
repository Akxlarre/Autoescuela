import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminPromocionCrearDrawerComponent } from './admin-promocion-crear-drawer.component';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

describe('AdminPromocionCrearDrawerComponent — número obligatorio y lunes libres (fix-323-m)', () => {
  let facadeSpy: any;

  function create(): any {
    return TestBed.createComponent(AdminPromocionCrearDrawerComponent).componentInstance as any;
  }

  /** Deja el formulario completo salvo lo que cada test cambie. */
  function filled(code: string): any {
    const c = create();
    c.selectedStartDate.set('2026-10-12');
    c.endDate.set('2026-11-14');
    c.code.set(code);
    return c;
  }

  beforeEach(() => {
    facadeSpy = {
      promociones: signal([{ id: 1, startDate: '2026-10-19', status: 'planned' }]),
      professionalCourses: signal([]),
      relatoresDisponibles: signal([]),
      holidaysCheckFailed: signal(false),
      isSubmitting: signal(false),
      loadRelatoresDisponibles: vi.fn(),
      loadProfessionalCourses: vi.fn(),
      previewEndDate: vi.fn().mockResolvedValue('2026-11-14'),
      suggestNextCode: vi.fn().mockResolvedValue('281'),
      fetchMaxPromotionCode: vi.fn().mockResolvedValue(280),
      crearPromocion: vi.fn().mockResolvedValue(true),
      initialize: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [AdminPromocionCrearDrawerComponent],
      providers: [
        { provide: PromocionesFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    });
  });

  it('precarga el número con el siguiente sugerido', async () => {
    const c = create();
    await Promise.resolve();
    await Promise.resolve();
    expect(c.code()).toBe('281');
  });

  it('número vacío o con letras → no se puede crear', () => {
    expect(filled('').canSubmit()).toBe(false);
    expect(filled('28a').canSubmit()).toBe(false);
  });

  // fix-347-m (D19)
  it('número 0 o más de 10 por sobre el último usado → no se puede crear, con mensaje', async () => {
    expect(filled('0').canSubmit()).toBe(false);
    const c = filled('2810');
    await Promise.resolve();
    await Promise.resolve();
    expect(c.canSubmit()).toBe(false);
    expect(c.codeError()).toBe('No puede ser mayor que 290: el último número usado es 280.');
    c.code.set('290');
    expect(c.canSubmit()).toBe(true);
  });

  it('número válido + lunes + fecha de término → se puede crear', () => {
    expect(filled('281').canSubmit()).toBe(true);
  });

  it('el nombre lleva el número, igual que las promociones automáticas', () => {
    expect(filled('281').nombre()).toBe('Promoción 281 (12 de Octubre 2026)');
  });

  it('un lunes que ya tiene promoción queda ocupado', () => {
    const c = create();
    expect(c.isTaken('2026-10-19')).toBe(true);
    expect(c.isTaken('2026-10-12')).toBe(false);
  });

  it('crear envía el número', async () => {
    const c = filled(' 281 ');
    await c.submit();
    expect(facadeSpy.crearPromocion).toHaveBeenCalledWith(
      expect.objectContaining({ code: '281', name: 'Promoción 281 (12 de Octubre 2026)' }),
    );
  });
});
