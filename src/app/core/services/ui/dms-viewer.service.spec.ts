import { TestBed } from '@angular/core/testing';
import { DmsViewerService } from './dms-viewer.service';

describe('DmsViewerService', () => {
  let service: DmsViewerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DmsViewerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should be closed initially', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.currentDoc()).toBeNull();
  });

  it('open should set document and open', () => {
    const doc = { url: 'test.pdf', name: 'Test', type: 'pdf' as any };
    service.open(doc);
    expect(service.isOpen()).toBe(true);
    expect(service.currentDoc()).toEqual(doc);
  });

  it('openByUrl should detect PDF', () => {
    service.openByUrl('test.pdf', 'Test');
    expect(service.currentDoc()?.type).toBe('pdf');
  });

  it('openByUrl should detect Image', () => {
    service.openByUrl('test.png', 'Test');
    expect(service.currentDoc()?.type).toBe('image');
  });

  describe('download() (fix-468-m)', () => {
    afterEach(() => vi.restoreAllMocks());

    function captureClickedLink(): { link: HTMLAnchorElement | null } {
      const captured = { link: null as HTMLAnchorElement | null };
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        captured.link = this;
      });
      return captured;
    }

    it('URL de Storage: enlace con download=<nombre>, sin pestaña nueva', () => {
      const captured = captureClickedLink();
      service.download({
        url: 'https://abc.supabase.co/storage/v1/object/sign/documents/a.pdf?token=t',
        name: 'Contrato',
        type: 'pdf',
      });
      expect(captured.link?.href).toBe(
        'https://abc.supabase.co/storage/v1/object/sign/documents/a.pdf?token=t&download=Contrato.pdf',
      );
      expect(captured.link?.target).toBe('');
    });

    it('URL externa: abre en pestaña nueva como antes', () => {
      const captured = captureClickedLink();
      service.download({ url: 'https://example.com/a.pdf', name: 'A', type: 'pdf' });
      expect(captured.link?.href).toBe('https://example.com/a.pdf');
      expect(captured.link?.target).toBe('_blank');
    });
  });

  it('close should reset document', () => {
    service.openByUrl('test.pdf', 'Test');
    service.close();
    expect(service.isOpen()).toBe(false);
    expect(service.currentDoc()).toBeNull();
  });
});
