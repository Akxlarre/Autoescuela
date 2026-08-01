import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminAuditoriaComponent } from './admin-auditoria.component';
import { AuditoriaFacade } from '@core/facades/auditoria.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AuditLogDetailDrawerComponent } from './audit-log-detail-drawer.component';
import type { AuditLogRow } from '@core/models/ui/audit-log-row.model';

describe('AdminAuditoriaComponent', () => {
  let component: AdminAuditoriaComponent;
  let facadeSpy: any;
  let layoutDrawerSpy: any;

  const mockLog: AuditLogRow = {
    id: 97,
    fechaHora: '2026-05-21T21:53:47.000Z',
    usuarioNombre: 'María Torres',
    usuarioEmail: 'secretaria2@test.com',
    sedeNombre: 'Conductores Chillán',
    accion: 'Crear',
    modulo: 'Alumnos',
    detalle: 'Registrado: María Torres',
    ip: '—',
  };

  beforeEach(() => {
    facadeSpy = {
      isLoading: signal(false),
      logs: signal([mockLog]),
      totalCount: signal(1),
      currentPage: signal(1),
      secretarias: signal([]),
      isExporting: signal(false),
      selectedLog: signal(null),
      initialize: vi.fn(),
      setFilters: vi.fn(),
      clearFilters: vi.fn(),
      setPage: vi.fn(),
      selectLog: vi.fn(),
      exportar: vi.fn().mockResolvedValue(undefined),
    };
    layoutDrawerSpy = { open: vi.fn(), close: vi.fn(), isOpen: signal(false) };

    TestBed.configureTestingModule({
      imports: [AdminAuditoriaComponent],
      providers: [
        { provide: AuditoriaFacade, useValue: facadeSpy },
        { provide: BranchFacade, useValue: { selectedBranchId: signal(null) } },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
      ],
    });

    component = TestBed.createComponent(AdminAuditoriaComponent).componentInstance;
  });

  // ─── fix-097-m: la fila de auditoría abre el drawer de detalle completo ───
  describe('verDetalle (fix-097-m)', () => {
    it('abre el drawer de detalle al hacer click en una fila', () => {
      (component as any).verDetalle(mockLog);

      expect(facadeSpy.selectLog).toHaveBeenCalledWith(mockLog);
      expect(layoutDrawerSpy.open).toHaveBeenCalledWith(
        AuditLogDetailDrawerComponent,
        'Detalle de Auditoría',
        'file-text',
      );
    });
  });
});
