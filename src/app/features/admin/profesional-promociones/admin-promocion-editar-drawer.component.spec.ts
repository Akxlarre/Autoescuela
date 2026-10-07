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
            fetchMaxPromotionCode: vi.fn().mockResolvedValue(282),
          },
        },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    });
  });

  it('admin, promoción en curso → puede finalizar; "Cancelada" ya no es destino (fix-348-m)', () => {
    expect(options('in_progress')).toEqual(['in_progress', 'finished']);
  });

  it('admin, promoción planificada → sin "Cancelada" como destino (fix-348-m)', () => {
    expect(options('planned')).toEqual(['planned', 'in_progress']);
  });

  it('una cancelada histórica muestra su estado, sin transiciones', () => {
    expect(options('cancelled')).toEqual(['cancelled']);
  });

  it('secretaria, promoción en curso → solo "En curso" (sin Finalizada)', () => {
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
      fetchMaxPromotionCode: vi.fn().mockResolvedValue(282),
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

  // ─── fix-347-m (D19) ───
  it('un número más de 10 por sobre el último usado no deja guardar', async () => {
    const c = editor();
    await Promise.resolve();
    c.codeModel = '2790';
    expect(c.codeError()).toBe('No puede ser mayor que 292: el último número usado es 282.');
    expect(c.canSave()).toBe(false);
    c.codeModel = '285';
    expect(c.canSave()).toBe(true);
  });

  it('el número ya guardado sirve aunque supere el tope', async () => {
    facadeSpy.selectedPromocion.set({ ...makePromo('planned'), code: '9002' });
    const c = editor();
    await Promise.resolve();
    c.code.set('9002');
    c.name.set('Otro nombre');
    expect(c.codeError()).toBeNull();
    expect(c.canSave()).toBe(true);
  });

  it('guardar sin cambiar a Finalizada no pide confirmación', async () => {
    const c = editor();
    c.name.set('Promoción 279 bis');

    await c.submit();

    expect(confirmSpy.confirm).not.toHaveBeenCalled();
    expect(facadeSpy.editarPromocion).toHaveBeenCalled();
  });
});

describe('AdminPromocionEditarDrawerComponent — eliminar en vez de cancelar (fix-348-m, D20)', () => {
  let facadeSpy: any;
  let confirmSpy: any;
  let drawerSpy: any;

  function editor(overrides: Partial<PromocionTableRow>, admin = true): any {
    facadeSpy.selectedPromocion.set({ ...makePromo('planned'), ...overrides });
    facadeSpy.canManageLifecycle.set(admin);
    return TestBed.createComponent(AdminPromocionEditarDrawerComponent).componentInstance as any;
  }

  beforeEach(() => {
    facadeSpy = {
      selectedPromocion: signal(makePromo('planned')),
      canManageLifecycle: signal(true),
      isSubmitting: signal(false),
      editarPromocion: vi.fn().mockResolvedValue(true),
      eliminarPromocion: vi.fn().mockResolvedValue(true),
      countActiveEnrollments: vi.fn().mockResolvedValue(0),
      fetchMaxPromotionCode: vi.fn().mockResolvedValue(282),
      initialize: vi.fn(),
    };
    confirmSpy = { confirm: vi.fn().mockResolvedValue(true) };
    drawerSpy = { open: vi.fn(), close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AdminPromocionEditarDrawerComponent],
      providers: [
        { provide: PromocionesFacade, useValue: facadeSpy },
        { provide: ConfirmModalService, useValue: confirmSpy },
        { provide: LayoutDrawerFacadeService, useValue: drawerSpy },
      ],
    });
  });

  it('admin ve "Eliminar" en una planificada o cancelada sin alumnos', () => {
    expect(editor({ status: 'planned' }).canDelete()).toBe(true);
    expect(editor({ status: 'cancelled' }).canDelete()).toBe(true);
  });

  it('no se ofrece si tiene alumnos, si ya partió o si no es admin', () => {
    expect(editor({ status: 'planned', totalEnrolled: 2 }).canDelete()).toBe(false);
    expect(editor({ status: 'in_progress' }).canDelete()).toBe(false);
    expect(editor({ status: 'finished' }).canDelete()).toBe(false);
    expect(editor({ status: 'planned' }, false).canDelete()).toBe(false);
  });

  it('una cancelada no puede guardarse con otro estado: "Cancelada" no es un destino', () => {
    const c = editor({ status: 'planned' });
    c.status.set('cancelled');
    expect(c.canSave()).toBe(false);
  });

  it('confirmar elimina la promoción y cierra el panel', async () => {
    const c = editor({ status: 'planned' });

    await c.deletePromocion();

    expect(confirmSpy.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Eliminar promoción', severity: 'danger' }),
    );
    expect(facadeSpy.eliminarPromocion).toHaveBeenCalledWith(1);
    expect(drawerSpy.close).toHaveBeenCalled();
  });

  it('si se cancela la confirmación, no elimina', async () => {
    confirmSpy.confirm.mockResolvedValue(false);
    const c = editor({ status: 'planned' });

    await c.deletePromocion();

    expect(facadeSpy.eliminarPromocion).not.toHaveBeenCalled();
    expect(drawerSpy.close).not.toHaveBeenCalled();
  });

  it('si la base de datos la rechaza, el panel queda abierto', async () => {
    facadeSpy.eliminarPromocion.mockResolvedValue(false);
    const c = editor({ status: 'planned' });

    await c.deletePromocion();

    expect(drawerSpy.close).not.toHaveBeenCalled();
  });

  it('dos clics seguidos en Eliminar → una sola confirmación', async () => {
    const c = editor({ status: 'planned' });

    await Promise.all([c.deletePromocion(), c.deletePromocion()]);

    expect(confirmSpy.confirm).toHaveBeenCalledTimes(1);
    expect(facadeSpy.eliminarPromocion).toHaveBeenCalledTimes(1);
  });

  it('la secretaria ve el aviso de pedirle al administrador solo en una planificada sin alumnos', () => {
    expect(editor({ status: 'planned' }, false).showAskAdminNotice()).toBe(true);
    expect(editor({ status: 'planned', totalEnrolled: 1 }, false).showAskAdminNotice()).toBe(false);
    expect(editor({ status: 'in_progress' }, false).showAskAdminNotice()).toBe(false);
    expect(editor({ status: 'planned' }).showAskAdminNotice()).toBe(false);
  });
});
