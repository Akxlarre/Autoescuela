import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { EpqPrintService } from './epq-print.service';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('EpqPrintService', () => {
  let service: EpqPrintService;
  let invoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invoke = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        EpqPrintService,
        { provide: SupabaseService, useValue: { client: { functions: { invoke } } } },
      ],
    });
    service = TestBed.inject(EpqPrintService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna false y no abre ventana si la Edge Function falla', async () => {
    const openSpy = vi.spyOn(window, 'open');
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const ok = await service.printTest({ studentName: 'Ana' });

    expect(ok).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('espera el PDF y recién entonces abre la pestaña con el blob URL (sin about:blank intermedio)', async () => {
    const fakeWin = { focus: vi.fn() } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');

    const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    invoke.mockResolvedValue({ data: pdfBlob, error: null });

    const ok = await service.printTest({ studentName: 'Ana', rut: '1-9' });

    expect(ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('generate-epq-pdf', {
      body: { studentName: 'Ana', rut: '1-9' },
    });
    expect(openSpy).toHaveBeenCalledWith('blob:fake-url', '_blank');
    expect(fakeWin.focus).toHaveBeenCalled();
  });

  it('retorna false si el navegador bloquea la ventana emergente (PDF ya generado, sin dónde mostrarlo)', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');

    const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    invoke.mockResolvedValue({ data: pdfBlob, error: null });

    const ok = await service.printTest({ studentName: 'Ana' });

    expect(ok).toBe(false);
  });
});
