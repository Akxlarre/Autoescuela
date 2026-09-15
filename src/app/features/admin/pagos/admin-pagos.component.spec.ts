import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminPagosComponent } from './admin-pagos.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { AlumnoDeudor } from '@core/models/ui/pagos.model';

// ─── fix-132-m (ASG-b-076): densidad adaptativa app-like (Deudores) ───
// Pagos Recientes y Métodos de Pago se movieron a PagosRecientesDrawerComponent
// (ver pagos-recientes-drawer.component.spec.ts) — un split de filas 50/50 no dejaba
// espacio real para las filas de pago en viewports típicos (confirmado en /verify).
describe('AdminPagosComponent — densidad app-like', () => {
  let component: AdminPagosComponent;
  let tierSig: ReturnType<typeof signal<'mobile' | 'tablet' | 'desktop'>>;

  const buildDeudor = (id: number): AlumnoDeudor =>
    ({
      enrollmentId: id,
      alumno: `Alumno ${id}`,
      rut: `1111111${id}-1`,
      totalAPagar: 500000,
      pagado: 100000,
      saldo: 400000,
    }) as AlumnoDeudor;

  const deudores = Array.from({ length: 12 }, (_, i) => buildDeudor(i + 1));

  function setup(): void {
    tierSig = signal<'mobile' | 'tablet' | 'desktop'>('desktop');

    TestBed.configureTestingModule({
      imports: [AdminPagosComponent],
      providers: [
        {
          provide: PagosFacade,
          useValue: {
            isLoading: signal(false),
            error: signal(null),
            isGeneratingReport: signal(false),
            alumnosConDeuda: signal(deudores),
            pagosRecientes: signal([]),
            metodosPagoMes: signal([]),
            ingresosHoy: signal(0),
            ingresosMes: signal(0),
            boletasMes: signal(0),
            totalDeudores: signal(deudores.length),
            pagosPendientesTotales: signal(0),
            initialize: vi.fn(),
            destroyRealtime: vi.fn(),
            seleccionarEnrollment: vi.fn(),
            seleccionarParaPago: vi.fn(),
            generarReporte: vi.fn(),
          },
        },
        {
          provide: BranchFacade,
          useValue: {
            selectedBranchId: signal(null),
            selectedBranchLabel: signal('Todas'),
            branches: signal([]),
          },
        },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { open: vi.fn(), close: vi.fn(), isOpen: signal(false) },
        },
        { provide: LayoutService, useValue: { tier: tierSig } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(AdminPagosComponent).componentInstance;
  }

  beforeEach(() => setup());

  describe('Deudores — desktop (tier=desktop): paginador real (10/página)', () => {
    it('maxVisibleDeudores es null (el límite lo da la paginación, no sliceByBudget)', () => {
      expect((component as any).maxVisibleDeudores()).toBeNull();
    });

    it('deudoresVisibles muestra la primera página (10 de 12)', () => {
      expect((component as any).deudoresVisibles().length).toBe(10);
      expect((component as any).deudoresVisibles()[0].enrollmentId).toBe(1);
    });

    it('totalPaginasDeudores calcula 2 páginas para 12 deudores', () => {
      expect((component as any).totalPaginasDeudores()).toBe(2);
    });

    it('rangoDeudoresMostrando refleja la página actual', () => {
      expect((component as any).rangoDeudoresMostrando()).toBe('Mostrando 1-10 de 12 alumnos');
    });

    it('paginaDeudoresSiguiente avanza a la página 2 (2 restantes)', () => {
      (component as any).paginaDeudoresSiguiente();
      expect((component as any).deudoresVisibles().length).toBe(2);
      expect((component as any).deudoresVisibles()[0].enrollmentId).toBe(11);
      expect((component as any).rangoDeudoresMostrando()).toBe('Mostrando 11-12 de 12 alumnos');
    });

    it('paginaDeudoresSiguiente no avanza más allá de la última página', () => {
      (component as any).paginaDeudoresSiguiente();
      (component as any).paginaDeudoresSiguiente();
      expect((component as any).paginaDeudoresActual()).toBe(2);
    });

    it('paginaDeudoresAnterior no retrocede antes de la página 1', () => {
      (component as any).paginaDeudoresAnterior();
      expect((component as any).paginaDeudoresActual()).toBe(1);
    });

    it('remainingDeudores es 0 (el "Cargar más" es solo mobile/tablet)', () => {
      expect((component as any).remainingDeudores()).toBe(0);
    });
  });

  describe('Deudores — mobile/tablet (tier=mobile)', () => {
    beforeEach(() => tierSig.set('mobile'));

    it('maxVisibleDeudores arranca en el step (5)', () => {
      expect((component as any).maxVisibleDeudores()).toBe(5);
    });

    it('deudoresVisibles recorta al presupuesto inicial', () => {
      expect((component as any).deudoresVisibles().length).toBe(5);
    });

    it('remainingDeudores refleja lo que falta por mostrar', () => {
      expect((component as any).remainingDeudores()).toBe(7);
    });

    it('loadMoreDeudores incrementa el presupuesto en un step', () => {
      (component as any).loadMoreDeudores();
      expect((component as any).deudoresVisibles().length).toBe(10);
      expect((component as any).remainingDeudores()).toBe(2);
    });

    it('loadMoreDeudores repetido nunca excede el total disponible', () => {
      (component as any).loadMoreDeudores();
      (component as any).loadMoreDeudores();
      expect((component as any).deudoresVisibles().length).toBe(12);
      expect((component as any).remainingDeudores()).toBe(0);
    });
  });

  describe('Hero action: abrir drawer de Pagos Recientes', () => {
    it('view-pagos-recientes abre PagosRecientesDrawerComponent', () => {
      const openSpy = vi.spyOn((component as any).layoutDrawer, 'open');
      (component as any).onHeroAction('view-pagos-recientes');
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][1]).toBe('Pagos Recientes');
    });
  });
});

// ─── fix-248-m (ASG-m-005): filtros de fecha/curso/sede en la tabla de deudores ───
describe('AdminPagosComponent — filtros de deudores (fix-248-m)', () => {
  let component: AdminPagosComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<AdminPagosComponent>>;
  let branchIdSig: ReturnType<typeof signal<number | null>>;

  const buildDeudor = (over: Partial<AlumnoDeudor>): AlumnoDeudor =>
    ({
      enrollmentId: 1,
      alumno: 'Alumno',
      rut: '1-9',
      totalAPagar: 500000,
      pagado: 100000,
      saldo: 400000,
      cursoTipo: 'class_b',
      cursoNombre: 'Clase B',
      fechaMatricula: '2026-03-10T00:00:00Z',
      sedeId: 1,
      sedeNombre: 'Sede 1',
      ...over,
    }) as AlumnoDeudor;

  const deudores: AlumnoDeudor[] = [
    buildDeudor({
      enrollmentId: 1,
      cursoTipo: 'class_b',
      fechaMatricula: '2026-01-10T00:00:00Z',
      sedeId: 1,
    }),
    buildDeudor({
      enrollmentId: 2,
      cursoTipo: 'professional',
      fechaMatricula: '2026-02-15T00:00:00Z',
      sedeId: 1,
    }),
    buildDeudor({
      enrollmentId: 3,
      cursoTipo: 'class_b',
      fechaMatricula: '2026-03-20T00:00:00Z',
      sedeId: 2,
    }),
  ];

  function setup(selectedBranchId: number | null): void {
    branchIdSig = signal<number | null>(selectedBranchId);

    TestBed.configureTestingModule({
      imports: [AdminPagosComponent],
      providers: [
        {
          provide: PagosFacade,
          useValue: {
            isLoading: signal(false),
            error: signal(null),
            isGeneratingReport: signal(false),
            alumnosConDeuda: signal(deudores),
            pagosRecientes: signal([]),
            metodosPagoMes: signal([]),
            ingresosHoy: signal(0),
            ingresosMes: signal(0),
            boletasMes: signal(0),
            totalDeudores: signal(deudores.length),
            pagosPendientesTotales: signal(0),
            initialize: vi.fn(),
            destroyRealtime: vi.fn(),
            seleccionarEnrollment: vi.fn(),
            seleccionarParaPago: vi.fn(),
            generarReporte: vi.fn(),
          },
        },
        {
          provide: BranchFacade,
          useValue: {
            selectedBranchId: branchIdSig,
            selectedBranchLabel: signal('Todas'),
            branches: signal([
              { id: 1, name: 'Sede 1', slug: 'sede-1' },
              { id: 2, name: 'Sede 2', slug: 'sede-2' },
            ]),
          },
        },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { open: vi.fn(), close: vi.fn(), isOpen: signal(false) },
        },
        { provide: LayoutService, useValue: { tier: signal('desktop') } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(AdminPagosComponent);
    component = fixture.componentInstance;
  }

  it('sin filtros muestra todos los deudores (AC-5)', () => {
    setup(null);
    expect((component as any).deudoresFiltrados().length).toBe(3);
  });

  it('filtra por rango de fechas, inclusive en ambos extremos (AC-1)', () => {
    setup(null);
    (component as any).filtroFechaDesde.set('2026-02-01');
    (component as any).filtroFechaHasta.set('2026-03-20');
    const ids = (component as any).deudoresFiltrados().map((d: AlumnoDeudor) => d.enrollmentId);
    expect(ids).toEqual([2, 3]);
  });

  it('filtra por tipo de curso (AC-2)', () => {
    setup(null);
    (component as any).filtroCurso.set('professional');
    const ids = (component as any).deudoresFiltrados().map((d: AlumnoDeudor) => d.enrollmentId);
    expect(ids).toEqual([2]);
  });

  it('combina fecha + curso con AND (AC-4)', () => {
    setup(null);
    (component as any).filtroFechaDesde.set('2026-01-01');
    (component as any).filtroCurso.set('class_b');
    const ids = (component as any).deudoresFiltrados().map((d: AlumnoDeudor) => d.enrollmentId);
    expect(ids).toEqual([1, 3]);
  });

  it('filtros se aplican antes de paginar — deudoresVisibles refleja el resultado filtrado (AC-6)', () => {
    setup(null);
    (component as any).filtroCurso.set('professional');
    expect((component as any).deudoresVisibles().length).toBe(1);
    expect((component as any).totalPaginasDeudores()).toBe(1);
  });

  it('cambiar un filtro vuelve a la página 1', () => {
    setup(null);
    (component as any).paginaDeudoresActual.set(2);
    (component as any).setFiltroCurso('class_b');
    expect((component as any).paginaDeudoresActual()).toBe(1);
  });

  it('mostrarColumnaSede es true cuando selectedBranchId() === null (AC-3)', () => {
    setup(null);
    expect((component as any).mostrarColumnaSede()).toBe(true);
  });

  it('mostrarColumnaSede es false cuando hay una sede específica seleccionada (AC-3)', () => {
    setup(1);
    expect((component as any).mostrarColumnaSede()).toBe(false);
  });

  it('limpiarFiltros resetea fecha/curso y vuelve a la página 1', () => {
    setup(null);
    (component as any).setFiltroFechaDesde('2026-02-01');
    (component as any).setFiltroCurso('class_b');
    (component as any).paginaDeudoresActual.set(2);

    (component as any).limpiarFiltros();

    expect((component as any).filtroFechaDesde()).toBe('');
    expect((component as any).filtroCurso()).toBeNull();
    expect((component as any).paginaDeudoresActual()).toBe(1);
    expect((component as any).deudoresFiltrados().length).toBe(3);
  });

  it('hayFiltrosActivos refleja si algún filtro está aplicado', () => {
    setup(null);
    expect((component as any).hayFiltrosActivos()).toBe(false);
    (component as any).setFiltroCurso('class_b');
    expect((component as any).hayFiltrosActivos()).toBe(true);
  });
});
