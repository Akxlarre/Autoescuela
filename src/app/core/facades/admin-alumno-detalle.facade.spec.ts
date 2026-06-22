import { TestBed } from '@angular/core/testing';
import { AdminAlumnoDetalleFacade } from './admin-alumno-detalle.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';

describe('AdminAlumnoDetalleFacade', () => {
  let facade: AdminAlumnoDetalleFacade;
  let supabaseSpy: any;
  let invokeSpy: any;
  let dmsViewerSpy: any;

  beforeEach(() => {
    invokeSpy = vi.fn().mockResolvedValue({
      data: { pdfUrl: 'https://signed/url', pdfPath: 'student-licenses/1/Carnet.pdf' },
      error: null,
    });

    supabaseSpy = { client: vi.fn() };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      functions: { invoke: invokeSpy },
    };

    dmsViewerSpy = { openByUrl: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnoDetalleFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
        { provide: DmsViewerService, useValue: dmsViewerSpy },
      ],
    });

    facade = TestBed.inject(AdminAlumnoDetalleFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.alumno()).toBeNull();
    expect(facade.inasistencias()).toEqual([]);
    expect(facade.clasesPracticas()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
  });

  it('porcentajePracticas should return 0 initially', () => {
    expect(facade.porcentajePracticas()).toBe(0);
  });

  it('porcentajeTeoricas should return 0 initially', () => {
    expect(facade.porcentajeTeoricas()).toBe(0);
  });

  describe('generarCarnet', () => {
    it("variant 'initial' invoca la Edge Function con variant=initial y setea el path inicial", async () => {
      await facade.generarCarnet(1, 'initial');

      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 1, variant: 'initial' },
      });
      expect(facade.licenseInitialPath()).toBe('student-licenses/1/Carnet.pdf');
      expect(facade.licenseFullPath()).toBeNull();
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalled();
    });

    it("variant 'full' invoca con variant=full y setea sólo el path completo", async () => {
      await facade.generarCarnet(7, 'full');

      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 7, variant: 'full' },
      });
      expect(facade.licenseFullPath()).toBe('student-licenses/1/Carnet.pdf');
      expect(facade.licenseInitialPath()).toBeNull();
    });

    it('default es initial cuando no se pasa variant', async () => {
      await facade.generarCarnet(3);
      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 3, variant: 'initial' },
      });
    });
  });
});
