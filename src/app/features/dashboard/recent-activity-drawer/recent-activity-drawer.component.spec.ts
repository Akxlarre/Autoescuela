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

  async function montar() {
    router = { navigateByUrl: vi.fn() };
    drawer = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RecentActivityDrawerComponent],
      providers: [
        {
          provide: DashboardFacade,
          useValue: {
            fetchActivityHistory: vi.fn().mockResolvedValue(actividad),
            resolveStudentIdForActivity: vi.fn().mockResolvedValue(77),
          },
        },
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
});
