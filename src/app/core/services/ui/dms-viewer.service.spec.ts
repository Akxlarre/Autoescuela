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
    expect(service.isOpen()).toBeFalse();
    expect(service.currentDoc()).toBeNull();
  });

  it('open should set document and open', () => {
    const doc = { url: 'test.pdf', name: 'Test', type: 'pdf' as any };
    service.open(doc);
    expect(service.isOpen()).toBeTrue();
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

  it('close should reset document', () => {
    service.openByUrl('test.pdf', 'Test');
    service.close();
    expect(service.isOpen()).toBeFalse();
    expect(service.currentDoc()).toBeNull();
  });
});
