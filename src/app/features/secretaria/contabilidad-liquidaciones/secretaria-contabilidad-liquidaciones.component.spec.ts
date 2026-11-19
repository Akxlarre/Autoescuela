import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { SecretariaContabilidadLiquidacionesComponent } from './secretaria-contabilidad-liquidaciones.component';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { RegistrarAnticipoDrawerComponent } from '../../admin/contabilidad-anticipos/registrar-anticipo-drawer.component';
import type { LiquidacionRow, LiquidacionesKpis } from '@core/models/ui/liquidaciones.model';

const FILA = { instructorId: 10, nombre: 'Ana Sur', status: 'pending' } as LiquidacionRow;
const KPIS: LiquidacionesKpis = {
  totalNomina: 45000,
  totalAnticipos: 0,
  totalPagados: 0,
  totalInstructores: 1,
};
const MENSAJE = 'No se pudieron cargar las liquidaciones.';

function setup(estado: {
  error?: string | null;
  refreshFailed?: boolean;
  puede?: boolean;
  filas?: LiquidacionRow[];
  kpis?: LiquidacionesKpis | null;
}) {
  const facade = {
    liquidaciones: signal(estado.filas ?? [FILA]),
    kpis: signal(estado.kpis === undefined ? KPIS : estado.kpis),
    isLoading: signal(false),
    isExporting: signal(false),
    mesActual: signal(11),
    anioActual: signal(2026),
    puedeAvanzarMes: signal(false),
    error: signal(estado.error ?? null),
    refreshFailed: signal(estado.refreshFailed ?? false),
    reintentando: signal(false),
    puedeRegistrarPago: signal(estado.puede ?? true),
    initialize: vi.fn(),
    reintentar: vi.fn(),
    mesAnterior: vi.fn(),
    mesSiguiente: vi.fn(),
    deshacerPago: vi.fn(),
    exportar: vi.fn(),
    destroyRealtime: vi.fn(),
    seleccionarParaPago: vi.fn(),
  };
  const selectedBranchId = signal<number | null>(1);
  const anticipos = { selectInstructor: vi.fn(), initialize: vi.fn().mockResolvedValue(undefined) };
  const drawer = { isOpen: signal(false), open: vi.fn() };
  TestBed.configureTestingModule({
    imports: [SecretariaContabilidadLiquidacionesComponent],
    providers: [
      { provide: LiquidacionesFacade, useValue: facade },
      { provide: BranchFacade, useValue: { selectedBranchId } },
      { provide: AnticiposFacade, useValue: anticipos },
      { provide: LayoutDrawerFacadeService, useValue: drawer },
    ],
  }).overrideComponent(SecretariaContabilidadLiquidacionesComponent, {
    set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
  });
  const fixture = TestBed.createComponent(SecretariaContabilidadLiquidacionesComponent);
  fixture.detectChanges();
  const content = (fixture.nativeElement as HTMLElement).querySelector(
    'app-liquidaciones-content',
  ) as HTMLElement & Record<string, unknown>;
  return { facade, anticipos, drawer, selectedBranchId, fixture, content };
}

describe('SecretariaContabilidadLiquidacionesComponent — Dar anticipo (spec 0012-i AC16)', () => {
  it('abre el registro de anticipo con el instructor de la fila ya elegido', async () => {
    const { anticipos, drawer, content } = setup({});

    content.dispatchEvent(Object.assign(new Event('darAnticipo'), { instructorId: 10 }));

    await vi.waitFor(() => expect(anticipos.selectInstructor).toHaveBeenCalledWith(10));
    expect(anticipos.initialize).toHaveBeenCalledOnce();
    expect(drawer.open).toHaveBeenCalledWith(
      RegistrarAnticipoDrawerComponent,
      'Registrar Anticipo',
      'banknote',
    );
  });
});

describe('SecretariaContabilidadLiquidacionesComponent — lecturas fallidas (spec 0060-b)', () => {
  it('caso A: entrega el error, sin filas ni KPIs, y bloquea el pago', () => {
    const { content } = setup({ error: MENSAJE, puede: false, filas: [], kpis: null });

    expect(content['error']).toBe(MENSAJE);
    expect(content['liquidaciones']).toEqual([]);
    expect(content['kpis']).toBeNull();
    expect(content['puedeRegistrarPago']).toBe(false);
  });

  it('caso B: entrega el aviso y conserva filas y KPIs, con el pago bloqueado', () => {
    const { content } = setup({ refreshFailed: true, puede: false });

    expect(content['refreshFailed']).toBe(true);
    expect(content['error']).toBeNull();
    expect(content['liquidaciones']).toEqual([FILA]);
    expect(content['kpis']).toEqual(KPIS);
    expect(content['puedeRegistrarPago']).toBe(false);
  });

  it('Reintentar de la pantalla llama al facade', () => {
    const { facade, content } = setup({ error: MENSAJE, puede: false });

    content.dispatchEvent(new Event('reintentar'));

    expect(facade.reintentar).toHaveBeenCalledOnce();
  });

  it('spec 0017: con acceso a ambas sedes, cambiar de sede recarga', () => {
    const { facade, selectedBranchId, fixture } = setup({});
    expect(facade.initialize).toHaveBeenCalledOnce();

    selectedBranchId.set(2);
    fixture.detectChanges();

    expect(facade.initialize).toHaveBeenCalledTimes(2);
  });
});
