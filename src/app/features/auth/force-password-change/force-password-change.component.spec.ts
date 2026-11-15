import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ForcePasswordChangeComponent } from './force-password-change.component';
import source from './force-password-change.component.ts?raw';
import { AuthFacade } from '@core/facades/auth.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// Los tests de plantilla renderizada no están soportados en este repo (ver vitest.config.ts):
// se verifica el estado del componente y la forma del código fuente.
describe('ForcePasswordChangeComponent — cuenta y encabezado (fix-181-b)', () => {
  function setup(mode: 'recovery' | undefined, email: string | null) {
    TestBed.configureTestingModule({
      imports: [ForcePasswordChangeComponent],
      providers: [
        {
          provide: AuthFacade,
          useValue: {
            currentUser: signal(email === null ? null : { name: 'Ana Pérez', email, rut: null }),
            completePasswordRecovery: vi.fn(),
            updatePassword: vi.fn(),
            logout: vi.fn(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: mode ? { mode } : {} } } },
        { provide: GsapAnimationsService, useValue: { animateHero: vi.fn() } },
        { provide: ErrorSanitizerService, useValue: { sanitize: vi.fn() } },
      ],
    });
    return TestBed.createComponent(ForcePasswordChangeComponent).componentInstance;
  }

  // F7 (D10): quien abre el enlace tiene que saber de qué cuenta está cambiando la clave.
  it('en la recuperación muestra el correo de la cuenta', () => {
    const component = setup('recovery', 'ana@escuela.cl');
    expect(component.isRecovery).toBe(true);
    expect(component.accountEmail()).toBe('ana@escuela.cl');
  });

  it('en el primer ingreso también muestra el correo de la cuenta', () => {
    const component = setup(undefined, 'ana@escuela.cl');
    expect(component.isRecovery).toBe(false);
    expect(component.accountEmail()).toBe('ana@escuela.cl');
  });

  it('sin usuario cargado no muestra cuenta', () => {
    const component = setup('recovery', null);
    expect(component.accountEmail()).toBe('');
  });

  // F8: la marca iba al lado del ícono (los dos inline-flex) y se pisaban.
  it('la marca va arriba en su propio bloque, antes del ícono', () => {
    const brand = source.indexOf('<app-product-brand');
    const icon = source.indexOf('[name]="copy.icon"');
    const blockBeforeBrand = source.lastIndexOf('<div', brand);

    expect(brand).toBeGreaterThan(-1);
    expect(icon).toBeGreaterThan(brand);
    // El bloque que envuelve la marca se cierra antes de que empiece el ícono.
    expect(source.indexOf('</div>', brand)).toBeLessThan(icon);
    expect(blockBeforeBrand).toBeGreaterThan(source.indexOf('mb-8 text-center'));
  });
});
