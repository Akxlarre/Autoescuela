import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { SecretariaPagosComponent } from './secretaria-pagos.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ChileDatePipe } from '@shared/pipes/chile-date.pipe';
import type { AlumnoDeudor } from '@core/models/ui/pagos.model';

// ─── fix-132-m (ASG-b-076): densidad adaptativa app-like (Deudores) ───
// Pagos Recientes y Métodos de Pago se movieron a PagosRecientesDrawerComponent
// (ver pagos-recientes-drawer.component.spec.ts) — un split de filas 50/50 no dejaba
// espacio real para las filas de pago en viewports típicos (confirmado en /verify).
describe('SecretariaPagosComponent — densidad app-like', () => {
  let component: SecretariaPagosComponent;
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
      imports: [SecretariaPagosComponent],
      providers: [
        {
          provide: PagosFacade,
          useValue: {
            isLoading: signal(false),
            error: signal(null),
            refreshFailed: signal(false),
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
        { provide: AuthFacade, useValue: { currentUser: signal({ branchId: 1 }) } },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { open: vi.fn(), close: vi.fn(), isOpen: signal(false) },
        },
        { provide: LayoutService, useValue: { tier: tierSig } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(SecretariaPagosComponent).componentInstance;
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

// ─── fix-248-m (ASG-m-005): filtros de fecha/curso en la tabla de deudores ───
// Sin filtro de sede — la secretaria está anclada a una sola sede (currentUser().branchId).
describe('SecretariaPagosComponent — filtros de deudores (fix-248-m)', () => {
  let component: SecretariaPagosComponent;

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
    buildDeudor({ enrollmentId: 1, cursoTipo: 'class_b', fechaMatricula: '2026-01-10T00:00:00Z' }),
    buildDeudor({
      enrollmentId: 2,
      cursoTipo: 'professional',
      fechaMatricula: '2026-02-15T00:00:00Z',
    }),
    buildDeudor({ enrollmentId: 3, cursoTipo: 'class_b', fechaMatricula: '2026-03-20T00:00:00Z' }),
  ];

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [SecretariaPagosComponent],
      providers: [
        {
          provide: PagosFacade,
          useValue: {
            isLoading: signal(false),
            error: signal(null),
            refreshFailed: signal(false),
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
        { provide: AuthFacade, useValue: { currentUser: signal({ branchId: 1 }) } },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { open: vi.fn(), close: vi.fn(), isOpen: signal(false) },
        },
        { provide: LayoutService, useValue: { tier: signal('desktop') } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(SecretariaPagosComponent).componentInstance;
  }

  it('sin filtros muestra todos los deudores (AC-5)', () => {
    setup();
    expect((component as any).deudoresFiltrados().length).toBe(3);
  });

  it('filtra por rango de fechas, inclusive en ambos extremos (AC-1)', () => {
    setup();
    (component as any).filtroFechaDesde.set('2026-02-01');
    (component as any).filtroFechaHasta.set('2026-03-20');
    const ids = (component as any).deudoresFiltrados().map((d: AlumnoDeudor) => d.enrollmentId);
    expect(ids).toEqual([2, 3]);
  });

  it('filtra por tipo de curso (AC-2)', () => {
    setup();
    (component as any).filtroCurso.set('professional');
    const ids = (component as any).deudoresFiltrados().map((d: AlumnoDeudor) => d.enrollmentId);
    expect(ids).toEqual([2]);
  });

  it('combina fecha + curso con AND (AC-4)', () => {
    setup();
    (component as any).filtroFechaDesde.set('2026-01-01');
    (component as any).filtroCurso.set('class_b');
    const ids = (component as any).deudoresFiltrados().map((d: AlumnoDeudor) => d.enrollmentId);
    expect(ids).toEqual([1, 3]);
  });

  // fix-055-i: con filtros sin resultados la lista quedaba con los encabezados y sin mensaje.
  it('fix-055-i: con deudores, un filtro sin resultados activa el estado vacío y limpiar lo quita', () => {
    setup();
    expect((component as any).sinResultadosPorFiltro()).toBe(false);

    (component as any).setFiltroCurso('singular');
    expect((component as any).sinResultadosPorFiltro()).toBe(true);

    (component as any).limpiarFiltros();
    expect((component as any).sinResultadosPorFiltro()).toBe(false);
    expect((component as any).deudoresFiltrados().length).toBe(3);
  });

  it('cambiar un filtro vuelve a la página 1', () => {
    setup();
    (component as any).paginaDeudoresActual.set(2);
    (component as any).setFiltroCurso('class_b');
    expect((component as any).paginaDeudoresActual()).toBe(1);
  });

  it('limpiarFiltros resetea fecha/curso y vuelve a la página 1', () => {
    setup();
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
    setup();
    expect((component as any).hayFiltrosActivos()).toBe(false);
    (component as any).setFiltroCurso('class_b');
    expect((component as any).hayFiltrosActivos()).toBe(true);
  });
});

// ─── spec 0060-b (T1.1): una lectura que falla se ve como error, no como $0 o "sin deudores" ───
describe('SecretariaPagosComponent — lecturas fallidas (spec 0060-b)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SecretariaPagosComponent>>;
  let facade: any;

  const deudor = {
    enrollmentId: 1,
    alumno: 'Alumno 1',
    rut: '1-9',
    totalAPagar: 500000,
    pagado: 100000,
    saldo: 400000,
    cursoTipo: 'class_b',
    cursoNombre: 'Clase B',
    fechaMatricula: '2026-03-10T00:00:00Z',
    sedeId: 1,
    sedeNombre: 'Sede 1',
  } as AlumnoDeudor;

  function setup(estado: { error: string | null; refreshFailed: boolean; conDatos: boolean }) {
    facade = {
      isLoading: signal(false),
      error: signal(estado.error),
      refreshFailed: signal(estado.refreshFailed),
      isGeneratingReport: signal(false),
      alumnosConDeuda: signal(estado.conDatos ? [deudor] : []),
      pagosRecientes: signal([]),
      metodosPagoMes: signal([]),
      ingresosHoy: signal(estado.conDatos ? 15000 : null),
      ingresosMes: signal(estado.conDatos ? 250000 : null),
      boletasMes: signal(estado.conDatos ? 4 : null),
      totalDeudores: signal(estado.conDatos ? 1 : 0),
      pagosPendientesTotales: signal(estado.conDatos ? 400000 : null),
      initialize: vi.fn(),
      reintentar: vi.fn(),
      destroyRealtime: vi.fn(),
      seleccionarEnrollment: vi.fn(),
      seleccionarParaPago: vi.fn(),
      generarReporte: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [SecretariaPagosComponent],
      providers: [
        { provide: PagosFacade, useValue: facade },
        { provide: AuthFacade, useValue: { currentUser: signal({ branchId: 1 }) } },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { open: vi.fn(), close: vi.fn(), isOpen: signal(false) },
        },
        { provide: LayoutService, useValue: { tier: signal('desktop') } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    }).overrideComponent(SecretariaPagosComponent, {
      set: { imports: [ChileDatePipe], schemas: [NO_ERRORS_SCHEMA] },
    });
    fixture = TestBed.createComponent(SecretariaPagosComponent);
    fixture.detectChanges();
  }

  const host = () => fixture.nativeElement as HTMLElement;
  const grid = () => host().querySelector('.bento-grid') as HTMLElement;
  const fill = () => host().querySelector('.bento-fill') as HTMLElement;

  it('caso B: el aviso va dentro de la celda .bento-fill, nunca como hijo directo de la grilla', () => {
    setup({ error: null, refreshFailed: true, conDatos: true });

    expect(fill().querySelector('app-alert-card')).not.toBeNull();
    const hijos = Array.from(grid().children).map((c) => c.tagName.toLowerCase());
    expect(hijos).not.toContain('app-alert-card');
    expect(grid().children).toHaveLength(2); // hero + celda
    expect(fill().textContent).toContain('Alumno 1');
  });

  it('caso B: el aviso es compacto, primer hijo de la celda, con "Reintentar" en su ranura (fix-254-b)', () => {
    setup({ error: null, refreshFailed: true, conDatos: true });
    const aviso = fill().querySelector('app-alert-card') as HTMLElement;

    expect(aviso.hasAttribute('compact')).toBe(true);
    expect(fill().firstElementChild).toBe(aviso.parentElement);
    expect(aviso.parentElement!.classList.contains('shrink-0')).toBe(true);
    const boton = aviso.querySelector(':scope > button[alertAction]');
    expect(boton?.getAttribute('data-llm-action')).toBe('reintentar-pagos');
  });

  it('caso B: "Reintentar" del aviso llama a reintentar() y lleva data-llm-action', () => {
    setup({ error: null, refreshFailed: true, conDatos: true });
    const btn = fill().querySelector(
      'app-alert-card button[data-llm-action="reintentar-pagos"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(facade.reintentar).toHaveBeenCalledTimes(1);
  });

  it('caso A: estado de error con "Reintentar" en la celda; sin KPIs, chips ni "sin saldos"', () => {
    setup({ error: 'No se pudieron cargar los pagos.', refreshFailed: false, conDatos: false });
    const cmp = fixture.componentInstance as any;

    const empty = fill().querySelector('app-empty-state');
    expect((empty as any)?.message).toBe('No se pudieron cargar los pagos.');
    expect(empty?.getAttribute('actionLabel')).toBe('Reintentar');
    expect(fill().textContent).not.toContain('Sin saldos pendientes');
    expect(fill().textContent).not.toContain('0 de 0');
    expect(cmp.heroKpis()).toEqual([]);
    expect(cmp.heroChips()).toEqual([]);
    expect(grid().children).toHaveLength(2);

    empty!.dispatchEvent(new CustomEvent('action'));
    expect(facade.reintentar).toHaveBeenCalledTimes(1);
  });

  it('con datos: KPIs con sus valores y sin avisos', () => {
    setup({ error: null, refreshFailed: false, conDatos: true });
    const cmp = fixture.componentInstance as any;
    expect(cmp.heroKpis().map((k: any) => k.value)).toEqual([15000 / 1000, 250, 400, 4]);
    expect(fill().querySelector('app-alert-card')).toBeNull();
    expect(fill().querySelector('app-empty-state')).toBeNull();
  });
});
