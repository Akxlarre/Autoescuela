import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { AdminPagoDetalleDrawerComponent } from './admin-pago-detalle-drawer.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { EstadoCuentaResumen } from '@core/models/ui/pagos.model';

// ─── spec 0060-b (T1.1): un Estado de Cuenta que no cargó no es "matrícula no encontrada" ───
describe('AdminPagoDetalleDrawerComponent — lecturas fallidas (spec 0060-b)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AdminPagoDetalleDrawerComponent>>;
  let facade: any;

  const resumen = {
    enrollmentId: 7,
    alumno: 'Ana Soto',
    rut: '1-9',
    curso: 'Clase B',
    basePrice: 100000,
    descuento: 0,
    totalACurso: 100000,
    totalPagado: 20000,
    saldoPendiente: 80000,
    paymentStatus: 'partial',
  } as EstadoCuentaResumen;

  function render(estado: {
    errorDetalle: string | null;
    detalleRefreshFailed: boolean;
    resumen: EstadoCuentaResumen | null;
  }): void {
    facade = {
      enrollmentSeleccionado: signal(7),
      isLoadingDetalle: signal(false),
      errorDetalle: signal(estado.errorDetalle),
      detalleRefreshFailed: signal(estado.detalleRefreshFailed),
      estadoCuentaResumen: signal(estado.resumen),
      estadoCuentaHistorial: signal([]),
      cargarEstadoCuenta: vi.fn(),
      reintentarEstadoCuenta: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [AdminPagoDetalleDrawerComponent],
      providers: [
        { provide: PagosFacade, useValue: facade },
        { provide: LayoutDrawerFacadeService, useValue: { push: vi.fn() } },
      ],
    }).overrideComponent(AdminPagoDetalleDrawerComponent, {
      set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
    });
    fixture = TestBed.createComponent(AdminPagoDetalleDrawerComponent);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  it('caso A: muestra el error con "Reintentar", no "No se encontró la matrícula"', () => {
    render({
      errorDetalle: 'No se pudo cargar el estado de cuenta.',
      detalleRefreshFailed: false,
      resumen: null,
    });

    expect(el().textContent).not.toContain('No se encontró la matrícula');
    const empty = el().querySelector('app-empty-state');
    expect((empty as any)?.message).toBe('No se pudo cargar el estado de cuenta.');
    expect(empty?.getAttribute('actionLabel')).toBe('Reintentar');
    empty!.dispatchEvent(new CustomEvent('action'));
    expect(facade.reintentarEstadoCuenta).toHaveBeenCalledTimes(1);
  });

  it('caso B: conserva el estado de cuenta y muestra el aviso con "Reintentar"', () => {
    render({ errorDetalle: null, detalleRefreshFailed: true, resumen });

    expect(el().textContent).toContain('Ana Soto');
    const btn = el().querySelector(
      'app-alert-card button[data-llm-action="reintentar-estado-cuenta"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(facade.reintentarEstadoCuenta).toHaveBeenCalledTimes(1);
  });

  it('sin fila (borrada o fuera de la RLS) sigue diciendo "No se encontró la matrícula"', () => {
    render({ errorDetalle: null, detalleRefreshFailed: false, resumen: null });
    expect(el().textContent).toContain('No se encontró la matrícula');
  });
});
