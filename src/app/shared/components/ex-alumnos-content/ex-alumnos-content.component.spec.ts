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

  describe('showLoadError (fix-287-m)', () => {
    it('con error y sin egresados muestra el error en vez de la lista vacía', () => {
      setup([]);
      stubInput('error', 'Error al cargar');

      expect(component.showLoadError()).toBe(true);
    });

    it('con error pero con egresados ya cargados los sigue mostrando (SWR)', () => {
      setup([makeEgresado()]);
      stubInput('error', 'Error al cargar');

      expect(component.showLoadError()).toBe(false);
    });

    it('sin error una lista vacía es una lista vacía', () => {
      setup([]);

      expect(component.showLoadError()).toBe(false);
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

  describe('requestExport — exporta lo que se ve (spec 0021-m)', () => {
    it('emite el formato y las filas filtradas por la búsqueda, completas y en su orden', () => {
      setup([
        makeEgresado({ id: 1, nombre: 'Reyes Camila' }),
        makeEgresado({ id: 2, nombre: 'Soto Andy' }),
        makeEgresado({ id: 3, nombre: 'Reyes Pedro' }),
      ]);
      const emitted: { format: string; rows: EgresadoTableRow[] }[] = [];
      component.exportRequested.subscribe((req) => emitted.push(req));
      (component as any).searchTerm.set('reyes');

      (component as any).requestExport('excel');

      expect(emitted).toHaveLength(1);
      expect(emitted[0].format).toBe('excel');
      expect(emitted[0].rows.map((r) => r.id)).toEqual([1, 3]);
    });

    it('no se limita a la página visible: van todas las filas del filtro', () => {
      setup(Array.from({ length: 25 }, (_, i) => makeEgresado({ id: i })));
      const emitted: { rows: EgresadoTableRow[] }[] = [];
      component.exportRequested.subscribe((req) => emitted.push(req));

      (component as any).requestExport('pdf');

      expect(emitted[0].rows).toHaveLength(25);
    });
  });

  describe('orden por columna (spec 0023-m)', () => {
    const rows = () => [
      makeEgresado({ id: 1, nombre: 'Soto Andy' }),
      makeEgresado({ id: 2, nombre: 'Ávila Camila' }),
      makeEgresado({ id: 3, nombre: 'Reyes Pedro' }),
    ];
    const ids = () => (component as any).sortedEgresados().map((e: EgresadoTableRow) => e.id);

    it('clic en el título cicla ascendente → descendente → orden por defecto', () => {
      setup(rows());
      (component as any).toggleSort('alumno');
      expect(ids()).toEqual([2, 3, 1]);
      (component as any).toggleSort('alumno');
      expect(ids()).toEqual([1, 3, 2]);
      (component as any).toggleSort('alumno');
      expect(ids()).toEqual([1, 2, 3]);
      expect((component as any).sort()).toBeNull();
    });

    it('cambiar el orden vuelve la tabla a la primera página', () => {
      setup(rows());
      (component as any).tableFirst.set(10);
      (component as any).toggleSort('rut');
      expect((component as any).tableFirst()).toBe(0);
    });

    it('la exportación sale en el orden de la pantalla', () => {
      setup(rows());
      const emitted: { rows: EgresadoTableRow[] }[] = [];
      component.exportRequested.subscribe((req) => emitted.push(req));
      (component as any).toggleSort('alumno');

      (component as any).requestExport('excel');

      expect(emitted[0].rows.map((r) => r.id)).toEqual([2, 3, 1]);
    });

    it('limpiar filtros conserva el orden elegido', () => {
      setup(rows());
      (component as any).toggleSort('alumno');
      (component as any).clearFilters();
      expect((component as any).sort()).toEqual({ field: 'alumno', direction: 'asc' });
    });
  });

  describe('buscar o cambiar el período vuelve a la página 1 y a 6 tarjetas (fix-283-m)', () => {
    it('la búsqueda reinicia tabla y tarjetas', () => {
      setup(Array.from({ length: 30 }, (_, i) => makeEgresado({ id: i })));
      (component as any).tableFirst.set(20);
      (component as any).loadMoreCards();

      (component as any).onSearch('Juan');

      expect((component as any).searchTerm()).toBe('Juan');
      expect((component as any).tableFirst()).toBe(0);
      expect((component as any).visibleCards().length).toBe(6);
    });

    it('cambiar el período también', () => {
      setup(Array.from({ length: 30 }, (_, i) => makeEgresado({ id: i })));
      (component as any).tableFirst.set(10);

      (component as any).onPeriodChange('all');

      expect((component as any).periodWindow()).toBe('all');
      expect((component as any).tableFirst()).toBe(0);
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

  describe('hasActiveFilters — botón "Limpiar filtros" (spec 0022-m)', () => {
    it('sin búsqueda y con el período inicial no hay filtros activos', () => {
      expect((component as any).hasActiveFilters()).toBe(false);
    });

    it('la búsqueda o un período distinto del inicial lo activan', () => {
      (component as any).searchTerm.set('ana');
      expect((component as any).hasActiveFilters()).toBe(true);

      (component as any).searchTerm.set('');
      (component as any).periodWindow.set('all');
      expect((component as any).hasActiveFilters()).toBe(true);

      (component as any).clearFilters();
      expect((component as any).hasActiveFilters()).toBe(false);
    });
  });
});
