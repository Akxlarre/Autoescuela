import { TestBed } from '@angular/core/testing';
import { AsistenciaClaseBFacade } from './asistencia-clase-b.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type { ClasePracticaRow } from '@core/models/ui/asistencia-clase-b.model';

/** Builder Supabase encadenable y awaitable, con resultado por tabla. */
function makeSupabaseMock() {
  const results = new Map<string, { data: any; error: any }>();

  function builder(table: string): any {
    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      gte: vi.fn(() => b),
      lte: vi.fn(() => b),
      in: vi.fn(() => b),
      or: vi.fn(() => b),
      order: vi.fn(() => b),
      update: vi.fn(() => b),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: () => Promise.resolve(results.get(`${table}:single`) ?? { data: null, error: null }),
      then: (resolve: any) => resolve(results.get(table) ?? { data: [], error: null }),
    };
    return b;
  }

  return {
    client: { from: vi.fn((t: string) => builder(t)) },
    setResult: (table: string, data: any, error: any = null) => results.set(table, { data, error }),
  };
}

function makeRow(over: Partial<ClasePracticaRow> = {}): ClasePracticaRow {
  return {
    id: 1,
    enrollmentId: 10,
    studentId: 5,
    classNumber: 1,
    horaInicio: '09:00',
    horaInicioReal: null,
    horaFinReal: null,
    instructorId: 3,
    instructorName: 'Inst',
    alumnoName: 'Juan Pérez',
    status: 'pendiente',
    justificacion: null,
    branchId: 1,
    branchName: 'Chillán',
    scheduledAt: '2026-06-30T09:00:00',
    kmStart: null,
    vehiclePlate: null,
    vehicleBrand: null,
    vehicleModel: null,
    vehicleId: null,
    vehicleCurrentKm: null,
    ...over,
  };
}

describe('AsistenciaClaseBFacade', () => {
  let facade: AsistenciaClaseBFacade;
  let mock: ReturnType<typeof makeSupabaseMock>;
  let toast: any;

  beforeEach(() => {
    mock = makeSupabaseMock();
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AsistenciaClaseBFacade,
        { provide: SupabaseService, useValue: mock },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue({ dbId: 99 }) } },
        { provide: BranchFacade, useValue: { branches: vi.fn().mockReturnValue([]) } },
      ],
    });

    facade = TestBed.inject(AsistenciaClaseBFacade);
  });

  it('estado inicial vacío', () => {
    expect(facade.clasesPracticas()).toEqual([]);
    expect(facade.kpis()).toBeNull();
    expect(facade.isLoading()).toBe(false);
  });

  it('initialize calcula KPIs (100% sin clases con alumno)', async () => {
    mock.setResult('class_b_sessions', []);
    mock.setResult('class_b_practice_attendance', []);
    await facade.initialize();
    const kpis = facade.kpis();
    expect(kpis).not.toBeNull();
    expect(kpis?.totalClasesHoy).toBe(0);
    expect(kpis?.tasaAsistencia).toBe(100);
  });

  it('markAttendance marca ausente y actualiza el estado local + toast', async () => {
    (facade as any)._clasesPracticas.set([makeRow()]);
    mock.setResult('enrollments:single', { student_id: 5 });

    await facade.markAttendance(1, 'ausente');

    expect(facade.clasesPracticas()[0].status).toBe('ausente');
    expect(toast.success).toHaveBeenCalled();
  });

  it('selectPractica expone la fila seleccionada', () => {
    const row = makeRow({ id: 7 });
    facade.selectPractica(row);
    expect(facade.selectedPractica()?.id).toBe(7);
  });

  it('setBranchFilter no dispara error y permite recarga', () => {
    expect(() => facade.setBranchFilter(2)).not.toThrow();
  });
});
