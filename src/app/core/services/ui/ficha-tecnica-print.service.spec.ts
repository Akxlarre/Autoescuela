import { describe, it, expect, vi, afterEach } from 'vitest';
import { FichaTecnicaPrintService } from './ficha-tecnica-print.service';
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';

function makeClase(over: Partial<ClasePracticaUI> = {}): ClasePracticaUI {
  return {
    numero: 1,
    sessionId: 1,
    fecha: '09-07',
    scheduledDate: '2026-07-09',
    scheduledAt: '2026-07-09T11:00:00',
    hora: '11:00-11:45',
    instructor: 'Roberto Andrés Soto',
    kmInicio: null,
    kmFin: null,
    observaciones: null,
    completada: false,
    ausente: false,
    cancelada: false,
    justificada: false,
    justificacion: null,
    alumnoFirmo: false,
    instructorFirmo: false,
    ...over,
  };
}

describe('FichaTecnicaPrintService', () => {
  let service: FichaTecnicaPrintService;

  beforeEach(() => {
    service = new FichaTecnicaPrintService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna false cuando el navegador bloquea la ventana emergente', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(service.printFichaTecnica([makeClase()])).toBe(false);
  });

  it('escribe el HTML del informe y dispara la impresión', () => {
    const print = vi.fn();
    const focus = vi.fn();
    const fakeWin = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus,
      print,
    } as unknown as Window;

    vi.spyOn(window, 'open').mockReturnValue(fakeWin);

    const ok = service.printFichaTecnica([makeClase({ numero: 3 })], {
      studentName: 'Erling Haaland Braut',
      matricula: '#0015',
    });

    expect(ok).toBe(true);
    expect(fakeWin.document.write).toHaveBeenCalledOnce();
    const written = (fakeWin.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(written).toContain('Ficha Técnica');
    expect(written).toContain('Erling Haaland Braut');
    expect(written).toContain('#3');
    expect(focus).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});
