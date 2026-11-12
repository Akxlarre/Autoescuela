import { TestBed } from '@angular/core/testing';
import { AdminIniciarClaseDrawerComponent } from './admin-iniciar-clase-drawer.component';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { PagosFacade } from '@core/facades/pagos.facade';
import { NO_ERRORS_SCHEMA, signal, type WritableSignal } from '@angular/core';
import type { EstadoPagoClase } from '@core/models/ui/estado-pago-clase.model';

describe('AdminIniciarClaseDrawerComponent', () => {
  let component: AdminIniciarClaseDrawerComponent;
  let facadeSpy: any;
  let layoutDrawerSpy: any;
  let dashboardFacadeSpy: any;
  let confirmSpy: any;
  let pagosFacadeSpy: any;
  let estadoPago: WritableSignal<EstadoPagoClase | null>;
  let vehiclesError: WritableSignal<string | null>;
  let vehicleDocsUnknown: WritableSignal<boolean>;

  beforeEach(() => {
    estadoPago = signal<EstadoPagoClase | null>(null);
    vehiclesError = signal<string | null>(null);
    vehicleDocsUnknown = signal(false);
    facadeSpy = {
      selectedPractica: vi.fn().mockReturnValue({
        id: 1,
        alumnoName: 'Julio Verstappen',
        branchId: null,
        vehicleId: null,
        vehicleCurrentKm: null,
      }),
      vehiclesPorSede: vi.fn().mockReturnValue([]),
      vehiclesError: vehiclesError.asReadonly(),
      vehicleDocsUnknown: vehicleDocsUnknown.asReadonly(),
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

  describe('fix-247-b: aviso de documentos del vehículo', () => {
    const vehiculo = (id: number, plate: string, expiredDocs: string[]) => ({
      id,
      plate,
      brand: null,
      model: null,
      currentKm: 100,
      docWarning: expiredDocs.length ? { expiredDocs, expiringSoonDocs: [] } : null,
    });

    beforeEach(() => {
      facadeSpy.vehiclesPorSede.mockReturnValue([
        vehiculo(7, 'RTRE29', ['SOAP']),
        vehiculo(8, 'AB1234', []),
      ]);
    });

    it('avisa con la patente y el documento al elegir un vehículo con el SOAP vencido', () => {
      (component as any).onVehicleSelectChange(7);
      expect((component as any).vehicleDocWarning()).toBe('Vehículo RTRE29: SOAP vencido');
    });

    it('no dice nada con un vehículo al día ni sin vehículo elegido', () => {
      expect((component as any).vehicleDocWarning()).toBe('');
      (component as any).onVehicleSelectChange(8);
      expect((component as any).vehicleDocWarning()).toBe('');
    });

    it('es solo un aviso: con el SOAP vencido igual se inicia la clase', async () => {
      (component as any).onVehicleSelectChange(7);
      await component.onSubmit(facadeSpy.selectedPractica());
      expect(facadeSpy.startClass).toHaveBeenCalledWith(1, 100, 7);
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

    it('hotfix-186-b: un doble clic inicia la clase una sola vez', async () => {
      const cls = facadeSpy.selectedPractica();

      const primero = component.onSubmit(cls);
      const segundo = component.onSubmit(cls);
      await Promise.all([primero, segundo]);

      expect(facadeSpy.startClass).toHaveBeenCalledTimes(1);
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

describe('AdminIniciarClaseDrawerComponent — vehículos (spec 0060-b T3.1)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  function mount(opts: { branchId?: number | null; vehicleId?: number | null } = {}) {
    const vehiclesError = signal<string | null>(null);
    const vehicleDocsUnknown = signal(false);
    const vehiclesPorSede = signal<any[]>([]);
    const facadeSpy: any = {
      selectedPractica: vi.fn().mockReturnValue({
        id: 1,
        alumnoName: 'Julio Verstappen',
        branchId: opts.branchId ?? 1,
        vehicleId: opts.vehicleId ?? 99,
        vehiclePlate: 'XXXX11',
        vehicleCurrentKm: null,
      }),
      vehiclesPorSede: vehiclesPorSede.asReadonly(),
      vehiclesError: vehiclesError.asReadonly(),
      vehicleDocsUnknown: vehicleDocsUnknown.asReadonly(),
      loadVehiclesByBranch: vi.fn().mockResolvedValue(undefined),
      startClass: vi.fn().mockResolvedValue(undefined),
      markAttendance: vi.fn().mockResolvedValue(true),
      estadoPagoClase: signal(null).asReadonly(),
      cargarEstadoPagoClase: vi.fn().mockResolvedValue(undefined),
      habilitarSinPago: vi.fn().mockResolvedValue(true),
      isSaving: signal(false).asReadonly(),
    };

    TestBed.configureTestingModule({
      imports: [AdminIniciarClaseDrawerComponent],
      providers: [
        { provide: AsistenciaClaseBFacade, useValue: facadeSpy },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { close: vi.fn(), open: vi.fn(), push: vi.fn() },
        },
        {
          provide: DashboardFacade,
          useValue: { refreshLiveClassesOnly: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ConfirmModalService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
        { provide: PagosFacade, useValue: { seleccionarParaPago: vi.fn() } },
      ],
    }).overrideComponent(AdminIniciarClaseDrawerComponent, {
      set: {
        imports: [],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(AdminIniciarClaseDrawerComponent);
    return {
      fixture,
      component: fixture.componentInstance,
      facadeSpy,
      vehiclesError,
      vehicleDocsUnknown,
      vehiclesPorSede,
    };
  }

  it('cuando falla loadVehiclesByBranch no marca vehiclesLoaded y classVehicleUnavailable sigue false', async () => {
    const { fixture, component, facadeSpy, vehiclesError } = mount({ branchId: 1, vehicleId: 99 });
    facadeSpy.loadVehiclesByBranch.mockImplementation(async () => {
      vehiclesError.set('No se pudieron cargar los vehículos.');
    });

    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect((component as any).vehiclesLoaded()).toBe(false);
    expect((component as any).classVehicleUnavailable()).toBe(false);

    const retryBtn = fixture.nativeElement.querySelector(
      '[data-llm-action="reintentar-vehiculos-clase"]',
    ) as HTMLButtonElement | null;
    expect(retryBtn).not.toBeNull();

    vehiclesError.set(null);
    facadeSpy.loadVehiclesByBranch.mockResolvedValueOnce(undefined);
    retryBtn?.click();
    await Promise.resolve();
    expect(facadeSpy.loadVehiclesByBranch).toHaveBeenCalledTimes(2);
    expect((component as any).vehiclesLoaded()).toBe(true);
  });

  it('cuando vehicleDocsUnknown es true muestra el aviso sutil de documentación no verificada', async () => {
    const { fixture, vehiclesPorSede, vehicleDocsUnknown } = mount({
      branchId: 1,
      vehicleId: null,
    });
    vehiclesPorSede.set([
      { id: 7, plate: 'ABCD12', brand: 'Suzuki', model: 'Swift', currentKm: 100, docWarning: null },
    ]);
    vehicleDocsUnknown.set(true);

    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo revisar la documentación de los vehículos.',
    );
  });
});
