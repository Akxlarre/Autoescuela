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
        from: jasmine.createSpy('from').and.returnValue({
          select: jasmine.createSpy('select').and.returnValue({
            eq: jasmine.createSpy('eq').and.returnValue({
              eq: jasmine.createSpy('eq').and.returnValue({
                eq: jasmine.createSpy('eq').and.returnValue(Promise.resolve({ data: [{ id: 1, name: 'Curso', license_class: 'B', schedule_blocks: [] }], error: null }))
              })
            })
          }),
          update: jasmine.createSpy('update').and.returnValue({
            in: jasmine.createSpy('in').and.returnValue(Promise.resolve({ error: null }))
          })
        })
      }
    };

    toastMock = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error')
    };

    TestBed.configureTestingModule({
      providers: [
        AdminHorariosFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ToastService, useValue: toastMock }
      ]
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
    // Pre-load data to test local cache update
    await facade.loadCourses(1);
    
    const result = await facade.updateScheduleBlocks([1], [{ from: '08:00', to: '08:45' }]);
    expect(result).toBeTrue();
    expect(supabaseMock.client.from).toHaveBeenCalledWith('courses');
    expect(toastMock.success).toHaveBeenCalledWith('Horarios base actualizados correctamente');
    
    // Verify local cache updated
    expect(facade.courses()[0].schedule_blocks.length).toBe(1);
    expect(facade.courses()[0].schedule_blocks[0].from).toBe('08:00');
  });

  it('should not update if courseIds is empty', async () => {
    const result = await facade.updateScheduleBlocks([], [{ from: '08:00', to: '08:45' }]);
    expect(result).toBeFalse();
    expect(supabaseMock.client.from).not.toHaveBeenCalledWith('courses');
  });
});
