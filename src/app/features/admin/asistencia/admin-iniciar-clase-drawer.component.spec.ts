import { TestBed } from '@angular/core/testing';
import { AdminIniciarClaseDrawerComponent } from './admin-iniciar-clase-drawer.component';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { PagosFacade } from '@core/facades/pagos.facade';
import { signal, type WritableSignal } from '@angular/core';
import type { EstadoPagoClase } from '@core/models/ui/estado-pago-clase.model';

describe('AdminIniciarClaseDrawerComponent', () => {
  let component: AdminIniciarClaseDrawerComponent;
  let facadeSpy: any;
  let layoutDrawerSpy: any;
  let dashboardFacadeSpy: any;
  let confirmSpy: any;
  let pagosFacadeSpy: any;
  let estadoPago: WritableSignal<EstadoPagoClase | null>;

  beforeEach(() => {
    estadoPago = signal<EstadoPagoClase | null>(null);
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
      estadoPagoClase: estadoPago.asReadonly(),
      cargarEstadoPagoClase: vi.fn().mockResolvedValue(undefined),
      habilitarSinPago: vi.fn().mockResolvedValue(true),
      isSaving: signal(false).asReadonly(),
    };
    pagosFacadeSpy = { seleccionarParaPago: vi.fn() };
    confirmSpy = { confirm: vi.fn().mockResolvedValue(true) };
    layoutDrawerSpy = { close: vi.fn(), open: vi.fn(), push: vi.fn() };
    dashboardFacadeSpy = { refreshLiveClassesOnly: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      imports: [AdminIniciarClaseDrawerComponent],
      providers: [
        { provide: AsistenciaClaseBFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: DashboardFacade, useValue: dashboardFacadeSpy },
        { provide: ConfirmModalService, useValue: confirmSpy },
        { provide: PagosFacade, useValue: pagosFacadeSpy },
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

  // ─── Spec 0010-i: clase 7+ sin el segundo pago ──────────────────────────────
  describe('segundo pago (spec 0010-i)', () => {
    it('al abrir lee el estado de pago de la clase seleccionada', () => {
      expect(facadeSpy.cargarEstadoPagoClase).toHaveBeenCalledWith(facadeSpy.selectedPractica());
    });

    // El DOM (banda, botones) se valida con Playwright: app-icon no resuelve sus inputs en
    // este entorno de tests y ningún spec del proyecto lo renderiza. Acá se testea la decisión.
    it('solo "bloqueada" oculta "Comenzar Clase" (AC3, AC10, AC4)', () => {
      estadoPago.set({ estado: 'bloqueada', saldo: 180000 });
      expect((component as any).bloqueada()).toBe(true);

      estadoPago.set({ estado: 'habilitada_sin_pago', saldo: 90000 });
      expect((component as any).bloqueada()).toBe(false);

      estadoPago.set({ estado: 'libre', saldo: 0 });
      expect((component as any).bloqueada()).toBe(false);

      // Lectura fallida o pendiente: no se oculta (la BD igual bloquea).
      estadoPago.set(null);
      expect((component as any).bloqueada()).toBe(false);
    });

    it('el saldo se muestra en pesos chilenos', () => {
      expect((component as any).clp(180000)).toContain('180.000');
    });

    it('"Registrar pago" precarga la matrícula y apila el drawer de pago (AC4)', () => {
      (component as any).onRegistrarPago({ id: 1, enrollmentId: 10 });

      expect(pagosFacadeSpy.seleccionarParaPago).toHaveBeenCalledWith(10);
      expect(layoutDrawerSpy.push).toHaveBeenCalledWith(
        expect.anything(),
        'Registrar Pago',
        'credit-card',
      );
    });

    it('"Habilitar sin pago" exige motivo de al menos 5 letras (AC5)', async () => {
      (component as any).motivo.set('abc');
      expect((component as any).motivoValido()).toBe(false);
      await (component as any).onHabilitarSinPago({ id: 1, enrollmentId: 10 });
      expect(facadeSpy.habilitarSinPago).not.toHaveBeenCalled();

      (component as any).motivo.set('Paga el viernes');
      await (component as any).onHabilitarSinPago({ id: 1, enrollmentId: 10 });
      expect(facadeSpy.habilitarSinPago).toHaveBeenCalledWith(10, 'Paga el viernes');
    });

    it('si el forzado no se guarda, el formulario de motivo sigue abierto (AC-E6)', async () => {
      facadeSpy.habilitarSinPago.mockResolvedValueOnce(false);
      (component as any).mostrarMotivo.set(true);
      (component as any).motivo.set('Paga el viernes');

      await (component as any).onHabilitarSinPago({ id: 1, enrollmentId: 10 });

      expect((component as any).mostrarMotivo()).toBe(true);
    });
  });
});
