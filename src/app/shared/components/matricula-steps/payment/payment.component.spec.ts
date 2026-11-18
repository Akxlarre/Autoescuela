import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrencyPipe } from '@angular/common';
import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentComponent } from './payment.component';
import type { EnrollmentPaymentData } from '@core/models/ui/enrollment-payment.model';

/**
 * hotfix-088-m — appliedDiscountLabel debe mostrar el % o monto fijo del descuento
 * predefinido, no solo su nombre. Sin renderizar el template.
 */
describe('PaymentComponent — appliedDiscountLabel (hotfix-088-m)', () => {
  let component: PaymentComponent;

  function setData(overrides: Partial<EnrollmentPaymentData>) {
    (component as unknown as { data: unknown }).data = signal({
      studentSummary: {} as EnrollmentPaymentData['studentSummary'],
      pricing: { amountDue: 100000 } as EnrollmentPaymentData['pricing'],
      discount: { enabled: true, amount: 20000, reason: 'Promoción fin de agosto' },
      totalToPay: 80000,
      paymentMethod: null,
      availableDiscounts: [],
      selectedDiscountId: null,
      isSingularCourse: false,
      singularAlert: { visible: false, message: '' },
      documentNumber: null,
      canAdvance: false,
      ...overrides,
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new PaymentComponent());
  });

  it('para un descuento predefinido de porcentaje, agrega el % al nombre', () => {
    setData({
      selectedDiscountId: 1,
      availableDiscounts: [
        { id: 1, name: 'Promoción fin de agosto', discountType: 'percentage', value: 20 },
      ],
    });
    expect(component.appliedDiscountLabel()).toBe('Promoción fin de agosto (20%)');
  });

  it('para un descuento predefinido de monto fijo, agrega el monto formateado', () => {
    setData({
      selectedDiscountId: 2,
      availableDiscounts: [
        { id: 2, name: 'Descuento fijo', discountType: 'fixed_amount', value: 15000 },
      ],
    });
    expect(component.appliedDiscountLabel()).toBe('Descuento fijo ($15.000)');
  });

  it('para un descuento manual (sin selectedDiscountId), usa el reason tal cual', () => {
    setData({
      selectedDiscountId: null,
      discount: { enabled: true, amount: 5000, reason: 'Regalo cumpleaños' },
    });
    expect(component.appliedDiscountLabel()).toBe('Regalo cumpleaños');
  });
});

// Vitest compila en JIT sin el plugin de Angular: no resuelve `templateUrl` ni reconoce `input()`.
// Por eso los hijos son dobles con inputs simples, y `data` se asigna como signal en `render()`.
@Component({ selector: 'app-icon', template: '', inputs: ['name', 'size'] })
class IconStub {}

@Component({
  selector: 'app-empty-state',
  template: `{{ message }}
    <button type="button" data-llm-action="ejecutar-accion-empty-state" (click)="action.emit()">
      {{ actionLabel }}
    </button>`,
  inputs: ['message', 'subtitle', 'icon', 'actionLabel', 'actionIcon'],
  outputs: ['action'],
})
class EmptyStateStub {
  message = '';
  actionLabel = '';
  action = output<void>();
}

@Component({
  selector: 'app-alert-card',
  template: `{{ title }} <ng-content />`,
  inputs: ['severity', 'title'],
})
class AlertCardStub {
  title = '';
}

@Component({ selector: 'app-skeleton-block', template: '', inputs: ['variant', 'width', 'height'] })
class SkeletonStub {}

@Component({
  selector: 'app-async-btn',
  template: '',
  inputs: ['label', 'icon', 'loading', 'disabled'],
})
class AsyncBtnStub {}

/**
 * spec 0060-b (T1.5): una lectura fallida del paso Pago se ve como error, nunca como un monto.
 * Se compila la plantilla real, leída del disco.
 */
