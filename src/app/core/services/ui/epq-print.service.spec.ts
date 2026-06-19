import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EpqPrintService } from './epq-print.service';

describe('EpqPrintService', () => {
  let service: EpqPrintService;

  beforeEach(() => {
    service = new EpqPrintService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna false cuando el navegador bloquea la ventana emergente', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(service.printTest({ studentName: 'Ana' })).toBe(false);
  });

  it('escribe el HTML del test y dispara la impresión', () => {
    const print = vi.fn();
    const focus = vi.fn();
    const fakeWin = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus,
      print,
    } as unknown as Window;

    vi.spyOn(window, 'open').mockReturnValue(fakeWin);

    const ok = service.printTest({ studentName: 'Ana', rut: '1-9' });
    expect(ok).toBe(true);
    expect(fakeWin.document.write).toHaveBeenCalledOnce();
    const written = (fakeWin.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(written).toContain('Test Psicológico EPQ');
    expect(written).toContain('Ana');
    expect(focus).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});
