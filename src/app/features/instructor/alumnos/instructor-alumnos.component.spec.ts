import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InstructorAlumnosComponent } from './instructor-alumnos.component';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import type { InstructorStudentCard } from '@core/models/ui/instructor-portal.model';

// ─── fix-139-b (ASG-b-078): densidad adaptativa app-like ───
describe('InstructorAlumnosComponent — densidad app-like', () => {
  let component: InstructorAlumnosComponent;
  let tierSig: ReturnType<typeof signal<'mobile' | 'tablet' | 'desktop'>>;

  const buildStudent = (id: number): InstructorStudentCard =>
    ({
      studentId: id,
      enrollmentId: id,
      name: `Alumno ${id}`,
      rut: `${id}-9`,
      status: 'active',
      statusLabel: 'Activo',
      statusColor: 'success',
      courseName: 'Clase B',
      practiceProgress: 5,
      totalSessions: 12,
      practicePercent: 42,
      nextClassDate: null,
    }) as InstructorStudentCard;

  const students = Array.from({ length: 22 }, (_, i) => buildStudent(i + 1));

  function setup(): void {
    tierSig = signal<'mobile' | 'tablet' | 'desktop'>('desktop');

    TestBed.configureTestingModule({
      imports: [InstructorAlumnosComponent],
      providers: [
        {
          provide: InstructorAlumnosFacade,
          useValue: {
            isLoading: signal(false),
            students: signal(students),
            initialize: vi.fn(),
            setActiveStudent: vi.fn(),
            openDrawer: vi.fn(),
          },
        },
        { provide: LayoutService, useValue: { tier: tierSig } },
      ],
    });

    component = TestBed.createComponent(InstructorAlumnosComponent).componentInstance;
  }

  beforeEach(() => setup());

  describe('desktop (tier=desktop)', () => {
    it('maxVisible es null → sin límite', () => {
      expect(component.maxVisible()).toBeNull();
    });

    it('visibleStudents muestra todos los alumnos filtrados', () => {
      expect(component.visibleStudents().length).toBe(students.length);
    });

    it('remainingStudents es 0 (no hay "Cargar más" en desktop)', () => {
      expect(component.remainingStudents()).toBe(0);
    });
  });

  describe('mobile/tablet (tier=mobile)', () => {
    beforeEach(() => tierSig.set('mobile'));

    it('maxVisible arranca en el step (9)', () => {
      expect(component.maxVisible()).toBe(9);
    });

    it('visibleStudents recorta al presupuesto inicial', () => {
      expect(component.visibleStudents().length).toBe(9);
    });

    it('remainingStudents refleja lo que falta por mostrar', () => {
      expect(component.remainingStudents()).toBe(13);
    });

    it('loadMoreStudents incrementa el presupuesto en un step', () => {
      component.loadMoreStudents();
      expect(component.visibleStudents().length).toBe(18);
      expect(component.remainingStudents()).toBe(4);
    });

    it('loadMoreStudents repetido nunca excede el total disponible', () => {
      component.loadMoreStudents();
      component.loadMoreStudents();
      expect(component.visibleStudents().length).toBe(22);
      expect(component.remainingStudents()).toBe(0);
    });
  });

  describe('reset de densidad al cambiar filtros/búsqueda', () => {
    beforeEach(() => tierSig.set('mobile'));

    it('onSearch tras "Cargar más" reinicia el presupuesto al step', () => {
      component.loadMoreStudents();
      expect(component.mobileShown()).toBe(18);

      component.onSearch('alumno 1');

      expect(component.mobileShown()).toBe(9);
    });

    it('setFilter también resetea la densidad', () => {
      component.loadMoreStudents();
      component.setFilter('active');

      expect(component.mobileShown()).toBe(9);
    });

    it('clearFilters también resetea la densidad', () => {
      component.loadMoreStudents();
      component.clearFilters();

      expect(component.mobileShown()).toBe(9);
    });
  });
});
