import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PublicContractComponent } from './public-contract.component';

/**
 * Spec 0009-m — AC3: dos casillas separadas, ninguna premarcada, ambas obligatorias.
 *
 * ⚠️ **Sin renderizar el template a propósito.** El `vitest.config.ts` del proyecto no
 * incluye `@analogjs/vite-plugin-angular`, así que compilar templates rompe el TestBed del
 * resto de la suite — por eso los tests de DOM del repo están en `describe.skip` (ver
 * `alert-card.component.spec.ts:7-9`). Acá se instancia el componente en un contexto de
 * inyección y se verifica la **decisión**, que es lo que puede fallar: cuándo se habilita
 * avanzar. La verificación visual de las dos casillas va por `/verify` (T5.3).
 */
describe('PublicContractComponent — consentimiento (AC3)', () => {
  let component: PublicContractComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new PublicContractComponent());
  });

  // El consentimiento exige un ACTO AFIRMATIVO del titular (Art. 12). Una casilla
  // premarcada no es consentimiento, y es de los defectos que más se sancionan.
  it('ninguna casilla viene premarcada', () => {
    expect(component.termsAccepted()).toBe(false);
    expect(component.privacyAccepted()).toBe(false);
  });

  it('no se puede avanzar sin ninguna de las dos', () => {
    expect(component.consentsComplete()).toBe(false);
  });

  // El corazón del AC3: antes una sola casilla cubría ambas cosas. Aceptar el contrato
  // de matrícula NO puede arrastrar el consentimiento al tratamiento de datos.
  it('no basta aceptar los términos del contrato', () => {
    component.termsAccepted.set(true);
    expect(component.consentsComplete()).toBe(false);
  });

  it('no basta aceptar la política de privacidad', () => {
    component.privacyAccepted.set(true);
    expect(component.consentsComplete()).toBe(false);
  });

  it('con ambas marcadas se habilita el avance', () => {
    component.termsAccepted.set(true);
    component.privacyAccepted.set(true);
    expect(component.consentsComplete()).toBe(true);
  });

  // Los handlers `toggleTerms`/`togglePrivacy` no se testean acá: ambos llaman a
  // `clearSignature()`, que lee el `viewChild.required` del canvas y lanza NG0951 sin
  // template renderizado. Es una limitación del entorno de test, no del código — el
  // comportamiento (desmarcar una casilla borra la firma) se verifica con `/verify` (T5.3).
});
