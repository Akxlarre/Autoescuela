import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { AdminContabilidadReportesComponent } from './admin-contabilidad-reportes.component';
import { ReportesContablesFacade } from '@core/facades/reportes-contables.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

function setup() {
  const facade = {
    kpis: signal(null),
    ingresosCategoria: signal([]),
    gastosCategoria: signal([]),
    evolucionMensual: signal([]),
    escuela: signal('Escuela Centro'),
    isLoading: signal(false),
    isExporting: signal(false),
    gastosFijos: signal([]),
    rentabilidadCursos: signal([]),
    filtros: signal({ rango: 'mes_actual', desde: '2026-11-01', hasta: '2026-11-30' }),
    rangoEvolucion: signal('ultimos_6_meses'),
    error: signal<string | null>('No se pudo cargar el reporte contable.'),
    evolucionError: signal<string | null>('No se pudo cargar la evolución mensual.'),
    refreshFailed: signal(true),
    initialize: vi.fn(),
    reintentar: vi.fn(),
    aplicarFiltros: vi.fn(),
    aplicarRangoEvolucion: vi.fn(),
    exportar: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [AdminContabilidadReportesComponent],
    providers: [
      { provide: ReportesContablesFacade, useValue: facade },
      { provide: BranchFacade, useValue: { selectedBranchId: signal(null) } },
      { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn() } },
    ],
  }).overrideComponent(AdminContabilidadReportesComponent, {
    set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
  });
  const fixture = TestBed.createComponent(AdminContabilidadReportesComponent);
  fixture.detectChanges();
  const content = (fixture.nativeElement as HTMLElement).querySelector(
    'app-reportes-contables-content',
  ) as HTMLElement & Record<string, unknown>;
  return { facade, content };
}

describe('AdminContabilidadReportesComponent — lectura fallida (spec 0060-b)', () => {
  it('le entrega a la pantalla el error y el aviso del facade', () => {
    const { content } = setup();
    expect(content['error']).toBe('No se pudo cargar el reporte contable.');
    expect(content['evolucionError']).toBe('No se pudo cargar la evolución mensual.');
    expect(content['refreshFailed']).toBe(true);
  });

  it('Reintentar de la pantalla llama al facade', () => {
    const { facade, content } = setup();
    content.dispatchEvent(new Event('reintentar'));
    expect(facade.reintentar).toHaveBeenCalledOnce();
  });
});
