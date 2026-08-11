import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminInstructoresComponent } from './admin-instructores.component';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { InstructorTableRow } from '@core/models/ui/instructor-table.model';

// ─── fix-125-b (ASG-b-066): densidad adaptativa app-like ───
describe('AdminInstructoresComponent — densidad app-like (fix-125-b)', () => {
  let component: AdminInstructoresComponent;
  let layoutDrawerSpy: any;

  const buildInstructor = (id: number): InstructorTableRow =>
    ({
      id,
      userId: id,
      nombre: `Instructor ${id}`,
      initials: 'IN',
      email: `inst${id}@test.com`,
      rut: `1${id}-1`,
      phone: '',
      tipo: 'practice',
      tipoLabel: 'Práctica',
      licenseNumber: '',
      licenseClass: '',
      licenseExpiry: null,
      licenseStatus: 'valid',
      licenseStatusLabel: 'Vigente',
      activeClassesCount: 0,
      estado: 'activo',
      registrationDate: null,
      vehiclePlate: null,
      vehicleModel: null,
      vehicleId: null,
      vehicleAssignmentDate: null,
      firstName: '',
      paternalLastName: '',
      maternalLastName: '',
      branchId: 1,
      bothBranches: false,
    }) as InstructorTableRow;

  const instructores = Array.from({ length: 14 }, (_, i) => buildInstructor(i + 1));

  function setup(): void {
    layoutDrawerSpy = { open: vi.fn(), close: vi.fn(), isOpen: signal(false) };

    TestBed.configureTestingModule({
      imports: [AdminInstructoresComponent],
      providers: [
        {
          provide: InstructoresFacade,
          useValue: {
            instructores: signal(instructores),
            isLoading: signal(false),
            totalInstructores: () => instructores.length,
            activos: () => instructores.length,
            licenciasPorVencer: () => 0,
            selectInstructor: vi.fn(),
            loadAssignmentHistory: vi.fn(),
            initialize: vi.fn(),
          },
        },
        {
          provide: BranchFacade,
          useValue: { selectedBranchId: signal(null), branches: signal([]) },
        },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(AdminInstructoresComponent).componentInstance;
  }

  beforeEach(() => setup());

  it('mobileShown arranca en el step (6)', () => {
    expect((component as any).mobileShown()).toBe(6);
  });

  it('visibleCards recorta al presupuesto inicial', () => {
    expect((component as any).visibleCards().length).toBe(6);
  });

  it('remainingCards refleja lo que falta por mostrar', () => {
    expect((component as any).remainingCards()).toBe(8);
  });

  it('filteredInstructores expone la lista COMPLETA (desktop scrollea internamente, sin paginar)', () => {
    expect((component as any).filteredInstructores().length).toBe(14);
  });

  it('loadMoreCards incrementa el presupuesto en un step', () => {
    (component as any).loadMoreCards();
    expect((component as any).visibleCards().length).toBe(12);
    expect((component as any).remainingCards()).toBe(2);
  });

  it('loadMoreCards repetido nunca excede el total disponible', () => {
    (component as any).loadMoreCards();
    (component as any).loadMoreCards();
    expect((component as any).visibleCards().length).toBe(14);
    expect((component as any).remainingCards()).toBe(0);
  });

  it('setFilter tras "Cargar más" reinicia el presupuesto al step', () => {
    (component as any).loadMoreCards();
    expect((component as any).mobileShown()).toBe(12);

    (component as any).setFilter('active');

    expect((component as any).activeFilter()).toBe('active');
    expect((component as any).mobileShown()).toBe(6);
  });

  it('isDrawerOpen del template refleja LayoutDrawerFacadeService.isOpen() (force-compact)', () => {
    expect((component as any).layoutDrawer.isOpen()).toBe(false);

    (layoutDrawerSpy.isOpen as ReturnType<typeof signal>).set(true);

    expect((component as any).layoutDrawer.isOpen()).toBe(true);
  });
});
