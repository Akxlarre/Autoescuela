import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServiciosEspecialesContentComponent } from './servicios-especiales-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type { VentaServicio } from '@core/models/ui/servicios-especiales.model';
import { DEFAULT_PERIOD_WINDOW } from '@core/utils/period-window.utils';

/**
 * Cobertura de la paginación del historial de ventas (spec 0039-b).
 *
 * Por qué existe: sin techo de DOM, `ventasFiltradas()` llegaba entera al `@for` de las DOS
 * vistas (tabla y tarjetas coexisten en el DOM, alternadas por CSS y no por `@if`), con un
 * costo medido de ~0,66 ms por fila — 774 ms de bloqueo con 1.000 ventas. Ver
 * `specs/specs/0039-b-benchmark-umbral-virtual-scroll/acceptance.md`.
 */

function makeVenta(over: Partial<VentaServicio> = {}): VentaServicio {
  return {
    id: 1,
    cliente: 'Cliente Uno',
    rut: '11111111-1',
    esAlumno: false,
    servicio: 'Examen Psicotecnico',
    servicioId: 1,
    precio: 25000,
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'completado',
    resultado: 'Apto',
    cobrado: true,
    studentUserId: null,
    branchId: 1,
    documentNumber: 'B-1',
    ...over,
  };
}

/** N ventas de hoy (dentro de la ventana por defecto de 12 meses). */
function makeVentas(n: number, servicioId = 1): VentaServicio[] {
  return Array.from({ length: n }, (_, i) =>
    makeVenta({ id: i + 1, cliente: `Cliente ${i + 1}`, servicioId }),
  );
}

describe('ServiciosEspecialesContentComponent — paginación del historial', () => {
  let component: ServiciosEspecialesContentComponent;

  /** Mismo patrón que pre-inscritos-content.component.spec.ts: los signal inputs no son
   *  escribibles en esta infra (JIT sin el transform de initializer APIs). */
  const stubInput = <T>(name: string, initial: T) => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  let ventasSig: ReturnType<typeof stubInput<VentaServicio[]>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ServiciosEspecialesContentComponent,
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: () => undefined } },
        { provide: ConfirmModalService, useValue: { confirm: () => Promise.resolve(true) } },
      ],
    });
    component = TestBed.inject(ServiciosEspecialesContentComponent);
    ventasSig = stubInput<VentaServicio[]>('ventas', []);
    stubInput('catalogo', []);
    stubInput('kpis', {
      ventasMes: 0,
      totalCobrado: 0,
      pendientesCobro: 0,
      totalRegistros: 0,
      ventasCobradas: 0,
      ventasSinCobrar: 0,
    });
  });

  const c = () =>
    component as unknown as {
      pageSize: number;
      currentPage: ReturnType<typeof signal<number>>;
      filtroServicio: ReturnType<typeof signal<string | null>>;
      periodWindow: ReturnType<typeof signal<string>>;
      ventasFiltradas: () => VentaServicio[];
      ventasPaginadas: () => VentaServicio[];
      totalPages: () => number;
      safePage: () => number;
      onPageChange: (e: { page?: number }) => void;
      onFiltroServicioChange: (v: string | null) => void;
      onPeriodWindowChange: (v: unknown) => void;
    };

  it('nunca renderiza más de pageSize filas, sin importar el volumen', () => {
    for (const n of [11, 100, 1000, 5000]) {
      ventasSig.set(makeVentas(n));
      expect(c().ventasPaginadas().length).toBe(c().pageSize);
    }
  });

  it('con menos ventas que pageSize, muestra todas', () => {
    ventasSig.set(makeVentas(3));
    expect(c().ventasPaginadas().length).toBe(3);
  });

  it('sin ventas, la página queda vacía y totalPages nunca baja de 1', () => {
    ventasSig.set([]);
    expect(c().ventasPaginadas()).toEqual([]);
    expect(c().totalPages()).toBe(1);
  });

  it('avanzar de página devuelve el bloque siguiente, no el mismo', () => {
    ventasSig.set(makeVentas(25));
    const primeraPagina = c()
      .ventasPaginadas()
      .map((v) => v.id);
    c().onPageChange({ page: 1 });
    const segundaPagina = c()
      .ventasPaginadas()
      .map((v) => v.id);

    expect(segundaPagina).not.toEqual(primeraPagina);
    expect(segundaPagina[0]).toBe(c().pageSize + 1);
  });

  it('la última página puede ser parcial', () => {
    ventasSig.set(makeVentas(25)); // 10 + 10 + 5
    c().onPageChange({ page: 2 });
    expect(c().ventasPaginadas().length).toBe(5);
  });

  it('cambiar el filtro de servicio vuelve a la primera página', () => {
    ventasSig.set(makeVentas(50));
    c().onPageChange({ page: 3 });
    expect(c().currentPage()).toBe(3);

    c().onFiltroServicioChange('1');
    expect(c().currentPage()).toBe(0);
  });

  it('cambiar la ventana de período vuelve a la primera página', () => {
    ventasSig.set(makeVentas(50));
    c().onPageChange({ page: 2 });

    c().onPeriodWindowChange(DEFAULT_PERIOD_WINDOW);
    expect(c().currentPage()).toBe(0);
  });

  /**
   * El caso que rompe si `safePage` no acota: estando en una página alta, filtrar a un
   * conjunto chico dejaría el índice fuera de rango y la lista saldría vacía aunque haya
   * resultados — el mismo tipo de fallo silencioso que 0038-b existía para evitar.
   */
  it('quedar fuera de rango no vacía la lista: safePage acota al total', () => {
    ventasSig.set(makeVentas(100));
    c().onPageChange({ page: 9 });
    expect(c().safePage()).toBe(9);

    ventasSig.set(makeVentas(15)); // ahora solo hay 2 páginas
    expect(c().safePage()).toBe(1);
    expect(c().ventasPaginadas().length).toBeGreaterThan(0);
  });

  it('paginar no altera el total filtrado que alimenta al paginador', () => {
    ventasSig.set(makeVentas(120));
    expect(c().ventasFiltradas().length).toBe(120);
    c().onPageChange({ page: 5 });
    expect(c().ventasFiltradas().length).toBe(120);
  });
});
