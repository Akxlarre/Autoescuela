import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { AlumnoListFilters, AlumnoTableRow } from '@core/models/ui/alumno-table-row.model';
import { AlumnosListContentComponent } from './alumnos-list-content.component';

function row(id: string, overrides: Partial<AlumnoTableRow> = {}): AlumnoTableRow {
  return {
    id,
    nombre: 'Ana',
    apellido: 'Pérez',
    rut: '11.111.111-1',
    email: '',
    celular: '',
    sucursal: 'Sede A',
    comuna: '',
    nroExpedientes: ['100'],
    fechaIngreso: '01-01-2026',
    fechaIngresoIso: '2026-01-01T12:00:00Z',
    status: 'Activo',
    cursos: [{ nombre: 'Clase B', licenseGroup: 'class_b' }],
    pago_por_pagar: 0,
    pago_total: 0,
    exp_teorico: 'pendiente',
    exp_practico: 'pendiente',
    expediente: { ci: true, foto: true, medico: false, semep: false },
    cursoCompletoPendienteEgreso: false,
    ...overrides,
  };
}

// Llegan como los entrega el Facade: el más reciente primero.
const ALUMNOS = [
  row('3', { apellido: 'Morales', status: 'Activo' }),
  row('2', { apellido: 'Zúñiga', status: 'Retirado' }),
  row('1', { apellido: 'Araya', status: 'Activo' }),
];

describe('AlumnosListContentComponent — orden de la lista (spec 0020-m)', () => {
  let component: AlumnosListContentComponent;
  let showSedeColumn: WritableSignal<boolean>;
  let emitted: AlumnoListFilters[];

  const ids = (): string[] => component.sortedAlumnos().map((a) => a.id);

  /**
   * Los signal inputs no son escribibles en esta infra (JIT sin el transform de initializer
   * APIs: setInput los descarta). Se sustituyen por signals locales, igual que en
   * asistencia-clase-b-content.component.spec.ts.
   */
  const stubInput = <T>(name: string, initial: T): WritableSignal<T> => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  function create(initialFilters: AlumnoListFilters | null = null): void {
    component = TestBed.createComponent(AlumnosListContentComponent).componentInstance;
    stubInput('alumnos', ALUMNOS);
    stubInput('initialFilters', initialFilters);
    showSedeColumn = stubInput('showSedeColumn', false);
    emitted = [];
    component.filtersChanged.subscribe((f) => emitted.push(f));
    component.ngOnInit();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlumnosListContentComponent],
      providers: [
        { provide: LayoutDrawerFacadeService, useValue: { isOpen: signal(false), open: vi.fn() } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });
  });

  it('sin orden elegido muestra la lista como llega: más recientes primero', () => {
    create();

    expect(ids()).toEqual(['3', '2', '1']);
  });

  it('un clic en el título ordena ascendente, el segundo descendente y el tercero vuelve al orden por defecto', () => {
    create();

    component.toggleSort('alumno');
    expect(ids()).toEqual(['1', '3', '2']);
    expect(component.ariaSort('alumno')).toBe('ascending');

    component.toggleSort('alumno');
    expect(ids()).toEqual(['2', '3', '1']);
    expect(component.ariaSort('alumno')).toBe('descending');

    component.toggleSort('alumno');
    expect(ids()).toEqual(['3', '2', '1']);
    expect(component.ariaSort('alumno')).toBe('none');
  });

  it('solo la columna ordenada muestra el indicador de sentido', () => {
    create();

    component.toggleSort('rut');

    expect(component.sortIcon('rut')).toBe('chevron-up');
    expect(component.sortIcon('alumno')).toBe('arrow-up-down');
    expect(component.ariaSort('alumno')).toBe('none');
  });

  it('el resultado de un filtro sigue ordenado por la misma columna', () => {
    create();
    component.toggleSort('alumno');

    component.updateFilter(component.selectedEstado, 'Activo');

    expect(ids()).toEqual(['1', '3']);
  });

  it('las tarjetas siguen el mismo orden que la tabla', () => {
    create();

    component.toggleSort('alumno');

    expect(component.visibleCards().map((a) => a.id)).toEqual(['1', '3', '2']);
  });

  it('cambiar el orden vuelve a la primera página y a las primeras tarjetas', () => {
    create();
    component.tableFirst.set(20);
    component.loadMoreCards();

    component.toggleSort('estado');

    expect(component.tableFirst()).toBe(0);
    expect(component.mobileShown()).toBe(6);
  });

  it('arranca con el orden que le entrega el Smart (al volver de la ficha)', () => {
    create({
      search: '',
      curso: '',
      estado: '',
      expediente: '',
      sort: { field: 'alumno', direction: 'desc' },
    });

    expect(ids()).toEqual(['2', '3', '1']);
  });

  it('avisa el orden junto con los filtros para que el Smart lo conserve', () => {
    create();

    component.toggleSort('fechaIngreso');

    expect(emitted.at(-1)).toEqual({
      search: '',
      curso: '',
      estado: '',
      expediente: '',
      sort: { field: 'fechaIngreso', direction: 'asc' },
    });
  });

  it('"Limpiar filtros" no quita el orden elegido', () => {
    create();
    component.toggleSort('alumno');

    component.resetFilters();

    expect(component.sort()).toEqual({ field: 'alumno', direction: 'asc' });
  });

  describe('control "Ordenar por" de la vista de tarjetas', () => {
    it('elegir una columna ordena ascendente', () => {
      create();

      component.setSortField('alumno');

      expect(ids()).toEqual(['1', '3', '2']);
    });

    it('el botón de sentido invierte el orden', () => {
      create();
      component.setSortField('alumno');

      component.toggleSortDirection();

      expect(ids()).toEqual(['2', '3', '1']);
    });

    it('limpiar el control vuelve al orden por defecto', () => {
      create();
      component.setSortField('alumno');

      component.setSortField(null);

      expect(component.sort()).toBeNull();
      expect(ids()).toEqual(['3', '2', '1']);
    });

    it('volver a elegir la misma columna no reinicia el sentido', () => {
      create();
      component.setSortField('alumno');
      component.toggleSortDirection();

      component.setSortField('alumno');

      expect(component.sort()).toEqual({ field: 'alumno', direction: 'desc' });
    });
  });

  describe('columnas ordenables', () => {
    it('"Sede" solo se ofrece cuando la columna se muestra', () => {
      create();
      expect(component.sortColumns().map((c) => c.value)).not.toContain('sede');

      showSedeColumn.set(true);

      expect(component.sortColumns().map((c) => c.value)).toContain('sede');
    });
  });
});
