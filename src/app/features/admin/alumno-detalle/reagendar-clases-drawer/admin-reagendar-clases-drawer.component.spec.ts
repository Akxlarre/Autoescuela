import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { AdminReagendarClasesDrawerComponent } from './admin-reagendar-clases-drawer.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// ─── fix-382-m: "Volver" desde el paso 2 conserva la selección ────────────────

describe('AdminReagendarClasesDrawerComponent — selección del paso 1 (fix-382-m)', () => {
  const pendientes = [3, 4, 5, 6].map((n) => ({
    sessionId: 100 + n,
    claseNumero: n,
    origen: n <= 4 ? ('no_show' as const) : ('cancelled' as const),
    fecha: '2026-10-20',
    justificada: false,
  }));

  function createComponent(seleccionPrevia: { sessionId: number }[]) {
    const facadeSpy = {
      clasesPendientesReagendar: () => pendientes,
      reagendarSeleccion: () => seleccionPrevia,
      setReagendarSeleccion: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminAlumnoDetalleFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: { push: vi.fn(), close: vi.fn() } },
      ],
    });
    const component = runInInjectionContext(
      TestBed.inject(Injector),
      () => new AdminReagendarClasesDrawerComponent(),
    );
    component.ngOnInit();
    return component;
  }

  it('sin selección previa (apertura nueva) → todas marcadas', () => {
    const component = createComponent([]);
    expect(component['selectedRows']().map((r) => r.claseNumero)).toEqual([3, 4, 5, 6]);
  });

  it('al volver del paso 2 → solo las que estaban marcadas', () => {
    const component = createComponent([{ sessionId: 105 }, { sessionId: 106 }]);
    expect(component['selectedRows']().map((r) => r.claseNumero)).toEqual([5, 6]);
  });
});
