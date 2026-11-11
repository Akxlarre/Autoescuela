import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
