import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PagosRecientesDrawerComponent } from './pagos-recientes-drawer.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import type { PagoReciente } from '@core/models/ui/pagos.model';

// ─── fix-132-m (ASG-b-076): filtro de búsqueda/estado/método de Pagos Recientes ───
describe('PagosRecientesDrawerComponent — filtros', () => {
  let component: PagosRecientesDrawerComponent;

  const buildPago = (overrides: Partial<PagoReciente>): PagoReciente =>
    ({
      id: overrides.id ?? 1,
      alumno: 'Alumno Uno',
      fecha: '2026-08-01',
      concepto: 'Matrícula',
      monto: 100000,
      metodo: 'Transferencia',
      metodoIcono: 'landmark',
      nroDocumento: 'B-1',
      estado: 'completado',
      ...overrides,
    }) as PagoReciente;

  const pagos = [
    buildPago({
      id: 1,
      alumno: 'Pablo Pérez',
      nroDocumento: 'B-100',
      estado: 'completado',
      metodo: 'Transferencia',
    }),
    buildPago({
      id: 2,
      alumno: 'María López',
      nroDocumento: 'B-101',
      estado: 'pendiente',
      metodo: 'Efectivo',
    }),
    buildPago({
      id: 3,
      alumno: 'Juan Soto',
      nroDocumento: 'B-102',
      estado: 'completado',
      metodo: 'Efectivo',
    }),
  ];

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [PagosRecientesDrawerComponent],
      providers: [
        {
          provide: PagosFacade,
          useValue: {
            isLoading: signal(false),
            pagosRecientes: signal(pagos),
            metodosPagoMes: signal([]),
          },
        },
      ],
    });

    component = TestBed.createComponent(PagosRecientesDrawerComponent).componentInstance;
  }

  beforeEach(() => setup());

  it('sin filtros muestra todos los pagos', () => {
    expect((component as any).pagosFiltrados().length).toBe(3);
  });

  it('el buscador filtra por nombre de alumno (case-insensitive)', () => {
    (component as any).onSearch({ target: { value: 'pablo' } } as unknown as Event);
    expect((component as any).pagosFiltrados().map((p: PagoReciente) => p.id)).toEqual([1]);
  });

  it('el buscador filtra por N° de documento', () => {
    (component as any).onSearch({ target: { value: 'b-101' } } as unknown as Event);
    expect((component as any).pagosFiltrados().map((p: PagoReciente) => p.id)).toEqual([2]);
  });

  it('el filtro de estado acota la lista', () => {
    (component as any).filtroEstado.set('pendiente');
    expect((component as any).pagosFiltrados().map((p: PagoReciente) => p.id)).toEqual([2]);
  });

  it('el filtro de método acota la lista', () => {
    (component as any).filtroMetodo.set('Efectivo');
    expect(
      (component as any)
        .pagosFiltrados()
        .map((p: PagoReciente) => p.id)
        .sort(),
    ).toEqual([2, 3]);
  });

  it('búsqueda + filtro de estado combinados', () => {
    (component as any).onSearch({ target: { value: 'juan' } } as unknown as Event);
    (component as any).filtroEstado.set('completado');
    expect((component as any).pagosFiltrados().map((p: PagoReciente) => p.id)).toEqual([3]);
  });

  it('sin coincidencias devuelve lista vacía', () => {
    (component as any).onSearch({ target: { value: 'nadie' } } as unknown as Event);
    expect((component as any).pagosFiltrados().length).toBe(0);
  });
});
