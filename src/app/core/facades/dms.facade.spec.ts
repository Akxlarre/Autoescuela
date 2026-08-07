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

// ─── spec 0005-m: guard de requestId contra respuestas stale ─────────────────
describe('DmsFacade — request guard (spec 0005-m, AC1, AC4, AC-E1)', () => {
  /**
   * fetchAllData() dispara exactamente 6 queries `.from(...)` por invocación (todas
   * construidas sincrónicamente antes del único `await Promise.all(...)`), así que cada
   * tanda de 6 llamadas a `.from()` pertenece a una sola invocación — agrupamos por eso.
   */
  function makeRaceableSupabaseMock() {
    const deferreds: {
      promise: Promise<any>;
      resolve: (v: any) => void;
      reject: (e: any) => void;
    }[] = [];
    let fromCallCount = 0;

    function deferredForBatch(batchIndex: number) {
      if (!deferreds[batchIndex]) {
        let resolve!: (v: any) => void;
        let reject!: (e: any) => void;
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        deferreds[batchIndex] = { promise, resolve, reject };
      }
      return deferreds[batchIndex];
    }

    const client = {
      from: vi.fn(() => {
        const idx = fromCallCount++;
        const batchIndex = Math.floor(idx / 6);
        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(() => builder),
          then: (resolve: any, reject: any) =>
            deferredForBatch(batchIndex).promise.then(resolve, reject),
        };
        return builder;
      }),
    };

    return {
      client,
      resolveBatch: (i: number, schoolDocs: any[]) =>
        deferredForBatch(i).resolve({ data: schoolDocs, error: null }),
      rejectBatch: (i: number, err: Error) => deferredForBatch(i).reject(err),
    };
  }

  it('AC1/AC-E1: solo aplica el resultado de la fetch MÁS RECIENTE, aunque la vieja resuelva después', async () => {
    const mock = makeRaceableSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        DmsFacade,
        { provide: SupabaseService, useValue: mock },
        { provide: LayoutDrawerService, useValue: {} },
        { provide: ConfirmModalService, useValue: {} },
        { provide: ToastService, useValue: {} },
        { provide: DmsViewerService, useValue: {} },
        { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ role: 'admin' })) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
      ],
    });
    const facade = TestBed.inject(DmsFacade);

    const oldCall = facade.initialize(); // batch 0 (vieja)
    const newCall = facade.initialize(); // batch 1 (vigente) — dispara antes de que la vieja resuelva

    // Orden de llegada invertido: la vigente resuelve primero. Todas las queries del batch
    // resuelven con el mismo array — usamos school_documents (mapea 1:1, sin joins) como marcador.
    mock.resolveBatch(1, [{ id: 200, type: 'contrato', file_name: 'new.pdf', storage_url: 'x' }]);
    await newCall;
    mock.resolveBatch(0, [{ id: 100, type: 'contrato', file_name: 'old.pdf', storage_url: 'x' }]);
    await oldCall;

    expect(facade.schoolDocs().map((d: any) => d.id)).toEqual([200]);
  });

  it('AC-E2: si la fetch vigente falla, el error se setea igual — el guard no enmascara errores reales', async () => {
    const mock = makeRaceableSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        DmsFacade,
        { provide: SupabaseService, useValue: mock },
        { provide: LayoutDrawerService, useValue: {} },
        { provide: ConfirmModalService, useValue: {} },
        { provide: ToastService, useValue: {} },
        { provide: DmsViewerService, useValue: {} },
        { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ role: 'admin' })) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
      ],
    });
    const facade = TestBed.inject(DmsFacade);

    const oldCall = facade.initialize(); // batch 0 (vieja)
    // DmsFacade marca `_initialized = true` de forma SÍNCRONA antes del await (a diferencia
    // de los otros 3 Facades), así que un segundo initialize() concurrente toma el camino SWR
    // (refreshSilently, fire-and-forget). Llamamos refreshSilently() directo para tener una
    // promesa awaitable y determinista para la fetch "vigente".
    const newCall = (facade as any).refreshSilently(); // batch 1 (vigente)

    mock.resolveBatch(0, [{ id: 100, type: 'contrato', file_name: 'old.pdf', storage_url: 'x' }]);
    await oldCall;
    mock.rejectBatch(1, new Error('network fail'));
    await newCall;

    expect(facade.error()).toBeTruthy();
  });
});
