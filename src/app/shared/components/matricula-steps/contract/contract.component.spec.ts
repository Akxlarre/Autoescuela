import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ContractComponent } from './contract.component';

/**
 * Spec 0009-m — AC3/AC7 en el flujo de secretaría.
 *
 * ⚠️ Sin renderizar el template (ver `public-contract.component.spec.ts` para el motivo).
 * Lo que se verifica es la **decisión**: que el paso no avance sin el consentimiento al
 * tratamiento de datos, aunque el contrato firmado ya esté cargado.
 */
describe('ContractComponent — consentimiento (AC3)', () => {
  let component: ContractComponent;

  /** Simula los `input()` sin montar el componente. */
  function setInputs(opts: { canAdvance: boolean; isPublic?: boolean }) {
    (component as unknown as { data: unknown }).data = signal({
      canAdvance: opts.canAdvance,
      isMinor: false,
      privacyPolicyLabel: 'Declaro haber leído la Política de Privacidad.',
      privacyPolicyUrl: '/politica-privacidad/conductores-chillan',
    });
    (component as unknown as { isPublic: unknown }).isPublic = signal(opts.isPublic ?? false);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new ContractComponent());
  });

  it('la casilla de privacidad no viene premarcada', () => {
    expect(component._privacyAccepted()).toBe(false);
  });

  // El corazón del AC3 en este flujo: el contrato firmado a mano prueba la aceptación del
  // CONTRATO, no el consentimiento al tratamiento de datos. Son dos cosas distintas y la
  // ley exige que la segunda sea específica.
  it('con el contrato firmado pero sin consentimiento, NO se puede avanzar', () => {
    setInputs({ canAdvance: true });
    expect(component.canProceed()).toBe(false);
  });

  it('con consentimiento pero sin contrato firmado, tampoco', () => {
    setInputs({ canAdvance: false });
    component._privacyAccepted.set(true);
    expect(component.canProceed()).toBe(false);
  });

  it('con ambos se habilita el avance', () => {
    setInputs({ canAdvance: true });
    component._privacyAccepted.set(true);
    expect(component.canProceed()).toBe(true);
  });

  it('onPrivacyToggle actualiza el estado y emite para que el Smart lo persista', () => {
    setInputs({ canAdvance: true });
    let emitted: boolean | null = null;
    component.privacyConsentChange.subscribe((v) => (emitted = v));

    component.onPrivacyToggle(true);

    expect(component._privacyAccepted()).toBe(true);
    expect(emitted).toBe(true);
  });

  it('desmarcar vuelve a bloquear el avance', () => {
    setInputs({ canAdvance: true });
    component.onPrivacyToggle(true);
    component.onPrivacyToggle(false);

    expect(component.canProceed()).toBe(false);
  });
});
