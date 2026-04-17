import { TestBed } from '@angular/core/testing';
import { DmsFacade } from './dms.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';

describe('DmsFacade', () => {
  let facade: DmsFacade;
  let supabaseSpy: any;
  let drawerSpy: any;
  let confirmSpy: any;
  let toastSpy: any;
  let viewerSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    drawerSpy = { open: vi.fn(), close: vi.fn() };
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
          createSignedUrl: vi
            .fn()
            .mockResolvedValue({
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

    it('should call dmsViewer.openByUrl on openDocument', () => {
      facade.openDocument('http://test.com', 'File');
      expect(viewerSpy.openByUrl).toHaveBeenCalledWith('http://test.com', 'File');
    });

    it('should use default filename in openDocument if not provided', () => {
      facade.openDocument('http://test.com');
      expect(viewerSpy.openByUrl).toHaveBeenCalledWith('http://test.com', 'Documento');
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
});
