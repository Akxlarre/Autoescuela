import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PoliticaPrivacidadComponent } from './politica-privacidad.component';

/**
 * Spec 0009-m — AC2: la política se resuelve por sede y es pública.
 *
 * Sin renderizar el template (limitación del `vitest.config.ts` del proyecto). Lo que se
 * verifica es la **decisión**: qué política sale para cada slug.
 */
function createWithSlug(branchSlug: string | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of({ get: () => branchSlug } as never) },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => new PoliticaPrivacidadComponent());
}

describe('PoliticaPrivacidadComponent (AC2)', () => {
  it('resuelve la política de Conductores Chillán', () => {
    const c = createWithSlug('conductores-chillan');

    expect(c.policy()?.legalName).toBe('Sociedad Comercial Chillán Capacita Limitada');
    expect(c.policy()?.rut).toBe('77.940.120-0');
    expect(c.policy()?.rightsEmail).toBe('conductorchillan@gmail.com');
  });

  // Cada sede es un responsable distinto ante la Agencia: servir la política equivocada
  // sería declararle al titular que sus datos los trata otra empresa.
  it('resuelve la política de Autoescuela Chillán, que es otra sociedad', () => {
    const c = createWithSlug('autoescuela-chillan');

    expect(c.policy()?.legalName).toBe('Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL');
    expect(c.policy()?.rut).toBe('76.007.217-6');
    expect(c.policy()?.rightsEmail).toBe('otecchillan@gmail.com');
  });

  it('slug inexistente → null, para mostrar el mensaje de ayuda y no una pantalla en blanco', () => {
    expect(createWithSlug('no-existe').policy()).toBeNull();
  });

  it('slug ausente → null', () => {
    expect(createWithSlug(null).policy()).toBeNull();
  });

  it('ofrece las dos sedes como alternativa cuando el slug no resuelve', () => {
    const c = createWithSlug('no-existe');

    expect(c.knownSlugs.map((s) => s.slug).sort()).toEqual([
      'autoescuela-chillan',
      'conductores-chillan',
    ]);
  });

  it('expone la versión de política que se persiste en los consentimientos (AC-E4)', () => {
    expect(createWithSlug('conductores-chillan').version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
