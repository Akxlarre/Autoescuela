import { TestBed } from '@angular/core/testing';
import { AdminHorariosFacade } from './admin-horarios.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('AdminHorariosFacade', () => {
  let facade: AdminHorariosFacade;
  let supabaseMock: any;
  let toastMock: any;

  beforeEach(() => {
    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 1, name: 'Curso', license_class: 'B', schedule_blocks: [] }],
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      },
    };

    toastMock = {
      success: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminHorariosFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ToastService, useValue: toastMock },
      ],
    });

    facade = TestBed.inject(AdminHorariosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should load courses', async () => {
    await facade.loadCourses(1);
    expect(supabaseMock.client.from).toHaveBeenCalledWith('courses');
    expect(facade.courses().length).toBe(1);
    expect(facade.courses()[0].id).toBe(1);
  });

  it('should update schedule blocks and show success toast', async () => {
    await facade.loadCourses(1);

    const result = await facade.updateScheduleBlocks([1], [{ from: '08:00', to: '08:45' }]);
    expect(result).toBe(true);
    expect(supabaseMock.client.from).toHaveBeenCalledWith('courses');
    expect(toastMock.success).toHaveBeenCalledWith('Horarios base actualizados correctamente');

    expect(facade.courses()[0].schedule_blocks.length).toBe(1);
    expect(facade.courses()[0].schedule_blocks[0].from).toBe('08:00');
  });

  it('should not update if courseIds is empty', async () => {
    const result = await facade.updateScheduleBlocks([], [{ from: '08:00', to: '08:45' }]);
    expect(result).toBe(false);
    expect(supabaseMock.client.from).not.toHaveBeenCalledWith('courses');
  });
});
