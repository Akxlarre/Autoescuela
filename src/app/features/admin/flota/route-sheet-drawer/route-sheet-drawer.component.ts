import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { FlotaDetalleFacade } from '@core/facades/flota-detalle.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SafePipe } from '@core/pipes/safe.pipe';

/**
 * RouteSheetDrawerComponent — Contenido dinámico para el LayoutDrawer.
 * Previsualiza la Hoja de Ruta Diaria (RF-091) del vehículo actual dentro de
 * un drawer (mismo patrón que `DmsViewerModalComponent`/`MaintenanceFormDrawerComponent`:
 * lee el estado ya cargado por `FlotaDetalleFacade`, sin recibir inputs propios).
 *
 * El documento se genera server-side vía `FlotaDetalleFacade.generateRouteSheetPdf()`
 * (Edge Function `generate-route-sheet-pdf`, spec 0011-m) — reemplaza el HTML client-side
 * de `buildRouteSheetHtml` que existía hasta entonces. Se previsualiza inline en un iframe
 * apuntando al PDF vía blob URL (mismo mecanismo anti-popup-blocker de fix-134-b, ahora
 * sobre un PDF real en vez de HTML con `srcdoc`).
 */
@Component({
  selector: 'app-route-sheet-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SafePipe],
  template: `
    <div class="flex flex-col h-full w-full min-h-0">
      <div class="flex-1 min-h-0 w-full flex items-center justify-center bg-subtle p-4 sm:p-8">
        @if (isLoading()) {
          <app-icon name="loader-circle" [size]="32" class="animate-spin text-text-muted" />
        } @else if (pdfUrl()) {
          <div class="w-full h-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden">
            <iframe
              #sheetFrame
              [src]="pdfUrl() | safe: 'resourceUrl'"
              class="w-full h-full border-0"
              title="Hoja de Ruta Diaria"
            ></iframe>
          </div>
        } @else {
          <p class="text-text-muted text-sm">
            No se pudo generar la Hoja de Ruta. Inténtalo de nuevo.
          </p>
        }
      </div>
      <div class="shrink-0 p-4 border-t border-border-subtle flex justify-end">
        <button
          type="button"
          class="btn-primary flex items-center gap-2"
          data-llm-action="print-route-sheet"
          [disabled]="isLoading() || !pdfUrl()"
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly sheetFrame = viewChild<ElementRef<HTMLIFrameElement>>('sheetFrame');

  private readonly _pdfUrl = signal<string | null>(null);
  private readonly _isLoading = signal(false);
  readonly pdfUrl = this._pdfUrl.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  constructor() {
    effect(() => {
      const vehicleId = this.facade.vehicle()?.id;
      if (vehicleId == null) return;
      void this.loadPdf(vehicleId);
    });
    this.destroyRef.onDestroy(() => this.revokeCurrentUrl());
  }

  private async loadPdf(vehicleId: number): Promise<void> {
    this._isLoading.set(true);
    const blob = await this.facade.generateRouteSheetPdf(vehicleId);
    this.revokeCurrentUrl();
    this._pdfUrl.set(blob ? URL.createObjectURL(blob) : null);
    this._isLoading.set(false);
  }

  private revokeCurrentUrl(): void {
    const current = this._pdfUrl();
    if (current) URL.revokeObjectURL(current);
  }

  print(): void {
    this.sheetFrame()?.nativeElement.contentWindow?.print();
  }
}
