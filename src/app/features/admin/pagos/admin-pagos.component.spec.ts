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
          useValue: { selectedBranchId: signal(null), selectedBranchLabel: signal('Todas') },
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
