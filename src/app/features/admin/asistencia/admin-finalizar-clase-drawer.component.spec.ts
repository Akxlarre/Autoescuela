import { TestBed } from '@angular/core/testing';
import { AdminFinalizarClaseDrawerComponent } from './admin-finalizar-clase-drawer.component';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

describe('AdminFinalizarClaseDrawerComponent', () => {
  let component: AdminFinalizarClaseDrawerComponent;
  let facadeSpy: any;
  let layoutDrawerSpy: any;
  let dashboardFacadeSpy: any;

  beforeEach(() => {
    facadeSpy = { finishClass: vi.fn().mockResolvedValue(undefined) };
    layoutDrawerSpy = { close: vi.fn(), open: vi.fn() };
    dashboardFacadeSpy = { refreshLiveClassesOnly: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      imports: [AdminFinalizarClaseDrawerComponent],
      providers: [
        { provide: AsistenciaClaseBFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: DashboardFacade, useValue: dashboardFacadeSpy },
      ],
    });

    component = TestBed.createComponent(AdminFinalizarClaseDrawerComponent).componentInstance;
    component.ngOnInit();
    component.form.patchValue({ kmEnd: 1500 });
    component.selectedGrade.set(6);
  });

  // ─── fix-079: refresco inmediato de "Clases Actuales" del Dashboard ────────
  describe('onFinalize (fix-079)', () => {
    it('finishClass exitoso → llama dashboardFacade.refreshLiveClassesOnly() y cierra el drawer', async () => {
      const cls = { id: 1, studentId: 42, kmStart: 1000 };

      await component.onFinalize(cls);

      expect(facadeSpy.finishClass).toHaveBeenCalled();
      expect(dashboardFacadeSpy.refreshLiveClassesOnly).toHaveBeenCalled();
      expect(layoutDrawerSpy.close).toHaveBeenCalled();
    });
  });
});
