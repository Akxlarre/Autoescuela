import { TestBed } from '@angular/core/testing';
import { DmsFacade } from './dms.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';

describe('DmsFacade', () => {
  let facade: DmsFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let drawerSpy: jasmine.SpyObj<LayoutDrawerService>;
  let confirmSpy: jasmine.SpyObj<ConfirmModalService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let viewerSpy: jasmine.SpyObj<DmsViewerService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    drawerSpy = jasmine.createSpyObj('LayoutDrawerService', ['open', 'close']);
    confirmSpy = jasmine.createSpyObj('ConfirmModalService', ['confirm']);
    toastSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);
    viewerSpy = jasmine.createSpyObj('DmsViewerService', ['openByUrl']);

    // Mock supabase client
    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
            order: jasmine.createSpy('order').and.returnValue({
              limit: jasmine.createSpy('limit').and.resolveTo({ data: [], error: null })
            }),
            single: jasmine.createSpy('single').and.resolveTo({ data: null, error: null })
          })
        }),
        update: jasmine.createSpy('update').and.returnValue({
           eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
        }),
        delete: jasmine.createSpy('delete').and.returnValue({
           eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
        }),
        insert: jasmine.createSpy('insert').and.resolveTo({ error: null })
      }),
      storage: {
        from: jasmine.createSpy('from').and.returnValue({
          upload: jasmine.createSpy('upload').and.resolveTo({ error: null }),
          getPublicUrl: jasmine.createSpy('getPublicUrl').and.returnValue({ data: { publicUrl: 'http://example.com' } })
        })
      },
      auth: {
        getUser: jasmine.createSpy('getUser').and.resolveTo({ data: { user: { id: 'auth_id' } }, error: null })
      },
      rpc: jasmine.createSpy('rpc').and.resolveTo({ data: null, error: null })
    };

    TestBed.configureTestingModule({
      providers: [
        DmsFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: LayoutDrawerService, useValue: drawerSpy },
        { provide: ConfirmModalService, useValue: confirmSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: DmsViewerService, useValue: viewerSpy }
      ]
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
      confirmSpy.confirm.and.resolveTo(true);
      const result = await facade.confirm(config);
      expect(confirmSpy.confirm).toHaveBeenCalledWith(config);
      expect(result).toBeTrue();
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
      expect(facade.uploadSaved()).toBeTrue();
    });
  });

  it('clearError should set error signal to null', () => {
    (facade as any)._error.set('some error');
    facade.clearError();
    expect(facade.error()).toBeNull();
  });
});
