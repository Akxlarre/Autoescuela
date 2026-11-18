import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { LiquidacionRow } from '@core/models/ui/liquidaciones.model';
import { PagoInstructorModalComponent } from './pago-instructor-modal.component';

const FILA: LiquidacionRow = {
  instructorId: 10,
  userId: 100,
  nombre: 'Ana Sur',
  rut: '1-1',
  initials: 'AS',
  avatarColor: 'var(--ds-brand)',
  practicalSessions: 12,
  totalHours: 9,
  amountPerHour: 5000,
  totalBaseAmount: 45000,
  totalAdvances: 12000,
  finalPaymentAmount: 33000,
  status: 'pending',
};

function setup(estado: { row?: LiquidacionRow | null; puede?: boolean; saving?: boolean } = {}) {
  const facade = {
    selectedRow: signal<LiquidacionRow | null>(estado.row === undefined ? FILA : estado.row),
    puedeRegistrarPago: signal(estado.puede ?? true),
    isSaving: signal(estado.saving ?? false),
    registrarPago: vi.fn().mockResolvedValue(true),
  };
  const drawer = { close: vi.fn() };
  TestBed.configureTestingModule({
    imports: [PagoInstructorModalComponent],
    providers: [
      { provide: LiquidacionesFacade, useValue: facade },
      { provide: LayoutDrawerFacadeService, useValue: drawer },
    ],
  }).overrideComponent(PagoInstructorModalComponent, {
    set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
  });
  const fixture = TestBed.createComponent(PagoInstructorModalComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    facade,
    drawer,
    fixture,
    el,
    confirmar: () =>
      el.querySelector<HTMLButtonElement>('[data-llm-action="confirmar-pago-instructor"]')!,
  };
}

describe('PagoInstructorModalComponent — confirmación (spec 0060-b)', () => {
  it('con la carga vigente confirma la fila seleccionada y cierra', async () => {
    const { facade, drawer, fixture, confirmar } = setup();

    expect(confirmar().disabled).toBe(false);
    await fixture.componentInstance['confirmar']();

    expect(facade.registrarPago).toHaveBeenCalledWith(
      FILA,
      expect.objectContaining({ paymentMethod: 'cash' }),
    );
    expect(drawer.close).toHaveBeenCalledOnce();
  });

  it('sin carga vigente: confirmar deshabilitado, con aviso, y no registra', async () => {
    const { facade, drawer, fixture, el, confirmar } = setup({ puede: false });

    expect(confirmar().disabled).toBe(true);
    expect(el.querySelector('app-alert-card')).not.toBeNull();
    await fixture.componentInstance['confirmar']();

    expect(facade.registrarPago).not.toHaveBeenCalled();
    expect(drawer.close).not.toHaveBeenCalled();
  });

  it('si la fila se retiró (cambio de mes o sede), avisa y no deja confirmar', async () => {
    const { facade, fixture, el, confirmar } = setup({ row: null });

    expect(confirmar().disabled).toBe(true);
    expect(el.textContent).toContain('ya no está disponible');
    await fixture.componentInstance['confirmar']();

    expect(facade.registrarPago).not.toHaveBeenCalled();
  });

  it('una fila que quedó pagada mientras estaba abierto no se confirma', () => {
    const { confirmar } = setup({ row: { ...FILA, status: 'paid', paymentId: 1 } });

    expect(confirmar().disabled).toBe(true);
  });

  it('mientras guarda no se puede confirmar otra vez', () => {
    const { confirmar } = setup({ saving: true });

    expect(confirmar().disabled).toBe(true);
  });

  it('si un refresco actualiza la misma fila, conserva lo que se estaba escribiendo', () => {
    const { facade, fixture } = setup();
    const modal = fixture.componentInstance;
    modal['paymentMethod'].set('transfer');
    modal['transferCode'].set('123');

    facade.selectedRow.set({ ...FILA, totalAdvances: 20000, finalPaymentAmount: 25000 });
    fixture.detectChanges();

    expect(modal['paymentMethod']()).toBe('transfer');
    expect(modal['transferCode']()).toBe('123');
  });

  it('al cambiar de instructor limpia el formulario', () => {
    const { facade, fixture } = setup();
    const modal = fixture.componentInstance;
    modal['paymentMethod'].set('transfer');
    modal['transferCode'].set('123');
    fixture.detectChanges();

    facade.selectedRow.set({ ...FILA, instructorId: 20 });
    fixture.detectChanges();

    expect(modal['paymentMethod']()).toBe('cash');
    expect(modal['transferCode']()).toBe('');
  });
});
