import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { LiquidacionRow, LiquidacionesKpis } from '@core/models/ui/liquidaciones.model';
import { LiquidacionesContentComponent } from './liquidaciones-content.component';

const PENDIENTE: LiquidacionRow = {
  instructorId: 10,
  userId: 100,
  nombre: 'Ana Sur',
  rut: '1-1',
  initials: 'AS',
  avatarColor: 'var(--ds-brand)',
  practicalSessions: 12,
  totalHours: 9,
  amountPerHour: 5000,
  totalBaseAmount: 45000,
  totalAdvances: 12000,
  finalPaymentAmount: 33000,
  status: 'pending',
};
const PAGADA: LiquidacionRow = {
  ...PENDIENTE,
  instructorId: 20,
  nombre: 'Beto Norte',
  status: 'paid',
  paymentId: 555,
};
const KPIS: LiquidacionesKpis = {
  totalNomina: 90000,
  totalAnticipos: 12000,
  totalPagados: 1,
  totalInstructores: 2,
};
const MENSAJE = 'No se pudieron cargar las liquidaciones.';

/** Los hijos quedan como elementos sin compilar: sus inputs se leen como propiedades. */
type Hijo = HTMLElement & Record<string, unknown>;

function render(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [LiquidacionesContentComponent],
    providers: [{ provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } }],
  }).overrideComponent(LiquidacionesContentComponent, {
    set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
  });
  const fixture = TestBed.createComponent(LiquidacionesContentComponent);
  const valores = { liquidaciones: [PENDIENTE, PAGADA], kpis: KPIS, ...inputs };
  for (const [name, value] of Object.entries(valores)) {
    Object.defineProperty(fixture.componentInstance, name, { value: signal(value) });
  }
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    hero: () => el.querySelector('app-section-hero') as Hijo,
    emptyState: () => el.querySelector('app-empty-state') as Hijo | null,
    aviso: () => el.querySelector('app-alert-card') as HTMLElement | null,
    pagar: () => [
      ...el.querySelectorAll<HTMLButtonElement>('[data-llm-action="pagar-instructor"]'),
    ],
    deshacer: () => [
      ...el.querySelectorAll<HTMLButtonElement>('[data-llm-action="deshacer-pago-instructor"]'),
    ],
  };
}

