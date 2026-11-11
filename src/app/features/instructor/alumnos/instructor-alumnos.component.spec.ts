import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ChileDatePipe } from '@shared/pipes/chile-date.pipe';
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
            error: signal<string | null>(null),
            refreshFailed: signal(false),
            kpis: signal({
              totalAlumnos: students.length,
              activos: 10,
              completados: 5,
              promedioProgreso: 42,
              porCertificar: 2,
            }),
            initialize: vi.fn(),
            reintentar: vi.fn(),
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

  describe('Casos de error de lectura (0060-b)', () => {
    it('Caso A: si error está activo y no hay alumnos, heroKpis está vacío', () => {
      const errorSig = signal<string | null>('No se pudo cargar la lista de alumnos.');
      const studentsSig = signal<InstructorStudentCard[]>([]);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [InstructorAlumnosComponent],
        providers: [
          {
            provide: InstructorAlumnosFacade,
            useValue: {
              isLoading: signal(false),
              students: studentsSig,
              error: errorSig,
              refreshFailed: signal(false),
              kpis: signal({
                totalAlumnos: 0,
                activos: 0,
                completados: 0,
                promedioProgreso: 0,
                porCertificar: 0,
              }),
              initialize: vi.fn(),
              reintentar: vi.fn(),
              setActiveStudent: vi.fn(),
              openDrawer: vi.fn(),
            },
          },
          { provide: LayoutService, useValue: { tier: signal('desktop') } },
        ],
      });

      const comp = TestBed.createComponent(InstructorAlumnosComponent).componentInstance;
      expect(comp.heroKpis()).toEqual([]);
    });

    it('Caso B: si no hay error y hay alumnos, heroKpis tiene métricas', () => {
      const comp = TestBed.createComponent(InstructorAlumnosComponent).componentInstance;
      expect(comp.heroKpis().length).toBe(4);
    });

    it('render Caso A: muestra app-empty-state y click en Reintentar llama reintentar()', () => {
      const reintentarSpy = vi.fn();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [InstructorAlumnosComponent],
        providers: [
          {
            provide: InstructorAlumnosFacade,
            useValue: {
              isLoading: signal(false),
              students: signal<InstructorStudentCard[]>([]),
              error: signal<string | null>('No se pudo cargar la lista de alumnos.'),
              refreshFailed: signal(false),
              kpis: signal({
                totalAlumnos: 0,
                activos: 0,
                completados: 0,
                promedioProgreso: 0,
                porCertificar: 0,
              }),
              initialize: vi.fn(),
              reintentar: reintentarSpy,
              setActiveStudent: vi.fn(),
              openDrawer: vi.fn(),
            },
          },
          { provide: LayoutService, useValue: { tier: signal('desktop') } },
        ],
      }).overrideComponent(InstructorAlumnosComponent, {
        set: { imports: [FormsModule, SelectModule, ChileDatePipe], schemas: [NO_ERRORS_SCHEMA] },
      });

      const fixture = TestBed.createComponent(InstructorAlumnosComponent);
      fixture.detectChanges();

      const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
      expect(emptyEl).not.toBeNull();
      expect(emptyEl.message).toBe('No se pudo cargar la lista de alumnos.');
      expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

      emptyEl.dispatchEvent(new CustomEvent('action'));
      expect(reintentarSpy).toHaveBeenCalledTimes(1);
    });

    it('render Caso B: mantiene alumnos y click en Reintentar del alert-card llama reintentar()', () => {
      const reintentarSpy = vi.fn();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [InstructorAlumnosComponent],
        providers: [
          {
            provide: InstructorAlumnosFacade,
            useValue: {
              isLoading: signal(false),
              students: signal(students),
              error: signal<string | null>(null),
              refreshFailed: signal(true),
              kpis: signal({
                totalAlumnos: students.length,
                activos: 10,
                completados: 5,
                promedioProgreso: 42,
                porCertificar: 2,
              }),
              initialize: vi.fn(),
              reintentar: reintentarSpy,
              setActiveStudent: vi.fn(),
              openDrawer: vi.fn(),
            },
          },
          { provide: LayoutService, useValue: { tier: signal('desktop') } },
        ],
      }).overrideComponent(InstructorAlumnosComponent, {
        set: { imports: [FormsModule, SelectModule, ChileDatePipe], schemas: [NO_ERRORS_SCHEMA] },
      });

      const fixture = TestBed.createComponent(InstructorAlumnosComponent);
      fixture.detectChanges();

      const alertEl = fixture.nativeElement.querySelector('app-alert-card') as any;
      expect(alertEl).not.toBeNull();
      expect(alertEl.title).toBe('No se pudo actualizar la lista de alumnos');

      const retryBtn = fixture.nativeElement.querySelector(
        '[data-llm-action="reintentar-alumnos"]',
      ) as HTMLButtonElement | null;
      expect(retryBtn).not.toBeNull();
      retryBtn?.click();
      expect(reintentarSpy).toHaveBeenCalledTimes(1);
    });
  });
});
