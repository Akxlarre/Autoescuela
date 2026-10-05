import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminPromocionEditarDrawerComponent } from './admin-promocion-editar-drawer.component';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { PromocionStatus, PromocionTableRow } from '@core/models/ui/promocion-table.model';

function makePromo(status: PromocionStatus): PromocionTableRow {
  return {
    id: 1,
    code: '279',
    name: 'Promoción 279',
    startDate: '2026-01-05',
    endDate: '2026-02-06',
    status,
    statusLabel: status,
    currentDay: 0,
    maxStudents: 100,
    totalEnrolled: 0,
    cursos: [],
  };
}

describe('AdminPromocionEditarDrawerComponent — opciones de estado por rol (fix-321-m, D5)', () => {
  const selected = signal<PromocionTableRow | null>(null);
  const canManage = signal(true);

  function options(status: PromocionStatus): PromocionStatus[] {
    selected.set(makePromo(status));
    const component = TestBed.createComponent(
      AdminPromocionEditarDrawerComponent,
    ).componentInstance;
    return ((component as any).availableStatusOptions() as { value: PromocionStatus }[]).map(
      (o) => o.value,
    );
  }

  beforeEach(() => {
    canManage.set(true);
    TestBed.configureTestingModule({
      imports: [AdminPromocionEditarDrawerComponent],
      providers: [
        {
          provide: PromocionesFacade,
          useValue: {
            selectedPromocion: selected,
            canManageLifecycle: canManage,
            isSubmitting: signal(false),
            editarPromocion: vi.fn(),
          },
        },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    });
  });

  it('admin, promoción en curso → puede finalizar o cancelar', () => {
    expect(options('in_progress')).toEqual(['in_progress', 'finished', 'cancelled']);
  });

  it('secretaria, promoción en curso → solo "En curso" (sin Finalizada ni Cancelada)', () => {
    canManage.set(false);
    expect(options('in_progress')).toEqual(['in_progress']);
  });

  it('secretaria, promoción planificada ya iniciada → Planificada y En curso, sin Cancelada', () => {
    canManage.set(false);
    expect(options('planned')).toEqual(['planned', 'in_progress']);
  });
});
