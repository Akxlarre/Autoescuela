import { TestBed } from '@angular/core/testing';
import { RegistrarPagoDrawerComponent } from './registrar-pago-drawer.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('RegistrarPagoDrawerComponent', () => {
  let component: RegistrarPagoDrawerComponent;
  let facadeSpy: any;
  let layoutDrawerSpy: any;
  let sanitizerSpy: any;

  function setup(opts?: {
    enrollmentSeleccionado?: number | null;
    alumnosConDeuda?: unknown[];
    estadoCuentaResumen?: unknown;
  }): void {
    facadeSpy = {
      enrollmentSeleccionado: vi.fn().mockReturnValue(opts?.enrollmentSeleccionado ?? null),
      alumnosConDeuda: vi.fn().mockReturnValue(opts?.alumnosConDeuda ?? []),
      estadoCuentaResumen: vi.fn().mockReturnValue(opts?.estadoCuentaResumen ?? null),
      registrarNuevoPago: vi.fn().mockResolvedValue(undefined),
      showSuccess: vi.fn(),
    };
    layoutDrawerSpy = { back: vi.fn() };
    sanitizerSpy = { sanitize: vi.fn().mockReturnValue({ message: 'Error sanitizado' }) };

    TestBed.configureTestingModule({
      providers: [
        RegistrarPagoDrawerComponent,
        { provide: PagosFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: ErrorSanitizerService, useValue: sanitizerSpy },
      ],
    });

    component = TestBed.inject(RegistrarPagoDrawerComponent);
  }

  it('should be created', () => {
    setup();
    expect(component).toBeTruthy();
  });

  it('los campos de desglose inician en null (no en 0) para que el placeholder sea visible', () => {
    setup();

    expect((component as any).form.get('cash_amount')?.value).toBeNull();
    expect((component as any).form.get('transfer_amount')?.value).toBeNull();
    expect((component as any).form.get('card_amount')?.value).toBeNull();
    expect((component as any).form.get('voucher_amount')?.value).toBeNull();
  });

  it('onSubmit() invoca registrarNuevoPago con los montos del formulario cuando es válido (modo global)', async () => {
    setup({ alumnosConDeuda: [] });

    (component as any).form.patchValue({
      type: 'Abono',
      total_amount: 50000,
      cash_amount: 50000,
    });

    await (component as any).onSubmit();

    expect(facadeSpy.registrarNuevoPago).toHaveBeenCalledTimes(1);
    const [enrollmentId, payload] = facadeSpy.registrarNuevoPago.mock.calls[0];
    expect(enrollmentId).toBeNull();
    expect(payload.total_amount).toBe(50000);
    expect(facadeSpy.showSuccess).toHaveBeenCalled();
    expect(layoutDrawerSpy.back).toHaveBeenCalled();
  });

  it('onSubmit() NO invoca registrarNuevoPago si el formulario es inválido (monto en 0)', async () => {
    setup({ alumnosConDeuda: [] });

    (component as any).form.patchValue({
      type: 'Abono',
      total_amount: null,
    });

    await (component as any).onSubmit();

    expect(facadeSpy.registrarNuevoPago).not.toHaveBeenCalled();
  });

  it('onSubmit() prioriza estadoCuentaResumen sobre la lista de deudores para montosActuales', async () => {
    setup({
      enrollmentSeleccionado: 42,
      alumnosConDeuda: [{ enrollmentId: 42, alumno: 'X', rut: '1-1', saldo: 999, pagado: 1 }],
      estadoCuentaResumen: { enrollmentId: 42, totalPagado: 100, saldoPendiente: 900 },
    });

    (component as any).form.patchValue({
      type: 'Abono',
      total_amount: 500,
      cash_amount: 500,
    });

    await (component as any).onSubmit();

    const [, , montosActuales] = facadeSpy.registrarNuevoPago.mock.calls[0];
    expect(montosActuales).toEqual({ total_paid: 100, pending_balance: 900 });
  });

  it('onSubmit() BLOQUEA el guardado si el monto excede el saldo pendiente (regresión H-024)', async () => {
    setup({
      enrollmentSeleccionado: 42,
      alumnosConDeuda: [],
      estadoCuentaResumen: { enrollmentId: 42, totalPagado: 10000, saldoPendiente: 90000 },
    });

    (component as any).form.patchValue({
      type: 'Abono',
      total_amount: 200000000,
      cash_amount: 200000000,
    });

    await (component as any).onSubmit();

    expect(facadeSpy.registrarNuevoPago).not.toHaveBeenCalled();
    expect((component as any).saveError()).toContain('excede el saldo pendiente');
    expect((component as any).saldoExcedido).toBe(true);
  });

  it('onSubmit() PERMITE pagar exactamente el saldo pendiente completo (ej. alumno con "pago pendiente" al matricularse)', async () => {
    setup({
      enrollmentSeleccionado: 42,
      alumnosConDeuda: [],
      // Matrícula con método 'pendiente': total_paid=0, pending_balance=base_price-discount (ej. $180.000)
      estadoCuentaResumen: { enrollmentId: 42, totalPagado: 0, saldoPendiente: 180000 },
    });

    (component as any).form.patchValue({
      type: 'Pago Total',
      total_amount: 180000,
      cash_amount: 180000,
    });

    expect((component as any).saldoExcedido).toBe(false);

    await (component as any).onSubmit();

    expect(facadeSpy.registrarNuevoPago).toHaveBeenCalledTimes(1);
    expect((component as any).saveError()).toBeNull();
  });

  it('saldoExcedido es false si no hay matrícula asociada (pago sin vínculo permitido)', () => {
    setup({ alumnosConDeuda: [] });

    (component as any).form.patchValue({ total_amount: 999999999 });

    expect((component as any).saldoExcedido).toBe(false);
  });

  it('onSubmit() expone el error sanitizado si registrarNuevoPago rechaza (ej: insert bloqueado por RLS)', async () => {
    setup({ alumnosConDeuda: [] });
    facadeSpy.registrarNuevoPago.mockRejectedValue(new Error('insert failed'));

    (component as any).form.patchValue({
      type: 'Abono',
      total_amount: 50000,
      cash_amount: 50000,
    });

    await (component as any).onSubmit();

    expect((component as any).saveError()).toBe('Error sanitizado');
    expect(layoutDrawerSpy.back).not.toHaveBeenCalled();
  });
});
