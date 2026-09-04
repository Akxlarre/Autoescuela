import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HistorialVentasDrawerComponent } from './historial-ventas-drawer.component';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { ServicioEspecial, VentaServicio } from '@core/models/ui/servicios-especiales.model';
import { DEFAULT_PERIOD_WINDOW } from '@core/utils/period-window.utils';

/**
 * Cobertura del filtrado del Historial de Ventas (fix-239-m) — absorbe la responsabilidad
 * que antes vivía en `servicios-especiales-content.component.spec.ts` (spec 0039-b), ahora
 * que el historial se movió a este drawer. La paginación en sí (recorte de filas visibles)
 * la resuelve `p-table` con `[paginator]="true"`, así que no hay lógica propia que testear
 * ahí — lo que sí sigue siendo una decisión propia es `ventasFiltradas` (servicio + período).
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

function makeServicio(over: Partial<ServicioEspecial> = {}): ServicioEspecial {
  return {
    id: 1,
    nombre: 'Examen Psicotecnico',
    descripcion: '',
    precio: 25000,
    icono: 'brain',
    color: 'indigo',
    activo: true,
    ...over,
  };
}

describe('HistorialVentasDrawerComponent — filtrado del historial', () => {
  let component: HistorialVentasDrawerComponent;
  let ventasSig: ReturnType<typeof signal<VentaServicio[]>>;
  let catalogoSig: ReturnType<typeof signal<ServicioEspecial[]>>;

  beforeEach(() => {
    ventasSig = signal<VentaServicio[]>([]);
    catalogoSig = signal<ServicioEspecial[]>([]);

    TestBed.configureTestingModule({
      providers: [
        HistorialVentasDrawerComponent,
        {
          provide: ServiciosEspecialesFacade,
          useValue: {
            ventas: ventasSig,
            catalogo: catalogoSig,
            isExporting: signal(false),
            exportarHistorial: () => Promise.resolve(),
            borrarVenta: () => Promise.resolve({ success: true }),
          },
        },
        { provide: ConfirmModalService, useValue: { confirm: () => Promise.resolve(true) } },
        {
          provide: ToastService,
          useValue: { success: () => undefined, warning: () => undefined, error: () => undefined },
        },
      ],
    });
    component = TestBed.inject(HistorialVentasDrawerComponent);
  });

  const c = () =>
    component as unknown as {
      filtroServicio: ReturnType<typeof signal<string | null>>;
      periodWindow: ReturnType<typeof signal<unknown>>;
      ventasFiltradas: () => VentaServicio[];
      onFiltroServicioChange: (v: string | null) => void;
      onPeriodWindowChange: (v: unknown) => void;
    };

  it('sin filtro, muestra todas las ventas dentro de la ventana de período por defecto', () => {
    ventasSig.set([makeVenta({ id: 1, servicioId: 1 }), makeVenta({ id: 2, servicioId: 2 })]);
    expect(c().ventasFiltradas().length).toBe(2);
  });

  it('filtra por servicio cuando se selecciona uno', () => {
    ventasSig.set([makeVenta({ id: 1, servicioId: 1 }), makeVenta({ id: 2, servicioId: 2 })]);
    c().onFiltroServicioChange('1');
    expect(
      c()
        .ventasFiltradas()
        .map((v) => v.id),
    ).toEqual([1]);
  });

  it('volver a "todos los servicios" (null) restaura la lista completa', () => {
    ventasSig.set([makeVenta({ id: 1, servicioId: 1 }), makeVenta({ id: 2, servicioId: 2 })]);
    c().onFiltroServicioChange('1');
    c().onFiltroServicioChange(null);
    expect(c().ventasFiltradas().length).toBe(2);
  });

  it('las opciones de filtro reflejan el catálogo', () => {
    catalogoSig.set([makeServicio({ id: 1, nombre: 'Psicotécnico' })]);
    expect(
      (
        component as unknown as { filtroOptions: () => { label: string; value: string }[] }
      ).filtroOptions(),
    ).toEqual([{ label: 'Psicotécnico', value: '1' }]);
  });

  it('cambiar la ventana de período no rompe el filtrado por servicio activo', () => {
    ventasSig.set([makeVenta({ id: 1, servicioId: 1 }), makeVenta({ id: 2, servicioId: 2 })]);
    c().onFiltroServicioChange('1');
    c().onPeriodWindowChange(DEFAULT_PERIOD_WINDOW);
    expect(
      c()
        .ventasFiltradas()
        .map((v) => v.id),
    ).toEqual([1]);
  });
});
