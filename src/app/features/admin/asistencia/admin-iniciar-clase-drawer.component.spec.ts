import { TestBed } from '@angular/core/testing';
import { AdminIniciarClaseDrawerComponent } from './admin-iniciar-clase-drawer.component';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

describe('AdminIniciarClaseDrawerComponent', () => {
  let component: AdminIniciarClaseDrawerComponent;
  let facadeSpy: any;
  let layoutDrawerSpy: any;
  let dashboardFacadeSpy: any;
  let confirmSpy: any;

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
      markAttendance: vi.fn().mockResolvedValue(true),
    };
    confirmSpy = { confirm: vi.fn().mockResolvedValue(true) };
    layoutDrawerSpy = { close: vi.fn(), open: vi.fn() };
    dashboardFacadeSpy = { refreshLiveClassesOnly: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      imports: [AdminIniciarClaseDrawerComponent],
      providers: [
        { provide: AsistenciaClaseBFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: DashboardFacade, useValue: dashboardFacadeSpy },
        { provide: ConfirmModalService, useValue: confirmSpy },
      ],
    });

    component = TestBed.createComponent(AdminIniciarClaseDrawerComponent).componentInstance;
    component.ngOnInit();
    component.form.patchValue({ kmStart: 1000 });
  });

  describe('fix-374-m / fix-375-m', () => {
    it('"Marcar ausente" solo cuando la hora de la clase ya pasó', () => {
      facadeSpy.selectedPractica.mockReturnValue({ id: 1, scheduledAt: '2020-01-01T12:00:00Z' });
      expect((component as any).canMarkAbsent()).toBe(true);
      facadeSpy.selectedPractica.mockReturnValue({ id: 1, scheduledAt: '2999-01-01T12:00:00Z' });
      expect((component as any).canMarkAbsent()).toBe(false);
      facadeSpy.selectedPractica.mockReturnValue({ id: 1 });
      expect((component as any).canMarkAbsent()).toBe(false);
    });

    it('Marcar ausente: confirma, registra, refresca Clases Actuales y cierra', async () => {
      await (component as any).onMarkAbsent({ id: 1 });
      expect(confirmSpy.confirm).toHaveBeenCalled();
      expect(facadeSpy.markAttendance).toHaveBeenCalledWith(1, 'ausente');
      expect(dashboardFacadeSpy.refreshLiveClassesOnly).toHaveBeenCalled();
      expect(layoutDrawerSpy.close).toHaveBeenCalled();
    });

    it('Marcar ausente: sin confirmar no registra', async () => {
      confirmSpy.confirm.mockResolvedValueOnce(false);
      await (component as any).onMarkAbsent({ id: 1 });
      expect(facadeSpy.markAttendance).not.toHaveBeenCalled();
    });

    it('avisa km de salida menor al del vehículo de la sesión', () => {
      facadeSpy.selectedPractica.mockReturnValue({ id: 1, vehicleCurrentKm: 300015 });
      component.form.patchValue({ kmStart: 1000 });
      expect((component as any).startKmWarning()).toContain('Es menor al kilometraje registrado');
      component.form.patchValue({ kmStart: 300020 });
      expect((component as any).startKmWarning()).toBeNull();
    });
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
