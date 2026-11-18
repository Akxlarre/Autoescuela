import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { AdminContabilidadAnticiposComponent } from './admin-contabilidad-anticipos.component';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// ─── spec 0060-b (T1.5): una lectura que falla se ve como error, no como $0 ───
describe('AdminContabilidadAnticiposComponent — lecturas fallidas (spec 0060-b)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AdminContabilidadAnticiposComponent>>;
  let facade: any;

  const ERROR = 'No se pudieron cargar los anticipos.';

  const fila = {
    instructorId: 7,
    nombre: 'Ana Díaz',
    tipo: 'both',
    tipoLabel: 'Teórico y Práctico',
    anticiposTotales: 50000,
    saldoPendiente: 50000,
    ultimoAnticipo: '2026-11-10',
    estado: 'pendiente',
  };
  const movimiento = {
    id: 1,
    fecha: '2026-11-10',
    instructorNombre: 'Ana Díaz',
    motivo: 'Anticipo de sueldo',
    monto: 50000,
    estado: 'pending',
  };

  function setup(estado: {
    error?: string | null;
    refreshFailed?: boolean;
    conDatos?: boolean;
    isLoading?: boolean;
  }) {
    const conDatos = estado.conDatos ?? false;
    facade = {
      isLoading: signal(estado.isLoading ?? false),
      isSaving: signal(false),
      error: signal(estado.error ?? null),
      refreshFailed: signal(estado.refreshFailed ?? false),
      historial: signal(conDatos ? [movimiento] : []),
      cuentaCorriente: signal(conDatos ? [fila] : []),
      instructores: signal([]),
      kpis: signal({
        totalPendiente: conDatos ? 50000 : 0,
        instructoresConSaldo: conDatos ? 1 : 0,
        totalHistorico: conDatos ? 50000 : 0,
        totalDescontado: 0,
      }),
      initialize: vi.fn(),
      reintentar: vi.fn(),
      selectInstructor: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [AdminContabilidadAnticiposComponent],
      providers: [
        { provide: AnticiposFacade, useValue: facade },
        { provide: BranchFacade, useValue: { selectedBranchId: signal(1) } },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { open: vi.fn(), close: vi.fn(), isOpen: signal(false) },
        },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    }).overrideComponent(AdminContabilidadAnticiposComponent, {
      set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
    });
    fixture = TestBed.createComponent(AdminContabilidadAnticiposComponent);
    fixture.detectChanges();
  }

  const cmp = () => fixture.componentInstance as any;
  const host = () => fixture.nativeElement as HTMLElement;
  const grid = () => host().querySelector('.bento-grid') as HTMLElement;
  const fill = () => host().querySelector('.bento-fill') as HTMLElement;
  const hijosGrilla = () => Array.from(grid().children).map((c) => c.tagName.toLowerCase());

  function irAHistorial() {
    cmp().setActiveTab('historial');
    fixture.detectChanges();
  }

  describe('caso A', () => {
    beforeEach(() => setup({ error: ERROR }));

    function expectErrorEnCelda() {
      const empty = fill().querySelector('app-empty-state');
      expect(empty).not.toBeNull();
      expect((empty as any).message).toBe(ERROR);
      expect(empty?.getAttribute('actionLabel')).toBe('Reintentar');
      expect(empty?.parentElement?.className).toContain('items-center');
      expect(empty?.parentElement?.className).toContain('justify-center');
      expect(empty?.parentElement?.className).toContain('flex-1');
    }

    function expectSinLista() {
      expect(fill().querySelector('table')).toBeNull();
      expect(fill().querySelector('.mobile-view')).toBeNull();
      expect(fill().querySelector('.desktop-view')).toBeNull();
      expect(fill().textContent).not.toContain('No hay instructores registrados');
      expect(fill().textContent).not.toContain('No hay anticipos registrados');
      expect(fill().textContent).not.toContain('registros');
    }

    it('Cuenta Corriente: error con "Reintentar" en la celda, sin tabla ni cards', () => {
      expectErrorEnCelda();
      expectSinLista();
    });

    it('Historial: error con "Reintentar" en la celda, sin tabla, cards ni contador', () => {
      irAHistorial();
      expectErrorEnCelda();
      expectSinLista();
    });

    it('"Reintentar" llama a reintentar()', () => {
      // El botón y su data-llm-action los pone app-empty-state.
      fill().querySelector('app-empty-state')?.dispatchEvent(new Event('action'));
      expect(facade.reintentar).toHaveBeenCalledTimes(1);
    });

    it('el hero no recibe KPIs en $0', () => {
      expect(cmp().heroKpis()).toEqual([]);
    });

    it('la pestaña Historial no muestra contador', () => {
      const historial = cmp()
        .tabOptions()
        .find((t: { id: string }) => t.id === 'historial');
      expect(historial.count).toBeNull();
    });

    it('la grilla conserva hero, pestañas y celda: ningún aviso como hijo directo', () => {
      expect(hijosGrilla()).not.toContain('app-alert-card');
      expect(grid().children).toHaveLength(3);
      expect(grid().querySelector(':scope > .bento-banner app-alert-card')).toBeNull();
    });
  });

  describe('caso B', () => {
    beforeEach(() => setup({ refreshFailed: true, conDatos: true }));

    function expectAvisoPrimero() {
      const primero = fill().firstElementChild as HTMLElement;
      expect(primero.className).toContain('shrink-0');
      expect(primero.querySelector('app-alert-card')).not.toBeNull();
    }

    it('Cuenta Corriente: el aviso es el primer hijo de .bento-fill y la lista sigue', () => {
      expectAvisoPrimero();
      expect(fill().textContent).toContain('Ana Díaz');
      expect(fill().querySelector('app-empty-state')).toBeNull();
    });

    it('Historial: el aviso también es el primer hijo y la lista sigue', () => {
      irAHistorial();
      expectAvisoPrimero();
      expect(fill().textContent).toContain('Anticipo de sueldo');
    });

    it('el aviso nunca es hijo directo de la grilla', () => {
      expect(hijosGrilla()).not.toContain('app-alert-card');
      expect(grid().children).toHaveLength(3);
    });

    it('"Reintentar" del aviso lleva data-llm-action y llama a reintentar()', () => {
      const btn = fill().querySelector(
        'app-alert-card button[data-llm-action="reintentar-anticipos"]',
      ) as HTMLButtonElement;
      expect(btn).not.toBeNull();
      btn.click();
      expect(facade.reintentar).toHaveBeenCalledTimes(1);
    });

    it('mantiene KPIs y contador', () => {
      expect(cmp().heroKpis()).toHaveLength(3);
      const historial = cmp()
        .tabOptions()
        .find((t: { id: string }) => t.id === 'historial');
      expect(historial.count).toBe(1);
    });

    it('registrar anticipo sigue disponible', () => {
      expect(cmp().heroActions.map((a: { id: string }) => a.id)).toContain('registrar-anticipo');
      expect(fill().querySelector('[data-llm-action="registrar-anticipo-instructor"]')).not.toBe(
        null,
      );
    });
  });

  describe('sin fallas', () => {
    it('datos normales: sin aviso ni estado de error', () => {
      setup({ conDatos: true });
      expect(fill().querySelector('app-alert-card')).toBeNull();
      expect(fill().querySelector('app-empty-state')).toBeNull();
      expect(cmp().heroKpis()).toHaveLength(3);
    });

    it('una sede sin instructores sigue diciendo que no hay instructores', () => {
      setup({});
      expect(fill().querySelector('app-empty-state')).toBeNull();
      expect(fill().textContent).toContain('No hay instructores registrados');
    });

    it('mientras carga, la pestaña Historial no muestra un contador viejo', () => {
      setup({ isLoading: true, conDatos: true });
      const historial = cmp()
        .tabOptions()
        .find((t: { id: string }) => t.id === 'historial');
      expect(historial.count).toBeNull();
    });
  });
});
