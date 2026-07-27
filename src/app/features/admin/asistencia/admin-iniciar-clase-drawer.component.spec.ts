import { TestBed } from '@angular/core/testing';
import { AdminIniciarClaseDrawerComponent } from './admin-iniciar-clase-drawer.component';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

describe('AdminIniciarClaseDrawerComponent', () => {
  let component: AdminIniciarClaseDrawerComponent;
  let facadeSpy: any;
  let layoutDrawerSpy: any;
  let dashboardFacadeSpy: any;

  beforeEach(() => {
    facadeSpy = {
      selectedPractica: vi.fn().mockReturnValue({
        id: 1,
        alumnoName: 'Julio Verstappen',
        branchId: null,
        vehicleId: null,
        vehicleCurrentKm: null,
      }),
      vehiclesPorSede: vi.fn().mockReturnValue([]),
      loadVehiclesByBranch: vi.fn().mockResolvedValue(undefined),
      startClass: vi.fn().mockResolvedValue(undefined),
    };
    layoutDrawerSpy = { close: vi.fn(), open: vi.fn() };
    dashboardFacadeSpy = { refreshLiveClassesOnly: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      imports: [AdminIniciarClaseDrawerComponent],
      providers: [
        { provide: AsistenciaClaseBFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: DashboardFacade, useValue: dashboardFacadeSpy },
      ],
    });

    component = TestBed.createComponent(AdminIniciarClaseDrawerComponent).componentInstance;
    component.ngOnInit();
    component.form.patchValue({ kmStart: 1000 });
  });

  // ─── fix-078: iniciar clase ya no auto-abre Finalizar Clase ────────────────
  describe('onSubmit (fix-078)', () => {
    it('startClass exitoso → cierra el drawer, no abre AdminFinalizarClaseDrawerComponent', async () => {
      const cls = facadeSpy.selectedPractica();

      await component.onSubmit(cls);

      expect(facadeSpy.startClass).toHaveBeenCalledWith(cls.id, expect.anything(), undefined);
      expect(layoutDrawerSpy.close).toHaveBeenCalled();
      expect(layoutDrawerSpy.open).not.toHaveBeenCalled();
    });
  });

  // ─── fix-079: refresco inmediato de "Clases Actuales" del Dashboard ────────
  describe('onSubmit (fix-079)', () => {
    it('startClass exitoso → llama dashboardFacade.refreshLiveClassesOnly()', async () => {
      const cls = facadeSpy.selectedPractica();

      await component.onSubmit(cls);

      expect(dashboardFacadeSpy.refreshLiveClassesOnly).toHaveBeenCalled();
    });
  });
});
