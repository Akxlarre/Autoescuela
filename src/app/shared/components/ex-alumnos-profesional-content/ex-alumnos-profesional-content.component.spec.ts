import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ExAlumnosProfesionalContentComponent } from './ex-alumnos-profesional-content.component';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';

function makeEgresado(overrides: Partial<EgresadoTableRow> = {}): EgresadoTableRow {
  return {
    id: 1,
    studentId: 's1',
    nombre: 'Rosa Díaz',
    rut: '11.111.111-1',
    correo: 'rosa@test.com',
    nroExpediente: 'PRO-001',
    licencia: 'A2',
    licenseGroup: 'professional',
    anio: 2026,
    fechaEgreso: '2026-08-01',
    sede: 'Chillán',
    branchId: 1,
    nroCertificado: null,
    saldoPendiente: 0,
    ...overrides,
  };
}

describe('ExAlumnosProfesionalContentComponent', () => {
  let component: ExAlumnosProfesionalContentComponent;

  const stubInput = <T>(name: string, initial: T) => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  function setup(egresados: EgresadoTableRow[]): void {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new ExAlumnosProfesionalContentComponent());
    stubInput('egresados', egresados);
    stubInput('isLoading', false);
    stubInput('backRoute', '/app/admin/clase-profesional/alumnos');
    stubInput('basePath', '/app/admin');
  }

  it('con error y sin egresados activa showLoadError y oculta heroKpis (no dice 0)', () => {
    setup([]);
    stubInput('error', 'Error al cargar egresados');

    expect((component as any).showLoadError()).toBe(true);
    expect(component.heroKpis()).toEqual([]);
  });

  it('en Caso B (refreshFailed con egresados en pantalla) conserva los datos y heroKpis', () => {
    setup([makeEgresado({ id: 1, saldoPendiente: 10000 })]);
    stubInput('error', null);
    stubInput('refreshFailed', true);

    expect((component as any).showLoadError()).toBe(false);
    expect(component.heroKpis().find((k) => k.id === 'total')?.value).toBe(1);
  });

  it('expone refreshRequested para reintentar desde Caso A o Caso B', () => {
    setup([]);
    let count = 0;
    (component as any).refreshRequested.subscribe(() => count++);
    (component as any).refreshRequested.emit();
    expect(count).toBe(1);
  });
});

describe('ExAlumnosProfesionalContentComponent — layout Caso B en fill-screen (spec 0060-b T3.6)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('el aviso de Caso B vive dentro de .bento-fill y no como hijo directo de .bento-grid', () => {
    TestBed.configureTestingModule({
      imports: [ExAlumnosProfesionalContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn(), animateHero: vi.fn(), addCardHover: vi.fn() },
        },
      ],
    }).overrideComponent(ExAlumnosProfesionalContentComponent, {
      set: {
        imports: [CurrencyPipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(ExAlumnosProfesionalContentComponent);
    const component = fixture.componentInstance;
    Object.defineProperty(component, 'egresados', { value: signal([makeEgresado()]) });
    Object.defineProperty(component, 'backRoute', {
      value: signal('/app/admin/clase-profesional/alumnos'),
    });
    Object.defineProperty(component, 'basePath', { value: signal('/app/admin') });
    Object.defineProperty(component, 'refreshFailed', { value: signal(true) });
    fixture.detectChanges();

    const alertCard = fixture.nativeElement.querySelector('app-alert-card') as HTMLElement | null;
    expect(alertCard).not.toBeNull();
    expect(alertCard?.closest('.bento-fill')).not.toBeNull();
    expect(alertCard?.parentElement?.classList.contains('bento-grid')).toBe(false);
    expect(fixture.nativeElement.querySelector('.bento-grid > [role="alert"]')).toBeNull();
  });
});
