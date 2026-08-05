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

  // ─── fix-115-m: admin/secretaría nunca ven ni completan evaluación ────────
  describe('fix-115-m — sin evaluación en el cierre de admin/secretaría', () => {
    it('canFinalize no exige calificación — solo kilometraje válido', () => {
      const cls = { id: 1, studentId: 42, kmStart: 1000 };
      expect(component.canFinalize(cls)).toBe(true);
    });

    it('el payload enviado a finishClass nunca incluye grade/checklist/observations', async () => {
      const cls = { id: 1, studentId: 42, kmStart: 1000 };

      await component.onFinalize(cls);

      const payload = facadeSpy.finishClass.mock.calls[0][0];
      expect(payload).not.toHaveProperty('grade');
      expect(payload).not.toHaveProperty('checklist');
      expect(payload).not.toHaveProperty('observations');
    });

    it('no expone selectedGrade ni checklistItems en el componente', () => {
      expect((component as any).selectedGrade).toBeUndefined();
      expect((component as any).checklistItems).toBeUndefined();
    });
  });
});
