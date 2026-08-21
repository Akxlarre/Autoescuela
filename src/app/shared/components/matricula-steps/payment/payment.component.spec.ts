import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
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
