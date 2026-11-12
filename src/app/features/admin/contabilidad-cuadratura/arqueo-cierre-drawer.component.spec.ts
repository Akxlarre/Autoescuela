import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArqueoCierreDrawerComponent } from './arqueo-cierre-drawer.component';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

describe('ArqueoCierreDrawerComponent — confirmación de "Cerrar Caja" (fix-074-i)', () => {
  let component: ArqueoCierreDrawerComponent;
  let confirm: ReturnType<typeof vi.fn>;
  let cerrarCaja: ReturnType<typeof vi.fn>;
  const realizarArqueo = signal(false);

  beforeEach(() => {
    confirm = vi.fn().mockResolvedValue(false);
    cerrarCaja = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: CuadraturaFacade, useValue: { realizarArqueo, cerrarCaja } },
        { provide: LayoutDrawerFacadeService, useValue: { close: vi.fn() } },
        { provide: ConfirmModalService, useValue: { confirm } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new ArqueoCierreDrawerComponent());
  });

  const mensaje = (): string => confirm.mock.calls[0][0].message;

  it('sin arqueo avisa que se cierra sin contar el efectivo', async () => {
    realizarArqueo.set(false);
    await (component as any).onCerrarCaja();
    expect(mensaje()).toContain('sin contar el efectivo');
  });

  it('con arqueo no dice que se cierra sin contar', async () => {
    realizarArqueo.set(true);
    await (component as any).onCerrarCaja();
    expect(mensaje()).not.toContain('sin contar');
  });

  it('si se cancela la confirmación no cierra la caja', async () => {
    await (component as any).onCerrarCaja();
    expect(cerrarCaja).not.toHaveBeenCalled();
  });
});
