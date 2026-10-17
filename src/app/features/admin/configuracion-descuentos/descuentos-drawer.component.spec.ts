import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DescuentosDrawerComponent } from './descuentos-drawer.component';
import { DiscountsFacade } from '@core/facades/discounts.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// fix-056-i: un descuento con "Vigente hasta" anterior a "Vigente desde" se guardaba y nunca
// aparecía en el paso de pago.
describe('DescuentosDrawerComponent — vigencia (fix-056-i)', () => {
  let component: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DescuentosDrawerComponent,
        {
          provide: DiscountsFacade,
          useValue: {
            loadDiscounts: vi.fn().mockResolvedValue(undefined),
            loadProfessionalCourses: vi.fn().mockResolvedValue(undefined),
            isSaving: signal(false),
          },
        },
        { provide: BranchFacade, useValue: { branches: signal([]) } },
        { provide: LayoutDrawerFacadeService, useValue: { back: vi.fn() } },
      ],
    });
    component = TestBed.inject(DescuentosDrawerComponent);
    component.formName.set('Beca');
    component.formValue.set(10);
    component.formValidFrom.set('2026-10-10');
  });

  it('"hasta" anterior a "desde" no deja guardar', () => {
    component.formValidUntil.set('2026-10-01');
    expect(component.vigenciaInvalida()).toBe(true);
    expect(component.canSave()).toBe(false);
  });

  it('"hasta" vacío (sin vencimiento) sí deja guardar', () => {
    component.formValidUntil.set(null);
    expect(component.vigenciaInvalida()).toBe(false);
    expect(component.canSave()).toBe(true);
  });

  it('"hasta" igual a "desde" sí deja guardar (vigente un solo día)', () => {
    component.formValidUntil.set('2026-10-10');
    expect(component.vigenciaInvalida()).toBe(false);
    expect(component.canSave()).toBe(true);
  });
});
