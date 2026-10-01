import { TestBed } from '@angular/core/testing';
import { isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { LoginComponent } from './login.component';
import loginSource from './login.component.ts?raw';
import { AuthFacade } from '@core/facades/auth.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// ─── hotfix-007-i (ASG-i-039): las credenciales de prueba solo existen en desarrollo
// (`ng serve`); el build de producción no debe mostrarlas ni incluirlas en el JS desplegado.
// Los tests de plantilla renderizada no están soportados en este repo (ver vitest.config.ts),
// así que se verifica el estado del componente y la forma del código fuente. ───
describe('LoginComponent — credenciales de prueba (hotfix-007-i)', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthFacade, useValue: { login: vi.fn(), resetPassword: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: GsapAnimationsService, useValue: { animateHero: vi.fn() } },
        { provide: ErrorSanitizerService, useValue: { sanitize: vi.fn() } },
      ],
    });
    return TestBed.createComponent(LoginComponent).componentInstance;
  }

  it('en desarrollo el recuadro se habilita y trae las cuentas y la contraseña', () => {
    const component = setup();

    expect(isDevMode()).toBe(true);
    expect(component.showTestCredentials()).toBe(true);
    expect((component as unknown as { testAccounts: string[] }).testAccounts).toContain(
      'secretaria@test.com',
    );
    expect((component as unknown as { testPassword: string }).testPassword).not.toBe('');
  });

  it('el recuadro solo se renderiza dentro de @if (showTestCredentials())', () => {
    const open = loginSource.indexOf('@if (showTestCredentials()) {');
    const marker = loginSource.indexOf('aria-label="Credenciales de prueba disponibles"');

    expect(open).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(open);
  });

  it('las cuentas y la contraseña solo existen detrás de ngDevMode (no viajan en el bundle de producción)', () => {
    const literalLines = loginSource
      .split('\n')
      .filter((line) => line.includes('Test123456') || line.includes('@test.com'));
    const guardStart = loginSource.indexOf('typeof ngDevMode');
    const guardedChunk = loginSource.slice(guardStart, loginSource.indexOf('/**', guardStart));

    expect(guardStart).toBeGreaterThan(-1);
    expect(literalLines.length).toBeGreaterThan(0);
    for (const line of literalLines) {
      expect(guardedChunk).toContain(line.trim());
    }
  });
});
