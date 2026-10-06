import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminProfesionalArchivoComponent } from './admin-profesional-archivo.component';
import { ArchivoFacade } from '@core/facades/archivo-profesional.facade';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { PromocionTableRow } from '@core/models/ui/promocion-table.model';

/** fix-326-m (D3a): Archivo en el piloto muestra el detalle de "Ver promoción" de la finalizada. */
describe('AdminProfesionalArchivoComponent (fix-326-m)', () => {
  let archivo: any;
  let promociones: any;
  const selectedPromo = signal<PromocionTableRow | null>(null);

  function create(): any {
    TestBed.overrideComponent(AdminProfesionalArchivoComponent, { set: { template: '' } });
    return TestBed.createComponent(AdminProfesionalArchivoComponent).componentInstance as any;
  }

  beforeEach(() => {
    selectedPromo.set(null);
    archivo = {
      selectedPromocionId: signal<number | null>(null),
      selectPromocion: vi.fn(),
      initialize: vi.fn(),
    };
    promociones = {
      selectedPromocion: selectedPromo,
      loadPromocionDetalle: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [AdminProfesionalArchivoComponent],
      providers: [
        { provide: ArchivoFacade, useValue: archivo },
        { provide: PromocionesFacade, useValue: promociones },
        { provide: BranchFacade, useValue: { setProfessionalOnly: vi.fn() } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });
  });

  it('en el piloto la sección académica (asistencia, notas) está oculta', () => {
    expect(create().showAcademic).toBe(false);
  });

  it('elegir una promoción carga su detalle con el mismo facade que "Ver promoción"', () => {
    const c = create();
    c.onPromoChange(14);
    expect(archivo.selectPromocion).toHaveBeenCalledWith(14);
    expect(promociones.loadPromocionDetalle).toHaveBeenCalledWith(14);
  });

  it('no muestra una promoción seleccionada en otra pantalla que no es la elegida en Archivo', () => {
    const c = create();
    archivo.selectedPromocionId.set(14);
    selectedPromo.set({ id: 280 } as PromocionTableRow);
    expect(c.detalle()).toBeNull();
    selectedPromo.set({ id: 14 } as PromocionTableRow);
    expect(c.detalle()?.id).toBe(14);
  });

  it('al volver a Archivo con una promoción ya elegida, recarga su detalle', () => {
    archivo.selectedPromocionId.set(14);
    const c = create();
    c.ngOnInit();
    expect(promociones.loadPromocionDetalle).toHaveBeenCalledWith(14);
  });
});
