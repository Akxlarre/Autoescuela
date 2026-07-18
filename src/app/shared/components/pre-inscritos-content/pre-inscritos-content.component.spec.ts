import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PreInscritosContentComponent } from './pre-inscritos-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { PreInscritoTableRow } from '@core/models/ui/pre-inscrito-table.model';

function makeRow(over: Partial<PreInscritoTableRow> = {}): PreInscritoTableRow {
  return {
    id: 1,
    tempUserId: 100,
    nombre: 'Juan',
    apellido: 'Perez Soto',
    nombreCompleto: 'Juan Perez Soto',
    rut: '11.111.111-1',
    email: 'juan@example.cl',
    telefono: '+56911111111',
    licencia: 'A2',
    branchId: 1,
    sucursal: 'Chillan',
    canal: 'online',
    convalida: false,
    fechaPreInscripcion: '2026-07-01',
    fechaVencimiento: '2026-07-31',
    isVencido: false,
    diasParaVencer: 15,
    status: 'pending_review',
    statusLabel: 'Pendiente revision',
    statusSeverity: 'warn',
    psychResult: null,
    psychResultLabel: 'Sin evaluar',
    psychAnswers: null,
    psychEvaluatedAt: null,
    psychEvaluatedByName: null,
    psychRejectionReason: null,
    convertedEnrollmentId: null,
    enrollmentNumber: null,
    notes: null,
    birthDate: null,
    gender: null,
    address: null,
    ...over,
  };
}

/** Genera N filas con ids 1..N (para probar la paginación). */
function makeMany(n: number): PreInscritoTableRow[] {
  return Array.from({ length: n }, (_, i) =>
    makeRow({ id: i + 1, nombreCompleto: `Alumno ${i + 1}` }),
  );
}

