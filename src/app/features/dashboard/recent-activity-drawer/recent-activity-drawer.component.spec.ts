import { Component, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RecentActivityDrawerComponent } from './recent-activity-drawer.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/** El drawer real usa inputs de señal que Vitest no compila en los hijos: basta proyectar. */
@Component({ selector: 'app-drawer-form', standalone: true, template: '<ng-content />' })
class DrawerFormStub {}

describe('RecentActivityDrawerComponent', () => {
  const actividad = [
    { id: '1', entity: 'enrollments', entityId: 10, action: 'INSERT', title: 'Nueva matrícula' },
    { id: '2', entity: 'payments', entityId: 20, action: 'INSERT', title: 'Nuevo pago' },
    {
      id: '3',
      entity: 'enrollments',
      entityId: 30,
      action: 'DELETE',
      title: 'Matrícula eliminada',
    },
  ].map((item) => ({ ...item, description: '', time: '10:00', icon: 'plus' }));

  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let drawer: { close: ReturnType<typeof vi.fn> };

  let facade: {
    fetchActivityHistory: ReturnType<typeof vi.fn>;
    resolveStudentIdForActivity: ReturnType<typeof vi.fn>;
  };

  async function asentar(fixture: { detectChanges(): void }) {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  async function montar(
    historial: () => Promise<unknown> = () => Promise.resolve(actividad),
    alumno: () => Promise<number | null> = () => Promise.resolve(77),
  ) {
    router = { navigateByUrl: vi.fn() };
    drawer = { close: vi.fn() };
    facade = {
      fetchActivityHistory: vi.fn(historial),
      resolveStudentIdForActivity: vi.fn(alumno),
    };
    TestBed.configureTestingModule({
      imports: [RecentActivityDrawerComponent],
      providers: [
        { provide: DashboardFacade, useValue: facade },
        { provide: AuthFacade, useValue: { currentUser: signal({ role: 'secretaria' }) } },
        { provide: LayoutDrawerFacadeService, useValue: drawer },
        { provide: Router, useValue: router },
      ],
    });
    TestBed.overrideComponent(RecentActivityDrawerComponent, {
      set: { imports: [DrawerFormStub], schemas: [NO_ERRORS_SCHEMA] },
    });
    const fixture = TestBed.createComponent(RecentActivityDrawerComponent);
    fixture.detectChanges();
    // ngOnInit carga la actividad y resuelve los alumnos con promesas encadenadas.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
    const items = Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];
    return { fixture, items };
  }

  describe('teclado (fix-421-m)', () => {
    it('un evento clicable es un botón enfocable que dice a dónde lleva', async () => {
      const { items } = await montar();
      const [matricula, pago] = items;

      expect(matricula.getAttribute('role')).toBe('button');
      expect(matricula.getAttribute('tabindex')).toBe('0');
      expect(matricula.getAttribute('aria-label')).toBe(
        'Nueva matrícula: abrir la ficha del alumno',
      );
      expect(matricula.getAttribute('data-llm-action')).toBe('open-activity-target');
      expect(pago.getAttribute('aria-label')).toBe('Nuevo pago: abrir Pagos');
    });

    it('Enter y Espacio navegan igual que el clic', async () => {
      const { items } = await montar();
      const [matricula, pago] = items;

      matricula.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(router.navigateByUrl).toHaveBeenLastCalledWith('/app/secretaria/alumnos/77');

      const espacio = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      pago.dispatchEvent(espacio);
      expect(router.navigateByUrl).toHaveBeenLastCalledWith('/app/secretaria/pagos');
      expect(espacio.defaultPrevented).toBe(true);
      expect(drawer.close).toHaveBeenCalledTimes(2);
    });

    it('un evento que no lleva a ningún lado no recibe foco ni rol de botón', async () => {
      const { items } = await montar();
      const eliminada = items[2];
      expect(eliminada.textContent).toContain('Matrícula eliminada');

      expect(eliminada.getAttribute('role')).toBeNull();
      expect(eliminada.getAttribute('tabindex')).toBeNull();
      expect(eliminada.getAttribute('data-llm-action')).toBeNull();
    });
  });

  describe('lectura fallida (spec 0060-b T1.4)', () => {
    const fallo = () => Promise.reject(new Error('Failed to fetch'));

    it('si el historial no carga muestra el error con Reintentar, no "sin actividad"', async () => {
      const { fixture } = await montar(fallo);
      const host = fixture.nativeElement as HTMLElement;

      const vacio = host.querySelector('app-empty-state') as HTMLElement;
      expect(vacio.getAttribute('actionLabel')).toBe('Reintentar');
      expect(host.textContent).not.toContain('No hay actividad reciente');
    });

    it('Reintentar vuelve a pedir el historial y muestra la lista', async () => {
      const { fixture } = await montar(fallo);
      const host = fixture.nativeElement as HTMLElement;
      facade.fetchActivityHistory.mockResolvedValue(actividad);

      host.querySelector('app-empty-state')!.dispatchEvent(new CustomEvent('action'));
      await asentar(fixture);

      expect(facade.fetchActivityHistory).toHaveBeenCalledTimes(2);
      expect(host.querySelector('app-empty-state')).toBeNull();
      expect(host.querySelectorAll('li')).toHaveLength(3);
    });

    it('si no se resuelve el alumno, la lista sigue visible y ese evento no es enlace', async () => {
      const { items } = await montar(undefined, fallo);

      expect(items).toHaveLength(3);
      expect(items[0].getAttribute('role')).toBeNull();
      expect(items[1].getAttribute('role')).toBe('button'); // Pagos no necesita resolver alumno
    });
  });
});
