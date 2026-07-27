import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SecretariaContabilidadCuadraturaComponent } from './secretaria-contabilidad-cuadratura.component';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

describe('SecretariaContabilidadCuadraturaComponent', () => {
  let component: SecretariaContabilidadCuadraturaComponent;
  let pagosFacadeSpy: any;
  let layoutDrawerSpy: any;

  beforeEach(() => {
    pagosFacadeSpy = {
      seleccionarParaPago: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    layoutDrawerSpy = { close: vi.fn(), open: vi.fn(), isOpen: signal(false) };

    TestBed.configureTestingModule({
      imports: [SecretariaContabilidadCuadraturaComponent],
      providers: [
        {
          provide: CuadraturaFacade,
          useValue: {
            pagosHoy: signal([]),
            gastosHoy: signal([]),
            fondoInicial: signal(0),
            ingresosEfectivoHoy: signal(0),
            totalIngresosHoy: signal(0),
            totalEgresosHoy: signal(0),
            saldoTeoricoEfectivo: signal(0),
            cajaYaCerrada: signal(false),
            isLoading: signal(false),
            isSaving: signal(false),
            isExporting: signal(false),
            initialize: vi.fn(),
          },
        },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: ConfirmModalService, useValue: {} },
        { provide: PagosFacade, useValue: pagosFacadeSpy },
      ],
    });

    component = TestBed.createComponent(
      SecretariaContabilidadCuadraturaComponent,
    ).componentInstance;
  });

  // ─── fix-080: Registrar Pago carga alumnos con deuda desde Caja Diaria ─────
  describe('openIngresoDrawer (fix-080)', () => {
    it('llama pagosFacade.seleccionarParaPago(null) e initialize() antes de abrir el drawer', () => {
      (component as any).openIngresoDrawer();

      expect(pagosFacadeSpy.seleccionarParaPago).toHaveBeenCalledWith(null);
      expect(pagosFacadeSpy.initialize).toHaveBeenCalled();
      expect(layoutDrawerSpy.open).toHaveBeenCalled();
    });
  });
});
