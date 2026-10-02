import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './file-download.utils';

describe('downloadBlob', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pulsa un enlace con el nombre de archivo pedido y libera la URL', () => {
    const createUrl = vi.fn().mockReturnValue('blob:fake');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const link = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(link as unknown as HTMLElement);
    const blob = new Blob(['x'], { type: 'application/pdf' });

    downloadBlob(blob, 'ex-alumnos-b_2026-10-02.pdf');

    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(link.href).toBe('blob:fake');
    expect(link.download).toBe('ex-alumnos-b_2026-10-02.pdf');
    expect(link.click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');
    vi.unstubAllGlobals();
  });
});
