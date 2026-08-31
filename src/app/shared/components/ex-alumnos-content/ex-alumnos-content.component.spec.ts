import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExAlumnosContentComponent } from './ex-alumnos-content.component';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';

function makeEgresado(overrides: Partial<EgresadoTableRow> = {}): EgresadoTableRow {
  return {
    id: 1,
    studentId: 's1',
    nombre: 'Juan Pérez',
    rut: '11.111.111-1',
    correo: 'juan@test.com',
    nroExpediente: '#0001',
    licencia: 'B',
    licenseGroup: 'class_b',
    anio: 2026,
    fechaEgreso: '2026-08-01',
    sede: 'Chillán',
    branchId: 5,
    nroCertificado: null,
    saldoPendiente: 0,
    ...overrides,
  };
}

/**
 * Dumb component (shared/): no inyecta ExAlumnosFacade ni ningún otro Facade/Service
 * (el Architect Guard lo prohíbe) — recibe `egresados` por input.required(). Los signal
 * inputs no son escribibles en esta infra (JIT sin el transform de initializer APIs) —
 * mismo patrón que `pre-inscritos-content.component.spec.ts`: se stubean con signal()
 * locales vía Object.defineProperty, sin renderizar el template.
 */
describe('ExAlumnosContentComponent', () => {
  let component: ExAlumnosContentComponent;

  const stubInput = <T>(name: string, initial: T) => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  function setup(egresados: EgresadoTableRow[]): void {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new ExAlumnosContentComponent());
    stubInput('egresados', egresados);
    stubInput('isLoading', false);
    stubInput('basePath', '/app/secretaria');
  }

  describe('filteredEgresados — búsqueda ignora el período (AC6, ASG-b-087)', () => {
    it('con búsqueda activa, encuentra un egresado aunque esté fuera de la ventana de período', () => {
      setup([
        makeEgresado({ id: 1, nombre: 'Camila Antigua', fechaEgreso: '2020-01-01' }),
        makeEgresado({ id: 2, nombre: 'Pedro Reciente', fechaEgreso: '2026-08-01' }),
      ]);
      (component as any).searchTerm.set('Camila');
      const results = (component as any).filteredEgresados();
      expect(results.map((e: EgresadoTableRow) => e.id)).toEqual([1]);
    });

    it('sin búsqueda activa, la ventana de período (default last-12-months) filtra la lista', () => {
      setup([
        makeEgresado({ id: 1, nombre: 'Camila Antigua', fechaEgreso: '2020-01-01' }),
        makeEgresado({ id: 2, nombre: 'Pedro Reciente', fechaEgreso: '2026-08-01' }),
      ]);
      const results = (component as any).filteredEgresados();
      expect(results.map((e: EgresadoTableRow) => e.id)).toEqual([2]);
    });

    it('filtra por RUT y por Nº de expediente además de nombre', () => {
      setup([
        makeEgresado({ id: 1, rut: '22.222.222-2', nroExpediente: '#0099' }),
        makeEgresado({ id: 2, rut: '33.333.333-3', nroExpediente: '#0002' }),
      ]);
      (component as any).searchTerm.set('0099');
      expect((component as any).filteredEgresados().map((e: EgresadoTableRow) => e.id)).toEqual([
        1,
      ]);
    });
  });

  describe('paginación mobile (mismo patrón que alumnos-list-content)', () => {
    it('visibleCards respeta el presupuesto inicial (CARDS_STEP)', () => {
      setup(Array.from({ length: 10 }, (_, i) => makeEgresado({ id: i })));
      expect((component as any).visibleCards().length).toBe(6);
      expect((component as any).remainingCards()).toBe(4);
    });

    it('loadMoreCards incrementa el presupuesto en CARDS_STEP', () => {
      setup(Array.from({ length: 10 }, (_, i) => makeEgresado({ id: i })));
      (component as any).loadMoreCards();
      expect((component as any).visibleCards().length).toBe(10);
      expect((component as any).remainingCards()).toBe(0);
    });
  });

  describe('reEnroll — el Dumb solo emite, no orquesta confirm/navegación/drawer', () => {
    it('requestReEnroll emite reEnrollRequested con el egresado completo', () => {
      setup([makeEgresado({ id: 1, branchId: 42 })]);
      const emitted: EgresadoTableRow[] = [];
      component.reEnrollRequested.subscribe((e) => emitted.push(e));

      const egresado = (component as any).egresados()[0];
      (component as any).requestReEnroll(egresado);

      expect(emitted).toEqual([egresado]);
    });
  });

  describe('heroChips/heroKpis — derivados de egresados() (sin Facade)', () => {
    it('heroKpis cuenta el total y los que tienen deuda pendiente', () => {
      setup([
        makeEgresado({ id: 1, saldoPendiente: 0 }),
        makeEgresado({ id: 2, saldoPendiente: 50000 }),
        makeEgresado({ id: 3, saldoPendiente: 10000 }),
      ]);
      const kpis = (component as any).heroKpis();
      expect(kpis.find((k: any) => k.id === 'total').value).toBe(3);
      expect(kpis.find((k: any) => k.id === 'deuda').value).toBe(2);
    });
  });

  describe('clearFilters', () => {
    it('resetea búsqueda, período y paginación mobile a su estado inicial', () => {
      setup(Array.from({ length: 10 }, (_, i) => makeEgresado({ id: i })));
      (component as any).searchTerm.set('algo');
      (component as any).loadMoreCards();

      (component as any).clearFilters();

      expect((component as any).searchTerm()).toBe('');
      expect((component as any).visibleCards().length).toBe(6);
    });
  });
});
