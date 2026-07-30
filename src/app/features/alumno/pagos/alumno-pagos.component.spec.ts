import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { AlumnoPagosComponent } from './alumno-pagos.component';
import { StudentPaymentFacade } from '@core/facades/student-payment.facade';
import type { StudentPaymentEnrollmentInfo } from '@core/models/ui/student-payment.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEnrollment(
  overrides: Partial<StudentPaymentEnrollmentInfo> = {},
): StudentPaymentEnrollmentInfo {
  return {
    id: 1,
    number: '0008',
    courseName: 'Clase B',
    branchName: 'Sede Centro',
    branchId: 1,
    basePrice: 180000,
    pendingBalance: 90000,
    totalPaid: 90000,
    licenseGroup: 'class_b',
    ...overrides,
  };
}

function makeFacadeMock(enrollment: StudentPaymentEnrollmentInfo | null) {
  return {
    enrollment: vi.fn(() => enrollment),
    isClassB: vi.fn(() => enrollment?.licenseGroup === 'class_b'),
    status: vi.fn(() => (enrollment ? { hasPaymentPending: enrollment.pendingBalance > 0 } : null)),
    payments: signal([]),
    isLoading: signal(false),
    error: signal<string | null>(null),
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

function setup(enrollment: StudentPaymentEnrollmentInfo | null) {
  const facadeMock = makeFacadeMock(enrollment);

  TestBed.configureTestingModule({
    imports: [AlumnoPagosComponent],
    providers: [provideRouter([]), { provide: StudentPaymentFacade, useValue: facadeMock }],
  });

  return TestBed.createComponent(AlumnoPagosComponent).componentInstance;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AlumnoPagosComponent — heroSubtitle (regresión H-036)', () => {
  it('mientras enrollment() es null (carga inicial) muestra texto neutro, no el de Profesional', () => {
    const component = setup(null);
    expect(component['heroSubtitle']()).toBe('Cargando información de tu matrícula…');
  });

  it('con matrícula Clase B y saldo pendiente muestra el subtítulo de Clase B', () => {
    const component = setup(makeEnrollment({ licenseGroup: 'class_b', pendingBalance: 90000 }));
    expect(component['heroSubtitle']()).toBe('Paga tu saldo pendiente para completar tu matrícula');
  });

  it('con matrícula Profesional y saldo pendiente muestra el aviso de regularizar en secretaría', () => {
    const component = setup(
      makeEnrollment({ licenseGroup: 'professional', pendingBalance: 50000 }),
    );
    expect(component['heroSubtitle']()).toBe('Regulariza tu pago directamente en la secretaría');
  });

  it('con matrícula Profesional sin saldo pendiente muestra el resumen genérico', () => {
    const component = setup(makeEnrollment({ licenseGroup: 'professional', pendingBalance: 0 }));
    expect(component['heroSubtitle']()).toBe('Resumen de pagos de tu matrícula profesional');
  });
});
