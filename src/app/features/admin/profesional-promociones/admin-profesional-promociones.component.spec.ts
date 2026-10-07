import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminProfesionalPromocionesComponent } from './admin-profesional-promociones.component';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { PromocionTableRow, PromocionStatus } from '@core/models/ui/promocion-table.model';

function makeRow(id: number, status: PromocionStatus, name = `Promo ${id}`): PromocionTableRow {
  return {
    id,
    code: String(200 + id),
    name,
    startDate: '2026-09-01',
    endDate: '2026-10-01',
    status,
    statusLabel: status,
    currentDay: 0,
    maxStudents: 100,
    totalEnrolled: 0,
    cursos: [],
  };
}

describe('AdminProfesionalPromocionesComponent', () => {
  let component: AdminProfesionalPromocionesComponent;
  let facadeSpy: any;

  const promocionesSig = signal<PromocionTableRow[]>([]);
  const canManageSig = signal(true);

  beforeEach(() => {
    promocionesSig.set([]);
    canManageSig.set(true);
    facadeSpy = {
      isLoading: signal(false),
      promociones: promocionesSig,
      totalPromociones: signal(0),
      enCurso: signal(0),
      planificadas: signal(0),
      canManageLifecycle: canManageSig,
      initialize: vi.fn(),
      selectPromocion: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AdminProfesionalPromocionesComponent],
      providers: [
        { provide: PromocionesFacade, useValue: facadeSpy },
        {
          provide: BranchFacade,
          useValue: { selectedBranchId: signal(null), setProfessionalOnly: vi.fn() },
        },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(AdminProfesionalPromocionesComponent).componentInstance;
  });

  // ─── fix-229-m: activas primero, planificadas al final ───
  it('filteredPromociones ordena in_progress primero y planned al final', () => {
    promocionesSig.set([
      makeRow(1, 'planned'),
      makeRow(2, 'in_progress'),
      makeRow(3, 'cancelled'),
      makeRow(4, 'planned'),
      makeRow(5, 'in_progress'),
      makeRow(6, 'finished'),
    ]);

    const ordered = (component as any).filteredPromociones() as PromocionTableRow[];

    expect(ordered.map((p) => p.status)).toEqual([
      'in_progress',
      'in_progress',
      'finished',
      'cancelled',
      'planned',
      'planned',
    ]);
  });

  it('mantiene el orden original del facade dentro de cada grupo de estado', () => {
    promocionesSig.set([
      makeRow(5, 'in_progress'),
      makeRow(2, 'in_progress'),
      makeRow(9, 'planned'),
    ]);

    const ordered = (component as any).filteredPromociones() as PromocionTableRow[];

    expect(ordered.map((p) => p.id)).toEqual([5, 2, 9]);
  });

  it('aplica el filtro de estado antes de ordenar', () => {
    promocionesSig.set([makeRow(1, 'planned'), makeRow(2, 'in_progress'), makeRow(3, 'planned')]);
    (component as any).filtroEstado.set('planned');

    const ordered = (component as any).filteredPromociones() as PromocionTableRow[];

    expect(ordered.map((p) => p.id)).toEqual([1, 3]);
  });

  // ─── fix-326-m (D3a): las finalizadas se consultan en Archivo, no en Promociones ───
  it('el filtro de estado no ofrece "Finalizada"', () => {
    const values = ((component as any).estadoOptions as { value: string | null }[]).map(
      (o) => o.value,
    );
    expect(values).not.toContain('finished');
    expect(values).toContain('in_progress');
  });

  // ─── fix-321-m (D5): crear promociones es solo del admin ───
  it('admin ve la acción "Programar Promoción"', () => {
    const ids = ((component as any).heroActions() as { id: string }[]).map((a) => a.id);
    expect(ids).toContain('new');
  });

  it('secretaria no ve la acción "Programar Promoción"', () => {
    canManageSig.set(false);
    const ids = ((component as any).heroActions() as { id: string }[]).map((a) => a.id);
    expect(ids).not.toContain('new');
  });

  // ─── fix-338-m (F07 / S14): error de carga ≠ "No se encontraron promociones" ───
  it('con error y sin promociones muestra el error; con datos previos no los tapa', () => {
    facadeSpy.error = signal<string | null>('No se pudieron cargar las promociones');
    expect((component as any).showLoadError()).toBe(true);

    promocionesSig.set([makeRow(1, 'in_progress')]);
    expect((component as any).showLoadError()).toBe(false);

    facadeSpy.error.set(null);
    promocionesSig.set([]);
    expect((component as any).showLoadError()).toBe(false);
  });
});