describe('PaymentComponent — lecturas fallidas (spec 0060-b T1.5)', () => {
  let fixture: ComponentFixture<PaymentComponent>;

  const base: EnrollmentPaymentData = {
    studentSummary: {} as EnrollmentPaymentData['studentSummary'],
    pricing: {
      courseLabel: 'Clase B',
      practicalClassesIncluded: 12,
      basePrice: 200000,
      isDeposit: false,
      amountDue: 200000,
    },
    discount: { enabled: false, amount: null, reason: '' },
    totalToPay: 200000,
    paymentMethod: null,
    availableDiscounts: [],
    selectedDiscountId: null,
    isSingularCourse: false,
    singularAlert: { visible: false, message: '' },
    documentNumber: null,
    canAdvance: false,
    paymentDataError: null,
    paymentDataLoading: false,
    discountsError: null,
    discountsLoading: false,
  };

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

  function render(overrides: Partial<EnrollmentPaymentData>) {
    (fixture.componentInstance as unknown as { data: unknown }).data = signal({
      ...base,
      ...overrides,
    });
    fixture.detectChanges();
  }

  beforeEach(() => {
    const template = readFileSync(resolve(__dirname, 'payment.component.html'), 'utf-8');
    TestBed.overrideComponent(PaymentComponent, {
      set: {
        template,
        templateUrl: undefined,
        styleUrl: undefined,
        styleUrls: [],
        imports: [
          FormsModule,
          CurrencyPipe,
          IconStub,
          EmptyStateStub,
          AlertCardStub,
          SkeletonStub,
          AsyncBtnStub,
        ],
      },
    });
    fixture = TestBed.createComponent(PaymentComponent);
  });

  it('sin datos del pago muestra el error con Reintentar y ningún monto', () => {
    render({ paymentDataError: 'No se pudieron cargar los datos del pago.' });

    expect(texto()).toContain('No se pudieron cargar los datos del pago.');
    expect(texto()).not.toContain('Total Final a Pagar');
    expect(texto()).not.toContain('Selecciona el Método de Pago');

    const emitido = vi.fn();
    fixture.componentInstance.retryPaymentData.subscribe(emitido);
    q('app-empty-state button[data-llm-action]')!.click();
    expect(emitido).toHaveBeenCalledTimes(1);
  });

  it('mientras reintenta no muestra montos', () => {
    render({ paymentDataLoading: true });
    expect(texto()).not.toContain('Total Final a Pagar');
    expect(q('app-skeleton-block')).not.toBeNull();
  });

  it('con los datos cargados muestra el resumen', () => {
    render({});
    expect(texto()).toContain('Total Final a Pagar');
    expect(q('app-empty-state')).toBeNull();
  });

  it('distingue "no cargaron los descuentos" y ofrece Reintentar', () => {
    render({ discountsError: 'No se pudieron cargar los descuentos.' });

    expect(texto()).toContain('No se pudieron cargar los descuentos');
    expect(texto()).toContain('Puedes continuar sin descuento');

    const emitido = vi.fn();
    fixture.componentInstance.retryDiscounts.subscribe(emitido);
    q('[data-llm-action="reintentar-descuentos"]')!.click();
    expect(emitido).toHaveBeenCalledTimes(1);
  });

  it('sin descuentos y sin error no muestra ningún aviso', () => {
    render({});
    expect(q('[data-llm-action="reintentar-descuentos"]')).toBeNull();
    expect(texto()).toContain('Aplica un descuento manual');
  });

  it('con un descuento predefinido aplicado explica por qué no puede continuar', () => {
    render({
      discountsError: 'No se pudieron cargar los descuentos.',
      selectedDiscountId: 3,
      discount: { enabled: true, amount: 10000, reason: 'Hermanos' },
    });

    expect(texto()).toContain('Reintenta o quita el descuento');
    expect(q('[data-llm-action="reintentar-descuentos"]')).not.toBeNull();
  });

  it('mientras cargan los descuentos lo dice, sin presentar la lista como vacía', () => {
    render({ discountsLoading: true });
    expect(texto()).toContain('Cargando descuentos');
    expect(texto()).not.toContain('Aplica un descuento manual al monto');
  });
});
