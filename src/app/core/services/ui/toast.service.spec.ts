import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let msgSpy: any;

  beforeEach(() => {
    msgSpy = { add: vi.fn() };

    TestBed.configureTestingModule({
      providers: [ToastService, { provide: MessageService, useValue: msgSpy }],
    });

    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('success() should add a success message with 3000ms life', () => {
    service.success('Title', 'Detail');
    expect(msgSpy.add).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Title',
      detail: 'Detail',
      life: 3000,
    });
  });

  it('error() should add an error message with 6000ms life', () => {
    service.error('Oops', 'Something failed');
    expect(msgSpy.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Oops',
      detail: 'Something failed',
      life: 6000,
    });
  });

  it('warning() should add a warn message with 4000ms life', () => {
    service.warning('Watch out');
    expect(msgSpy.add).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'Watch out',
      detail: undefined,
      life: 4000,
    });
  });

  it('info() should add an info message with 3000ms life', () => {
    service.info('FYI', 'Just so you know');
    expect(msgSpy.add).toHaveBeenCalledWith({
      severity: 'info',
      summary: 'FYI',
      detail: 'Just so you know',
      life: 3000,
    });
  });
});
