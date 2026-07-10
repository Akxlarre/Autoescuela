import { Injectable } from '@angular/core';

import {
  buildFichaTecnicaPrintHtml,
  type FichaTecnicaPrintOptions,
} from '@core/utils/ficha-tecnica-print.util';
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';

/**
 * FichaTecnicaPrintService — abre una ventana de impresión con el informe
 * de Ficha Técnica (clases prácticas) de un alumno, aislado del resto de la
 * SPA (topbar, sidebar, drawers).
 *
 * Aísla el efecto sobre el DOM (`window.open` + `print()`); el armado del
 * HTML es una función pura en `core/utils/ficha-tecnica-print.util.ts`
 * (testeable sin DOM). Mismo patrón que `EpqPrintService`.
 */
@Injectable({ providedIn: 'root' })
export class FichaTecnicaPrintService {
  /**
   * Abre una nueva ventana con el informe maquetado y dispara el diálogo de
   * impresión del navegador. Retorna `false` si el navegador bloqueó la
   * ventana emergente.
   */
  printFichaTecnica(clases: ClasePracticaUI[], opts: FichaTecnicaPrintOptions = {}): boolean {
    const html = buildFichaTecnicaPrintHtml(clases, opts);
    const win = window.open('', '_blank');
    if (!win) return false;

    win.document.open();
    win.document.write(html);
    win.document.close();

    win.focus();
    win.print();

    return true;
  }
}
