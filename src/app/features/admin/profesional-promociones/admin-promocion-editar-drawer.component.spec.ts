import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminPromocionEditarDrawerComponent } from './admin-promocion-editar-drawer.component';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
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
            countActiveEnrollments: vi.fn().mockResolvedValue(0),
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

  // ─── fix-323-m (S7): el número se valida siempre, no solo cuando es lo único que cambió ───
  describe('canSave valida el número en cualquier cambio (fix-323-m, S7)', () => {
    function editor(): any {
      selected.set(makePromo('in_progress'));
      const component = TestBed.createComponent(AdminPromocionEditarDrawerComponent)
        .componentInstance as any;
      component.name.set('Promoción 279');
      component.code.set('279');
      component.status.set('in_progress');
      return component;
    }

    it('nombre cambiado + número con letras → no guarda', () => {
      const c = editor();
      c.name.set('Promoción 279 bis');
      c.code.set('abc');
      expect(c.canSave()).toBe(false);
    });

    it('estado cambiado + número vacío → no guarda', () => {
      const c = editor();
      c.status.set('finished');
      c.code.set('');
      expect(c.canSave()).toBe(false);
    });

    it('nombre vacío → no guarda', () => {
      const c = editor();
      c.name.set('   ');
      c.code.set('281');
      expect(c.canSave()).toBe(false);
    });

    it('nombre cambiado + número válido → guarda', () => {
      const c = editor();
      c.name.set('Promoción 279 bis');
      expect(c.canSave()).toBe(true);
    });
  });
});

describe('AdminPromocionEditarDrawerComponent — finalizar pide confirmación (fix-324-m, D3b)', () => {
  let facadeSpy: any;
  let confirmSpy: any;

  function editor(): any {
    const component = TestBed.createComponent(AdminPromocionEditarDrawerComponent)
      .componentInstance as any;
    component.name.set('Promoción 279');
    component.code.set('279');
    component.status.set('in_progress');
    return component;
  }

  beforeEach(() => {
    facadeSpy = {
      selectedPromocion: signal(makePromo('in_progress')),
      canManageLifecycle: signal(true),
      isSubmitting: signal(false),
      editarPromocion: vi.fn().mockResolvedValue(true),
      countActiveEnrollments: vi.fn().mockResolvedValue(12),
      initialize: vi.fn(),
    };
    confirmSpy = { confirm: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AdminPromocionEditarDrawerComponent],
      providers: [
        { provide: PromocionesFacade, useValue: facadeSpy },
        { provide: ConfirmModalService, useValue: confirmSpy },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    });
  });

  it('pasar a Finalizada pregunta antes de guardar e informa cuántos alumnos pasan a completados', async () => {
    confirmSpy.confirm.mockResolvedValue(true);
    const c = editor();
    c.status.set('finished');

    await c.submit();

    expect(facadeSpy.countActiveEnrollments).toHaveBeenCalledWith(1);
    expect(confirmSpy.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('12 alumnos') }),
    );
    expect(facadeSpy.editarPromocion).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'finished' }),
    );
  });

  it('si se cancela la confirmación, no guarda', async () => {
    confirmSpy.confirm.mockResolvedValue(false);
    const c = editor();
    c.status.set('finished');

    await c.submit();

    expect(facadeSpy.editarPromocion).not.toHaveBeenCalled();
  });

  // ─── fix-346-m ───
  it('dos clics seguidos en Guardar → un solo guardado', async () => {
    const c = editor();
    c.name.set('Promoción 279 bis');

    await Promise.all([c.submit(), c.submit()]);

    expect(facadeSpy.editarPromocion).toHaveBeenCalledTimes(1);
  });

  it('tras terminar un guardado fallido se puede volver a guardar', async () => {
    facadeSpy.editarPromocion.mockResolvedValue(false);
    const c = editor();
    c.name.set('Promoción 279 bis');

    await c.submit();
    await c.submit();

    expect(facadeSpy.editarPromocion).toHaveBeenCalledTimes(2);
  });

  it('al cambiar el número, el nombre automático lo sigue (D18)', () => {
    facadeSpy.selectedPromocion.set({
      ...makePromo('planned'),
      code: '9001',
      name: 'Promoción 9001 (30 de Noviembre 2026)',
    });
    const c = editor();
    c.name.set('Promoción 9001 (30 de Noviembre 2026)');
    c.code.set('9001');

    c.codeModel = '9002';

    expect(c.name()).toBe('Promoción 9002 (30 de Noviembre 2026)');
  });

  it('si el nombre se escribió a mano, cambiar el número no lo toca', () => {
    facadeSpy.selectedPromocion.set({
      ...makePromo('planned'),
      code: '9001',
      name: 'Promoción 9001 (30 de Noviembre 2026)',
    });
    const c = editor();
    c.nameModel = 'Promoción de verano';

    c.codeModel = '9002';

    expect(c.name()).toBe('Promoción de verano');
  });

  it('guardar sin cambiar a Finalizada no pide confirmación', async () => {
    const c = editor();
    c.name.set('Promoción 279 bis');

    await c.submit();

    expect(confirmSpy.confirm).not.toHaveBeenCalled();
    expect(facadeSpy.editarPromocion).toHaveBeenCalled();
  });
});

describe('AdminPromocionEditarDrawerComponent — no cancelar con alumnos (fix-325-m, D4)', () => {
  let facadeSpy: any;

  async function editorWith(activos: number): Promise<any> {
    facadeSpy.countActiveEnrollments.mockResolvedValue(activos);
    const fixture = TestBed.createComponent(AdminPromocionEditarDrawerComponent);
    TestBed.tick();
    await fixture.whenStable();
    const c = fixture.componentInstance as any;
    c.name.set('Promoción 279');
    c.code.set('279');
    return c;
  }

  function cancelada(c: any): { value: string; disabled?: boolean } {
    return c.availableStatusOptions().find((o: { value: string }) => o.value === 'cancelled');
  }

  beforeEach(() => {
    facadeSpy = {
      selectedPromocion: signal(makePromo('in_progress')),
      canManageLifecycle: signal(true),
      isSubmitting: signal(false),
      editarPromocion: vi.fn().mockResolvedValue(true),
      countActiveEnrollments: vi.fn(),
      initialize: vi.fn(),
    };
    // Se prueba la lógica (effect + computed), no el template: en JIT los inputs requeridos de
    // los hijos (app-async-btn) no reciben valor y TestBed.tick() fallaría al dibujarlos.
    TestBed.overrideComponent(AdminPromocionEditarDrawerComponent, { set: { template: '' } });
    TestBed.configureTestingModule({
      imports: [AdminPromocionEditarDrawerComponent],
      providers: [
        { provide: PromocionesFacade, useValue: facadeSpy },
        { provide: ConfirmModalService, useValue: { confirm: vi.fn() } },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    });
  });

  it('con alumnos activos, "Cancelada" aparece deshabilitada y no se puede guardar', async () => {
    const c = await editorWith(12);
    expect(facadeSpy.countActiveEnrollments).toHaveBeenCalledWith(1);
    expect(cancelada(c).disabled).toBe(true);
    c.status.set('cancelled');
    expect(c.canSave()).toBe(false);
  });

  it('sin alumnos activos, "Cancelada" está disponible', async () => {
    const c = await editorWith(0);
    expect(cancelada(c).disabled).toBe(false);
    c.status.set('cancelled');
    expect(c.canSave()).toBe(true);
  });
});