describe('PreInscritosContentComponent', () => {
  let component: PreInscritosContentComponent;

  /**
   * Los signal inputs no son escribibles en esta infra (JIT sin el transform de
   * initializer APIs). Se stubean con signal() locales: los computeds leen
   * `this.input()` en cada evaluacion, asi que el wiring real (filtros +
   * paginacion) queda cubierto sin renderizar el template.
   */
  const stubInput = <T>(name: string, initial: T) => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  let rowsSig: ReturnType<typeof stubInput<PreInscritoTableRow[]>>;
  let maxSig: ReturnType<typeof stubInput<number | null>>;

  const rows: PreInscritoTableRow[] = [
    makeRow({
      id: 1,
      nombreCompleto: 'Juan Perez',
      rut: '11.111.111-1',
      status: 'pending_review',
      licencia: 'A2',
      psychResult: null,
    }),
    makeRow({
      id: 2,
      nombreCompleto: 'Maria Lopez',
      rut: '22.222.222-2',
      status: 'approved',
      licencia: 'A3',
      psychResult: 'fit',
    }),
    makeRow({
      id: 3,
      nombreCompleto: 'Pedro Diaz',
      rut: '33.333.333-3',
      status: 'rejected',
      licencia: 'A2',
      psychResult: 'unfit',
    }),
    makeRow({
      id: 4,
      nombreCompleto: 'Ana Torres',
      rut: '44.444.444-4',
      status: 'approved',
      licencia: 'A4',
      psychResult: 'fit',
    }),
  ];

  const filtered = () => (component as any).filtered() as PreInscritoTableRow[];
  const paged = () => (component as any).pagedRows() as PreInscritoTableRow[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PreInscritosContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn() },
        },
      ],
    });
    component = TestBed.createComponent(PreInscritosContentComponent).componentInstance;
    rowsSig = stubInput<PreInscritoTableRow[]>('preInscritos', rows);
    maxSig = stubInput<number | null>('maxVisible', null);
  });

  describe('filtros', () => {
    it('sin filtros devuelve todas las filas', () => {
      expect(filtered().length).toBe(4);
    });

    it('filtra por nombre (case-insensitive, parcial)', () => {
      (component as any).onSearch('maria');
      expect(filtered().map((r) => r.id)).toEqual([2]);
    });

    it('filtra por RUT parcial', () => {
      (component as any).onSearch('33.333');
      expect(filtered().map((r) => r.id)).toEqual([3]);
    });

    it('filtra por estado', () => {
      (component as any).onStatus('approved');
      expect(filtered().map((r) => r.id)).toEqual([2, 4]);
    });

    it('filtra por clase de licencia', () => {
      (component as any).onLicencia('A2');
      expect(filtered().map((r) => r.id)).toEqual([1, 3]);
    });

    it('combina buscador + estado + licencia', () => {
      (component as any).onStatus('approved');
      (component as any).onLicencia('A3');
      expect(filtered().map((r) => r.id)).toEqual([2]);
    });

    it('resetFiltros limpia busqueda y filtros', () => {
      (component as any).onSearch('maria');
      (component as any).onStatus('approved');
      (component as any).onLicencia('A3');
      (component as any).resetFiltros();
      expect(filtered().length).toBe(4);
      expect((component as any).searchQuery()).toBe('');
      expect((component as any).filterStatus()).toBe('');
      expect((component as any).filterLicencia()).toBe('');
    });
  });

  describe('layout por contenedor', () => {
    it('maxVisible=null => desktop (tabla), pageSize 12', () => {
      maxSig.set(null);
      expect((component as any).isDesktopLayout()).toBe(true);
      expect((component as any).pageSize()).toBe(12);
    });

    it('maxVisible=6 => movil (cards), pageSize 6', () => {
      maxSig.set(6);
      expect((component as any).isDesktopLayout()).toBe(false);
      expect((component as any).pageSize()).toBe(6);
    });
  });

  describe('paginacion', () => {
    beforeEach(() => {
      rowsSig.set(makeMany(15));
    });

    it('desktop (12/pag): 15 filas => 2 paginas, primera pagina 12 filas', () => {
      maxSig.set(null);
      expect((component as any).totalPages()).toBe(2);
      expect(paged().length).toBe(12);
      expect(paged()[0].id).toBe(1);
    });

    it('movil (6/pag): 15 filas => 3 paginas, primera pagina 6 filas', () => {
      maxSig.set(6);
      expect((component as any).totalPages()).toBe(3);
      expect(paged().length).toBe(6);
    });

    it('onPageChange navega a la pagina indicada (0-indexed), ultima pagina con menos filas', () => {
      maxSig.set(6);
      (component as any).onPageChange({ page: 1 });
      expect((component as any).safePage()).toBe(1);
      expect(paged().map((r: PreInscritoTableRow) => r.id)).toEqual([7, 8, 9, 10, 11, 12]);
      (component as any).onPageChange({ page: 2 });
      expect(paged().map((r: PreInscritoTableRow) => r.id)).toEqual([13, 14, 15]);
    });

    it('onPageChange sin page vuelve a la primera pagina', () => {
      maxSig.set(6);
      (component as any).onPageChange({ page: 2 });
      (component as any).onPageChange({});
      expect((component as any).safePage()).toBe(0);
    });

    it('filtrar resetea a la primera pagina', () => {
      maxSig.set(6);
      (component as any).onPageChange({ page: 1 });
      expect((component as any).safePage()).toBe(1);
      (component as any).onSearch('Alumno 1');
      expect((component as any).safePage()).toBe(0);
    });

    it('safePage se acota si la pagina actual queda fuera de rango tras filtrar', () => {
      maxSig.set(6);
      (component as any).onPageChange({ page: 2 });
      // Reducir el dataset (simula menos resultados)
      rowsSig.set(makeMany(3));
      expect((component as any).totalPages()).toBe(1);
      expect((component as any).safePage()).toBe(0);
      expect(paged().length).toBe(3);
    });
  });
});
