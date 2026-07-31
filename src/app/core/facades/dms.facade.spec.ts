import { TestBed } from '@angular/core/testing';
import { DmsFacade } from './dms.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';

/** Query builder fake: soporta el chaining de Supabase y es thenable como el real. */
function makeBuilder(result: { data: any; error: any }): any {
  const b: any = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() => b);
  b.delete = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve(result));
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.limit = vi.fn(() => Promise.resolve(result));
  b.insert = vi.fn(() => Promise.resolve(result));
  b.then = (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject);
  return b;
}

describe('DmsFacade', () => {
  let facade: DmsFacade;
  let supabaseSpy: any;
  let drawerSpy: any;
  let confirmSpy: any;
  let toastSpy: any;
  let viewerSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    drawerSpy = {
      open: vi.fn(),
      close: vi.fn(),
      push: vi.fn(),
      back: vi.fn(),
      canGoBack: vi.fn().mockReturnValue(false),
    };
    confirmSpy = { confirm: vi.fn() };
    toastSpy = { success: vi.fn(), error: vi.fn() };
    viewerSpy = { openByUrl: vi.fn() };

    // Mock supabase client
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://example.com/signed/doc' },
            error: null,
          }),
        }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth_id' } }, error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    TestBed.configureTestingModule({
      providers: [
        DmsFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: LayoutDrawerService, useValue: drawerSpy },
        { provide: ConfirmModalService, useValue: confirmSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: DmsViewerService, useValue: viewerSpy },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
      ],
    });

    facade = TestBed.inject(DmsFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('UI Wrappers', () => {
    it('should call toast.success on showSuccess', () => {
      facade.showSuccess('Summary', 'Detail');
      expect(toastSpy.success).toHaveBeenCalledWith('Summary', 'Detail');
    });

    it('should call toast.error on showError', () => {
      facade.showError('Summary', 'Detail');
      expect(toastSpy.error).toHaveBeenCalledWith('Summary', 'Detail');
    });

    it('should call confirmModal.confirm on confirm', async () => {
      const config = { title: 'Test', message: 'Msg' };
      confirmSpy.confirm.mockResolvedValue(true);
      const result = await facade.confirm(config);
      expect(confirmSpy.confirm).toHaveBeenCalledWith(config);
      expect(result).toBe(true);
    });

    it('rechaza eliminar documentos con source enrollment_license (fila sintética del Carnet, sin registro propio)', async () => {
      const deleteSpy = vi.fn();
      supabaseSpy.client.from = vi.fn().mockReturnValue({ delete: deleteSpy });

      await expect(
        facade.deleteStudentDocument('lic-full-9', 'enrollment_license'),
      ).rejects.toThrow('El Carnet no se puede eliminar desde el DMS');
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should call dmsViewer.openByUrl on openDocument', async () => {
      await facade.openDocument('storage/path/doc.pdf', 'File');
      expect(viewerSpy.openByUrl).toHaveBeenCalledWith('https://example.com/signed/doc', 'File');
    });

    it('should use default filename in openDocument if not provided', async () => {
      await facade.openDocument('storage/path/doc.pdf');
      expect(viewerSpy.openByUrl).toHaveBeenCalledWith(
        'https://example.com/signed/doc',
        'Documento',
      );
    });

    it('should call layoutDrawer.close on closeDrawer', () => {
      facade.closeDrawer();
      expect(drawerSpy.close).toHaveBeenCalled();
    });
  });

  describe('Upload notify', () => {
    it('should update uploadSaved signal on notifyUploadSaved', () => {
      facade.notifyUploadSaved();
      expect(facade.uploadSaved()).toBe(true);
    });
  });

  it('clearError should set error signal to null', () => {
    (facade as any)._error.set('some error');
    facade.clearError();
    expect(facade.error()).toBeNull();
  });

  describe('Instructor documents (spec 0003-m)', () => {
    function setupFacade(
      opts: {
        role?: string;
        branchId?: number | null;
        canAccessBothBranches?: boolean;
        selectedBranchId?: number | null;
      } = {},
    ) {
      TestBed.resetTestingModule();

      const localSupabaseSpy: any = {
        client: {
          from: vi.fn(() => makeBuilder({ data: [], error: null })),
          storage: {
            from: vi.fn().mockReturnValue({
              upload: vi.fn().mockResolvedValue({ error: null }),
              createSignedUrl: vi.fn().mockResolvedValue({
                data: { signedUrl: 'https://example.com/signed' },
                error: null,
              }),
            }),
          },
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: { id: 'auth-uid-1' } }, error: null }),
          },
          rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      };

      TestBed.configureTestingModule({
        providers: [
          DmsFacade,
          { provide: SupabaseService, useValue: localSupabaseSpy },
          { provide: LayoutDrawerService, useValue: { open: vi.fn(), close: vi.fn() } },
          { provide: ConfirmModalService, useValue: { confirm: vi.fn() } },
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
          { provide: DmsViewerService, useValue: { openByUrl: vi.fn() } },
          {
            provide: AuthFacade,
            useValue: {
              currentUser: vi.fn().mockReturnValue(
                opts.role
                  ? {
                      role: opts.role,
                      branchId: opts.branchId ?? null,
                      canAccessBothBranches: opts.canAccessBothBranches ?? false,
                    }
                  : null,
              ),
            },
          },
          {
            provide: BranchFacade,
            useValue: { selectedBranchId: vi.fn().mockReturnValue(opts.selectedBranchId ?? null) },
          },
        ],
      });

      return {
        localFacade: TestBed.inject(DmsFacade),
        localSupabaseSpy,
      };
    }

    afterEach(() => {
      TestBed.resetTestingModule();
    });

    it('loadInstructorDocuments() mapea filas raw → DmsInstructorDocRow', async () => {
      const { localFacade, localSupabaseSpy } = setupFacade();
      const instructorBuilder = makeBuilder({
        data: {
          id: 5,
          license_number: 'B-123',
          users: { id: 9, first_names: 'Juan', paternal_last_name: 'Pérez' },
        },
        error: null,
      });
      const docsBuilder = makeBuilder({
        data: [
          {
            id: 1,
            instructor_id: 5,
            type: 'licencia_clase_b',
            file_name: 'licencia.pdf',
            storage_url: 'instructor-docs/5/1_licencia_clase_b.pdf',
            status: 'pending',
            created_at: '2026-07-29T00:00:00Z',
          },
        ],
        error: null,
      });
      localSupabaseSpy.client.from = vi.fn((table: string) =>
        table === 'instructors'
          ? instructorBuilder
          : table === 'instructor_documents'
            ? docsBuilder
            : makeBuilder({ data: [], error: null }),
      );

      await localFacade.loadInstructorDocuments(5);

      expect(localFacade.instructorDetail()).toEqual({
        name: 'Juan Pérez',
        licenseNumber: 'B-123',
        instructorId: 5,
      });
      expect(localFacade.instructorDocs()).toEqual([
        {
          id: 1,
          instructorId: 5,
          type: 'licencia_clase_b',
          fileName: 'licencia.pdf',
          fileUrl: 'instructor-docs/5/1_licencia_clase_b.pdf',
          status: 'pending',
          documentAt: '2026-07-29T00:00:00Z',
          instructorName: 'Juan Pérez',
          typeLabel: 'Licencia Clase B',
        },
      ]);
      expect(localFacade.instructorDocsLoading()).toBe(false);
    });

    it('uploadInstructorDocument() sube el archivo con el path instructor-docs/{id}/... e inserta con status pending', async () => {
      const { localFacade, localSupabaseSpy } = setupFacade();
      const usersBuilder = makeBuilder({ data: { id: 42 }, error: null });
      const instructorDocsBuilder = makeBuilder({ data: [], error: null });
      localSupabaseSpy.client.from = vi.fn((table: string) =>
        table === 'users'
          ? usersBuilder
          : table === 'instructor_documents'
            ? instructorDocsBuilder
            : makeBuilder({ data: [], error: null }),
      );

      const file = new File(['contenido'], 'licencia.pdf', { type: 'application/pdf' });
      await localFacade.uploadInstructorDocument({
        file,
        type: 'licencia_clase_b',
        instructorId: 7,
      });

      expect(usersBuilder.eq).toHaveBeenCalledWith('supabase_uid', 'auth-uid-1');
      expect(instructorDocsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          instructor_id: 7,
          type: 'licencia_clase_b',
          status: 'pending',
          uploaded_by: 42,
        }),
      );
      const insertedPayload = instructorDocsBuilder.insert.mock.calls[0][0];
      expect(insertedPayload.storage_url).toMatch(/^instructor-docs\/7\//);
    });

    it('deleteInstructorDocument() borra la fila y refresca', async () => {
      const { localFacade, localSupabaseSpy } = setupFacade();
      const docsBuilder = makeBuilder({ data: [], error: null });
      localSupabaseSpy.client.from = vi.fn((table: string) =>
        table === 'instructor_documents' ? docsBuilder : makeBuilder({ data: [], error: null }),
      );

      await localFacade.deleteInstructorDocument(9);

      expect(docsBuilder.delete).toHaveBeenCalled();
      expect(docsBuilder.eq).toHaveBeenCalledWith('id', 9);
    });

    it('fetchAllData(): secretaria con branchId numérico filtra instructores por users.branch_id', async () => {
      const { localFacade, localSupabaseSpy } = setupFacade({ role: 'secretary', branchId: 2 });
      const instructorsBuilder = makeBuilder({ data: [], error: null });
      localSupabaseSpy.client.from = vi.fn((table: string) =>
        table === 'instructors' ? instructorsBuilder : makeBuilder({ data: [], error: null }),
      );

      await localFacade.initialize();

      expect(instructorsBuilder.eq).toHaveBeenCalledWith('users.branch_id', 2);
    });

    it('fetchAllData(): admin con branchId===null no filtra instructores por sede', async () => {
      const { localFacade, localSupabaseSpy } = setupFacade({
        role: 'admin',
        selectedBranchId: null,
      });
      const instructorsBuilder = makeBuilder({ data: [], error: null });
      localSupabaseSpy.client.from = vi.fn((table: string) =>
        table === 'instructors' ? instructorsBuilder : makeBuilder({ data: [], error: null }),
      );

      await localFacade.initialize();

      expect(instructorsBuilder.eq).not.toHaveBeenCalled();
    });

    it('fetchAllData(): arma name en orden paterno-materno-nombre, matriculaNumber del último enrollment y branchName', async () => {
      const { localFacade, localSupabaseSpy } = setupFacade();
      const studentsBuilder = makeBuilder({
        data: [
          {
            id: 1,
            users: {
              id: 10,
              rut: '11.111.111-1',
              first_names: 'Ana',
              paternal_last_name: 'Soto',
              maternal_last_name: 'Rojas',
              branch_id: 2,
              branches: { name: 'Sede Centro' },
            },
            enrollments: [
              { number: '0005', created_at: '2026-01-01T00:00:00Z' },
              { number: '0012', created_at: '2026-06-01T00:00:00Z' },
            ],
          },
        ],
        error: null,
      });
      const vDocsBuilder = makeBuilder({
        data: [
          {
            id: '1',
            source: 'student_document',
            student_id: 1,
            enrollment_id: 1,
            type: 'contrato',
            file_name: 'contrato.pdf',
            file_url: 'students/1/contrato.pdf',
            status: 'approved',
            document_at: '2026-06-01T00:00:00Z',
            managed_by: null,
          },
        ],
        error: null,
      });
      localSupabaseSpy.client.from = vi.fn((table: string) =>
        table === 'students'
          ? studentsBuilder
          : table === 'v_dms_student_documents'
            ? vDocsBuilder
            : makeBuilder({ data: [], error: null }),
      );

      await localFacade.initialize();

      expect(localFacade.studentsWithDocs()).toEqual([
        {
          studentId: 1,
          name: 'Soto Rojas Ana',
          rut: '11.111.111-1',
          matriculaNumber: '#0012',
          branchName: 'Sede Centro',
          docCount: 1,
        },
      ]);
    });
  });
});
