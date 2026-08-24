import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';

/**
 * FichaTecnicaPrintService — abre una ventana de impresión con el informe de Ficha
 * Técnica (clases prácticas) de un alumno, aislado del resto de la SPA (topbar, sidebar,
 * drawers).
 *
 * El PDF se genera server-side vía Edge Function `generate-ficha-tecnica-pdf` (spec
 * 0011-m) — reemplaza el HTML client-side que armaba antes `buildFichaTecnicaPrintHtml`
 * (la Edge Function repite la misma query de `class_b_sessions`/`class_b_practice_attendance`
 * que hoy resuelve `AdminAlumnoDetalleFacade`, así que solo necesita `enrollment_id`).
 *
 * **A diferencia de `EpqPrintService`, la ventana NO se abre síncronamente antes del
 * `await`** (decisión del usuario, 2026-08-23): abrir una pestaña en blanco que muestra
 * `about:blank` mientras carga se sentía como un flash de contenido roto. En su lugar, el
 * estado de carga vive en el botón (`AdminFichaTecnicaDrawerComponent.printing`) y la
 * pestaña se abre recién con el PDF ya listo. Trade-off aceptado: algunos navegadores
 * pueden bloquear `window.open()` llamado después de un `await` si pasó demasiado tiempo
 * desde el clic del usuario (activación transitoria expirada) — en ese caso se propaga como
 * `false` igual que cualquier otro fallo, mostrando el toast de error existente.
 */
@Injectable({ providedIn: 'root' })
export class FichaTecnicaPrintService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Espera el PDF del informe y recién entonces abre una nueva pestaña con él. Retorna
   * `false` si la Edge Function falló o si el navegador bloqueó la ventana emergente.
   */
  async printFichaTecnica(enrollmentId: number): Promise<boolean> {
    const { data, error } = await this.supabase.client.functions.invoke(
      'generate-ficha-tecnica-pdf',
      { body: { enrollment_id: enrollmentId } },
    );
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
