import { TestBed } from '@angular/core/testing';
import { RegistrarAjusteCuadraturaDrawerComponent } from './registrar-ajuste-cuadratura-drawer.component';
import { HistorialCuadraturasFacade } from '@core/facades/historial-cuadraturas.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { signal } from '@angular/core';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';

// ─── spec 0002-i: tipo de ajuste + campos condicionales + selector de vehículo ───

describe('RegistrarAjusteCuadraturaDrawerComponent', () => {
  const mkCierre = (): HistorialCierre =>
    ({
      id: 1,
      branchId: 2,
      fecha: '2026-07-15',
      closed: true,
      fondoInicial: 50_000,
      saldoSistema: 100_000,
      saldoFisico: 100_000,
      diferencia: 0,
      cajero: 'Ana Pérez',
      totalIngresos: 150_000,
      totalEgresos: 50_000,
      estadoDiferencia: 'balanced',
      qtyBill20000: 0,
      qtyBill10000: 0,
      qtyBill5000: 0,
      qtyBill2000: 0,
      qtyBill1000: 0,
      qtyCoin500: 0,
      qtyCoin100: 0,
      qtyCoin50: 0,
      qtyCoin10: 0,
      notes: null,
    }) as HistorialCierre;

  function createComponent(vehicles: any[] = []) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: HistorialCuadraturasFacade,
          useValue: {
            cierreSeleccionado: signal(mkCierre()),
            registrarAjuste: vi.fn(),
          },
        },
        { provide: FlotaFacade, useValue: { vehicles: () => vehicles, initialize: vi.fn() } },
        { provide: LayoutDrawerFacadeService, useValue: { close: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });
    return TestBed.createComponent(RegistrarAjusteCuadraturaDrawerComponent).componentInstance;
  }

  it('isGastoOlvidado() es true cuando el tipo seleccionado es "gasto_olvidado"', () => {
    const component = createComponent();
    component['form'].patchValue({ tipo: 'gasto_olvidado' });
    expect(component['isGastoOlvidado']()).toBe(true);
  });

  it('isGastoOlvidado() es false para "correccion_manual"', () => {
    const component = createComponent();
    component['form'].patchValue({ tipo: 'correccion_manual' });
    expect(component['isGastoOlvidado']()).toBe(false);
  });

  it('isCombustible() refleja la categoría seleccionada', () => {
    const component = createComponent();
    component['form'].patchValue({ tipo: 'gasto_olvidado', categoria: 'combustible' });
    expect(component['isCombustible']()).toBe(true);
  });

  it('vehicleOptions() replica el formato de RegistrarEgresoDrawerComponent', () => {
    const component = createComponent([
      { id: 1, brand: 'Toyota', model: 'Yaris', licensePlate: 'ABC-123', instructorName: 'Juan' },
    ]);
    expect(component['vehicleOptions']()[0].label).toBe(
      'Toyota Yaris - ABC-123 (Asignado a: Juan)',
    );
  });

  it('fechaCierre() formatea la fecha del cierre seleccionado como dd/MM/yyyy', () => {
    const component = createComponent();
    expect(component['fechaCierre']()).toBe('15/07/2026');
  });

  describe('validación condicional (categoría requerida solo en gasto olvidado)', () => {
    it('bloquea el submit si tipo="gasto_olvidado" y falta categoría', async () => {
      const component = createComponent();
      component['form'].patchValue({
        tipo: 'gasto_olvidado',
        monto: 5000,
        motivo: 'Combustible olvidado',
      });

      await component['onSubmit']();

      expect(component['form'].get('categoria')?.invalid).toBe(true);
    });

    it('NO exige categoría cuando tipo="correccion_manual"', async () => {
      const facadeSpy = { registrarAjuste: vi.fn().mockResolvedValue(true) };
      TestBed.overrideProvider(HistorialCuadraturasFacade, {
        useValue: { cierreSeleccionado: signal(mkCierre()), ...facadeSpy },
      });
      const component = createComponent();
      component['form'].patchValue({
        tipo: 'correccion_manual',
        efecto: 'aumenta',
        monto: 2000,
        motivo: 'Corrección de conteo',
      });

      await component['onSubmit']();

      expect(component['form'].get('categoria')?.invalid).toBe(false);
      expect(facadeSpy.registrarAjuste).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'correccion_manual', monto: 2000, categoria: undefined }),
      );
    });

    it('gasto_olvidado envía el monto siempre en negativo (reduce el total vigente)', async () => {
      const facadeSpy = { registrarAjuste: vi.fn().mockResolvedValue(true) };
      TestBed.overrideProvider(HistorialCuadraturasFacade, {
        useValue: { cierreSeleccionado: signal(mkCierre()), ...facadeSpy },
      });
      const component = createComponent();
      component['form'].patchValue({
        tipo: 'gasto_olvidado',
        categoria: 'combustible',
        monto: 5000,
        motivo: 'Combustible olvidado',
      });

      await component['onSubmit']();

      expect(facadeSpy.registrarAjuste).toHaveBeenCalledWith(
        expect.objectContaining({ monto: -5000 }),
      );
    });
  });

  describe('efecto explícito (feedback de usuario, 2026-08-06 — signo no intuitivo)', () => {
    it('bloquea el submit si tipo="correccion_manual" y no se eligió efecto', async () => {
      const facadeSpy = { registrarAjuste: vi.fn().mockResolvedValue(true) };
      TestBed.overrideProvider(HistorialCuadraturasFacade, {
        useValue: { cierreSeleccionado: signal(mkCierre()), ...facadeSpy },
      });
      const component = createComponent();
      component['form'].patchValue({
        tipo: 'correccion_manual',
        monto: 2000,
        motivo: 'Corrección de conteo',
      });

      await component['onSubmit']();

      expect(component['form'].get('efecto')?.invalid).toBe(true);
      expect(facadeSpy.registrarAjuste).not.toHaveBeenCalled();
    });

    it('efecto="reduce" envía el monto en negativo', async () => {
      const facadeSpy = { registrarAjuste: vi.fn().mockResolvedValue(true) };
      TestBed.overrideProvider(HistorialCuadraturasFacade, {
        useValue: { cierreSeleccionado: signal(mkCierre()), ...facadeSpy },
      });
      const component = createComponent();
      component['form'].patchValue({
        tipo: 'correccion_manual',
        efecto: 'reduce',
        monto: 3000,
        motivo: 'Faltó dinero en el conteo',
      });

      await component['onSubmit']();

      expect(facadeSpy.registrarAjuste).toHaveBeenCalledWith(
        expect.objectContaining({ monto: -3000 }),
      );
    });

    it('efecto="aumenta" envía el monto en positivo', async () => {
      const facadeSpy = { registrarAjuste: vi.fn().mockResolvedValue(true) };
      TestBed.overrideProvider(HistorialCuadraturasFacade, {
        useValue: { cierreSeleccionado: signal(mkCierre()), ...facadeSpy },
      });
      const component = createComponent();
      component['form'].patchValue({
        tipo: 'correccion_manual',
        efecto: 'aumenta',
        monto: 3000,
        motivo: 'Sobró dinero en el conteo',
      });

      await component['onSubmit']();

      expect(facadeSpy.registrarAjuste).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 3000 }),
      );
    });

    describe('montoConSigno() — preview en vivo', () => {
      it('es negativo para gasto_olvidado sin importar el efecto', () => {
        const component = createComponent();
        component['form'].patchValue({ tipo: 'gasto_olvidado', monto: 4000 });
        expect(component['montoConSigno']()).toBe(-4000);
      });

      it('es null en correccion_manual mientras no se elige efecto', () => {
        const component = createComponent();
        component['form'].patchValue({ tipo: 'correccion_manual', monto: 4000 });
        expect(component['montoConSigno']()).toBeNull();
      });

      it('refleja el efecto elegido en correccion_manual', () => {
        const component = createComponent();
        component['form'].patchValue({ tipo: 'correccion_manual', monto: 4000, efecto: 'reduce' });
        expect(component['montoConSigno']()).toBe(-4000);

        component['form'].patchValue({ efecto: 'aumenta' });
        expect(component['montoConSigno']()).toBe(4000);
      });

      it('es null sin monto ingresado', () => {
        const component = createComponent();
        component['form'].patchValue({ tipo: 'correccion_manual', efecto: 'aumenta' });
        expect(component['montoConSigno']()).toBeNull();
      });
    });
  });
});
