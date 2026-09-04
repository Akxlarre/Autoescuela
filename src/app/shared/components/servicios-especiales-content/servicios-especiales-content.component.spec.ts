import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServiciosEspecialesContentComponent } from './servicios-especiales-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type { ServicioEspecial } from '@core/models/ui/servicios-especiales.model';

/**
 * Cobertura de `serviciosVisibles` (fix-239-m) — la lógica de filtrado/paginación del
 * Historial de Ventas se movió a `HistorialVentasDrawerComponent`, así que este spec deja
 * de cubrir esa parte (ver `historial-ventas-drawer.component.spec.ts`). Lo único que sigue
 * siendo una decisión propia de este Dumb es el toggle "Mostrar inactivos".
 */

function makeServicio(over: Partial<ServicioEspecial> = {}): ServicioEspecial {
  return {
    id: 1,
    nombre: 'Psicotécnico',
    descripcion: 'Examen psicotécnico',
    precio: 20000,
    icono: 'brain',
    color: 'indigo',
    activo: true,
    ...over,
  };
}

describe('ServiciosEspecialesContentComponent — filtro de catálogo', () => {
  let component: ServiciosEspecialesContentComponent;

  /** Mismo patrón que pre-inscritos-content.component.spec.ts: los signal inputs no son
   *  escribibles en esta infra (JIT sin el transform de initializer APIs). */
  const stubInput = <T>(name: string, initial: T) => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  let catalogoSig: ReturnType<typeof stubInput<ServicioEspecial[]>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ServiciosEspecialesContentComponent,
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: () => undefined } },
        { provide: ConfirmModalService, useValue: { confirm: () => Promise.resolve(true) } },
      ],
    });
    component = TestBed.inject(ServiciosEspecialesContentComponent);
    catalogoSig = stubInput<ServicioEspecial[]>('catalogo', []);
    stubInput('kpis', {
      ventasMes: 0,
      totalCobrado: 0,
      recaudacionMes: 0,
      pendientesCobro: 0,
      totalRegistros: 0,
      ventasCobradas: 0,
      ventasSinCobrar: 0,
    });
  });

  const c = () =>
    component as unknown as {
      mostrarInactivos: ReturnType<typeof signal<boolean>>;
      serviciosVisibles: () => ServicioEspecial[];
    };

  it('oculta los inactivos por defecto', () => {
    catalogoSig.set([
      makeServicio({ id: 1, activo: true }),
      makeServicio({ id: 2, activo: false }),
    ]);
    expect(
      c()
        .serviciosVisibles()
        .map((s) => s.id),
    ).toEqual([1]);
  });

  it('muestra los inactivos cuando el toggle está activo', () => {
    catalogoSig.set([
      makeServicio({ id: 1, activo: true }),
      makeServicio({ id: 2, activo: false }),
    ]);
    c().mostrarInactivos.set(true);
    expect(
      c()
        .serviciosVisibles()
        .map((s) => s.id),
    ).toEqual([1, 2]);
  });
});
