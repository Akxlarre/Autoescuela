import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';

import { FlotaDetalleFacade } from '@core/facades/flota-detalle.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { buildRouteSheetHtml } from '@core/utils/route-sheet-print.util';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SafePipe } from '@core/pipes/safe.pipe';

/**
 * RouteSheetDrawerComponent — Contenido dinámico para el LayoutDrawer.
 * Previsualiza la Hoja de Ruta Diaria (RF-091) del vehículo actual dentro de
 * un drawer (mismo patrón que `DmsViewerModalComponent`/`MaintenanceFormDrawerComponent`:
 * lee el estado ya cargado por `FlotaDetalleFacade`, sin recibir inputs propios).
 *
 * Reemplaza el flujo anterior de `window.open()` en pestaña nueva (fix-134-b):
 * evita el bloqueador de popups del navegador por completo — el documento se
 * previsualiza inline en un iframe `srcdoc`, con "Imprimir" disparando
 * `contentWindow.print()` acotado al iframe.
 */
@Component({
  selector: 'app-route-sheet-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SafePipe],
  template: `
    <div class="flex flex-col h-full w-full min-h-0">
      <div class="flex-1 min-h-0 w-full flex items-center justify-center bg-subtle p-4 sm:p-8">
        <div class="w-full h-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden">
          <iframe
            #sheetFrame
            [srcdoc]="html() | safe: 'html'"
            class="w-full h-full border-0"
            title="Hoja de Ruta Diaria"
          ></iframe>
        </div>
      </div>
      <div class="shrink-0 p-4 border-t border-border-subtle flex justify-end">
        <button
          type="button"
          class="btn-primary flex items-center gap-2"
          data-llm-action="print-route-sheet"
          (click)="print()"
        >
          <app-icon name="printer" [size]="16" />
          Imprimir
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 0%;
      min-height: 0;
      width: 100%;
      height: 100%;
    }
  `,
})
export class RouteSheetDrawerComponent {
  private readonly facade = inject(FlotaDetalleFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly sheetFrame = viewChild<ElementRef<HTMLIFrameElement>>('sheetFrame');

  readonly html = computed(() => {
    const v = this.facade.vehicle();
    const branchLabel = v?.bothBranches
      ? 'Ambas'
      : (this.branchFacade.branches().find((b) => b.id === v?.branchId)?.name ?? null);
    return buildRouteSheetHtml({
      licensePlate: v?.licensePlate,
      vehicleLabel: v?.vehicleLabel,
      instructorName: v?.instructorName,
      branchLabel,
    });
  });

  print(): void {
    this.sheetFrame()?.nativeElement.contentWindow?.print();
  }
}