describe('LiquidacionesContentComponent — lecturas fallidas (spec 0060-b)', () => {
  describe('caso A', () => {
    const CASO_A = { error: MENSAJE, liquidaciones: [], kpis: null };

    it('muestra el error con Reintentar, centrado dentro de .bento-fill', () => {
      const { fixture, emptyState } = render(CASO_A);
      const reintentos: unknown[] = [];
      fixture.componentInstance.reintentar.subscribe(() => reintentos.push(true));

      const estado = emptyState()!;
      expect(estado['message']).toBe(MENSAJE);
      expect(estado.getAttribute('actionLabel')).toBe('Reintentar');
      expect(estado.closest('.bento-fill')).not.toBeNull();
      expect(estado.parentElement?.className).toContain('flex-1');
      expect(estado.parentElement?.className).toContain('justify-center');

      estado.dispatchEvent(new Event('action'));
      expect(reintentos).toHaveLength(1);
    });

    it('no muestra KPIs, contadores, tabla ni tarjetas en cero', () => {
      const { el, hero } = render(CASO_A);

      expect(hero()['kpis']).toEqual([]);
      expect(el.textContent).not.toContain('Pendientes');
      expect(el.textContent).not.toContain('Pagados');
      expect(el.textContent).not.toContain('$');
      expect(el.querySelector('table')).toBeNull();
      expect(el.textContent).not.toContain('Resumen de Totales');
      expect(el.textContent).not.toContain('No hay instructores registrados');
    });

    it('con el drawer abierto (vista adaptativa) tampoco dibuja la lista', () => {
      const { el, emptyState } = render({ ...CASO_A, isDrawerOpen: true });

      expect(emptyState()).not.toBeNull();
      expect(el.querySelector('.adaptive-grid')).toBeNull();
    });

    it('deja navegar de mes', () => {
      const { fixture, el } = render({ ...CASO_A, puedeAvanzarMes: true });
      const eventos: string[] = [];
      fixture.componentInstance.mesAnterior.subscribe(() => eventos.push('anterior'));
      fixture.componentInstance.mesSiguiente.subscribe(() => eventos.push('siguiente'));

      el.querySelector<HTMLButtonElement>('[aria-label="Mes anterior"]')!.click();
      el.querySelector<HTMLButtonElement>('[aria-label="Mes siguiente"]')!.click();

      expect(eventos).toEqual(['anterior', 'siguiente']);
    });

    it('fix-079-i: sigue sin dejar avanzar a un mes futuro', () => {
      const { el } = render({ ...CASO_A, puedeAvanzarMes: false });

      expect(el.querySelector<HTMLButtonElement>('[aria-label="Mes siguiente"]')!.disabled).toBe(
        true,
      );
    });

    it('si además quedó marcado un refresco fallido, no muestra los dos avisos', () => {
      const { aviso, emptyState } = render({ ...CASO_A, refreshFailed: true });

      expect(emptyState()).not.toBeNull();
      expect(aviso()).toBeNull();
    });
  });

  describe('caso B', () => {
    const CASO_B = { refreshFailed: true, puedeRegistrarPago: false };

    it('el aviso es el primer hijo de .bento-fill, con shrink-0, y no de la grilla', () => {
      const { el, aviso } = render(CASO_B);
      const contenedor = aviso()!.parentElement!;
      const celda = el.querySelector('.bento-fill')!;

      expect(contenedor.parentElement).toBe(celda);
      expect(celda.firstElementChild).toBe(contenedor);
      expect(contenedor.classList.contains('shrink-0')).toBe(true);
      expect(aviso()!.getAttribute('severity')).toBe('error');
    });

    it('conserva KPIs y filas en escritorio y móvil', () => {
      const { el, hero, emptyState } = render(CASO_B);

      expect(emptyState()).toBeNull();
      expect(hero()['kpis']).toHaveLength(3);
      expect(el.querySelector('table')?.textContent).toContain('Ana Sur');
      expect(el.querySelector('.card-mobile-liq')?.textContent).toContain('Ana Sur');
    });

    it('Reintentar emite y se deshabilita mientras reintenta', () => {
      const { fixture, el } = render(CASO_B);
      const reintentos: unknown[] = [];
      fixture.componentInstance.reintentar.subscribe(() => reintentos.push(true));
      const boton = () =>
        el.querySelector<HTMLButtonElement>('[data-llm-action="reintentar-liquidaciones"]')!;

      boton().click();
      expect(reintentos).toHaveLength(1);

      Object.defineProperty(fixture.componentInstance, 'reintentando', { value: signal(true) });
      fixture.componentRef.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(boton().disabled).toBe(true);
    });
  });

  describe('Registrar pago', () => {
    it('bloqueado: deshabilita escritorio y móvil, sin emitir', () => {
      const { fixture, pagar } = render({ puedeRegistrarPago: false, refreshFailed: true });
      const pagos: unknown[] = [];
      fixture.componentInstance.pagar.subscribe((row) => pagos.push(row));

      expect(pagar()).toHaveLength(2);
      for (const boton of pagar()) {
        expect(boton.disabled).toBe(true);
        boton.click();
      }
      fixture.componentInstance['abrirModal'](PENDIENTE);

      expect(pagos).toEqual([]);
    });

    it('Deshacer sigue disponible con el pago bloqueado', () => {
      const { fixture, deshacer } = render({ puedeRegistrarPago: false, refreshFailed: true });
      const eventos: LiquidacionRow[] = [];
      fixture.componentInstance.deshacer.subscribe((row) => eventos.push(row));

      expect(deshacer()).toHaveLength(2);
      deshacer().forEach((boton) => boton.click());

      expect(eventos).toEqual([PAGADA, PAGADA]);
    });

    it('con la carga vigente queda habilitado y emite la fila', () => {
      const { fixture, pagar } = render({ puedeRegistrarPago: true });
      const pagos: LiquidacionRow[] = [];
      fixture.componentInstance.pagar.subscribe((row) => pagos.push(row));

      pagar()[0].click();

      expect(pagos).toEqual([PENDIENTE]);
    });
  });

  describe('horas exactas (spec 0012-i AC17)', () => {
    const CON_DECIMALES = [
      { ...PENDIENTE, totalHours: 2.25 },
      { ...PAGADA, totalHours: 2.25 },
      { ...PENDIENTE, instructorId: 30, totalHours: 2.25 },
      { ...PENDIENTE, instructorId: 40, totalHours: 3 },
    ];

    it('cada fila muestra las horas con dos decimales y coma', () => {
      const { el } = render({ liquidaciones: CON_DECIMALES });

      expect(el.querySelector('table')?.textContent).toContain('2,25');
      expect(el.querySelector('table')?.textContent).toContain('3,00');
      expect(el.querySelector('.card-mobile-liq')?.textContent).toContain('2,25');
    });

    it('el pie suma las horas exactas (9,75, no 9,9)', () => {
      const { fixture } = render({ liquidaciones: CON_DECIMALES });

      expect(fixture.componentInstance['totales']().horas).toBe(9.75);
      expect(
        fixture.nativeElement.querySelector('tfoot')?.textContent ??
          fixture.nativeElement.textContent,
      ).toContain('9,75');
    });
  });

  describe('Dar anticipo por fila (spec 0012-i AC16)', () => {
    const botones = (el: HTMLElement) => [
      ...el.querySelectorAll<HTMLButtonElement>('[data-llm-action="dar-anticipo-instructor"]'),
    ];

    it('cada fila, pendiente o pagada, tiene el botón en escritorio y móvil', () => {
      const { el } = render({});

      // 2 filas × (tabla + tarjeta móvil)
      expect(botones(el)).toHaveLength(4);
    });

    it('emite la fila del instructor elegido', () => {
      const { fixture, el } = render({});
      const eventos: LiquidacionRow[] = [];
      fixture.componentInstance.darAnticipo.subscribe((row) => eventos.push(row));

      botones(el).forEach((b) => b.click());

      expect(eventos.map((r) => r.instructorId)).toEqual([10, 20, 10, 20]);
    });

    it('sigue disponible aunque el registro de pagos esté bloqueado', () => {
      const { el } = render({ puedeRegistrarPago: false, refreshFailed: true });

      expect(botones(el).every((b) => !b.disabled)).toBe(true);
    });
  });

  it('durante la carga sin KPIs conserva el esqueleto de 3 KPIs', () => {
    const { hero } = render({ kpis: null, liquidaciones: [], isLoading: true });

    expect(hero()['kpis']).toEqual([]);
    expect(hero()['loadingKpiCount']).toBe(3);
    expect(hero()['loading']).toBe(true);
  });
});
