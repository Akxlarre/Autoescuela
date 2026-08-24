import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';

export interface EpqPrintOptions {
  /** Nombre completo del alumno (opcional — si falta, se deja una línea en blanco). */
  studentName?: string | null;
  /** RUT del alumno (opcional). */
  rut?: string | null;
  /** Clase de licencia solicitada (ej: "A2"). */
  licencia?: string | null;
}

/**
 * EpqPrintService — abre una ventana de impresión con el test psicológico EPQ
 * en blanco (81 preguntas Sí/No) para que el alumno lo conteste en papel en la
 * sede cuando no respondió el test durante la pre-inscripción online.
 *
 * El PDF se genera server-side vía Edge Function `generate-epq-pdf` (spec 0011-m) —
 * reemplaza el HTML client-side que armaba antes `buildEpqTestHtml`. **No abre la ventana
 * antes del `await`** (mismo ajuste de UX que `FichaTecnicaPrintService`, pedido por el
 * usuario 2026-08-23 tras probar el flujo real: evitar el flash de `about:blank` mientras
 * carga) — espera el PDF completo y recién entonces `window.open(url, '_blank')`. El estado
 * de carga vive en el llamador (`AdminPreInscritosFacade.printBlankTest()`).
 */
@Injectable({ providedIn: 'root' })
export class EpqPrintService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Espera el PDF del test y recién entonces abre una nueva pestaña con él. Retorna `false`
   * si la Edge Function falló o si el navegador bloqueó la ventana emergente.
   */
  async printTest(opts: EpqPrintOptions = {}): Promise<boolean> {
    const { data, error } = await this.supabase.client.functions.invoke('generate-epq-pdf', {
      body: opts,
    });
    if (error || !data) return false;

    const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const blob = new Blob([rawBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const win = window.open(url, '_blank');
    if (!win) return false;

    win.focus();
    return true;
  }
}
