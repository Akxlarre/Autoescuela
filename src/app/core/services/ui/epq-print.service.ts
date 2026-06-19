import { Injectable } from '@angular/core';

import { buildEpqTestHtml, type EpqPrintOptions } from '@core/utils/epq-print.util';

/**
 * EpqPrintService — abre una ventana de impresión con el test psicológico EPQ
 * en blanco (81 preguntas Sí/No) para que el alumno lo conteste en papel en la
 * sede cuando no respondió el test durante la pre-inscripción online.
 *
 * Aísla el efecto sobre el DOM (`window.open` + `print()`); el armado del HTML
 * es una función pura en `core/utils/epq-print.util.ts` (testeable sin DOM).
 */
@Injectable({ providedIn: 'root' })
export class EpqPrintService {
  /**
   * Abre una nueva ventana con el test maquetado y dispara el diálogo de
   * impresión del navegador (desde donde el usuario puede imprimir o "Guardar
   * como PDF"). Retorna `false` si el navegador bloqueó la ventana emergente.
   */
  printTest(opts: EpqPrintOptions = {}): boolean {
    const html = buildEpqTestHtml(opts);
    const win = window.open('', '_blank');
    if (!win) return false;

    win.document.open();
    win.document.write(html);
    win.document.close();

    // La ventana hereda el origen del opener (about:blank es same-origin),
    // por lo que pushState puede cambiar la URL que muestra el footer de impresión.
    win.history.pushState({}, '', '/Cuestionario-de-Personalidad-EPQ');

    win.focus();
    win.print();

    return true;
  }
}
