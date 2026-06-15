import { TooltipModule } from 'primeng/tooltip';
import { ChangeDetectionStrategy, Component, input, output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { DmsViewerDocument } from '@core/models/ui/dms.model';
import { SafePipe } from '../../../core/pipes/safe.pipe';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';

/**
 * DmsViewerModalComponent — Visor de documentos premium.
 * Soporta PDF, Imágenes y descarga.
 * Animaciones con GSAP gestionadas por el componente padre (AppShell/AnimateIn).
 */
@Component({
  selector: 'app-dms-viewer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule, CommonModule, IconComponent, SafePipe],
  template: `
    <div class="flex-1 w-full h-full flex items-center justify-center bg-(--bg-subtle) min-h-0 p-4 sm:p-8">
      @switch (doc()?.type) {
        @case ('image') {
          <div class="relative w-full h-full flex items-center justify-center min-h-0">
            <img
              [src]="doc()?.url"
              [alt]="doc()?.name"
              class="max-w-full max-h-full object-contain rounded shadow-sm border border-(--border-subtle) bg-(--bg-surface)"
              loading="lazy"
            />
          </div>
        }
        @case ('pdf') {
          <div class="w-full h-full max-w-5xl bg-(--bg-surface) rounded-lg shadow-2xl overflow-hidden">
            <iframe
              [src]="doc()?.url | safe: 'resourceUrl'"
              class="w-full h-full border-0"
              title="Visor PDF"
            ></iframe>
          </div>
        }
        @default {
          <div
            class="p-12 surface-glass rounded-2xl flex flex-col items-center gap-6 max-w-md text-center"
          >
            <div
              class="w-16 h-16 rounded-2xl flex items-center justify-center bg-brand-muted shrink-0 shadow-glow"
            >
              <app-icon name="file-question" [size]="32" class="text-brand" />
            </div>
            <div class="space-y-2">
              <h4 class="text-xl font-bold text-text-primary">Formato no soportado</h4>
              <p class="text-text-secondary text-sm">
                Este documento no puede visualizarse directamente en el navegador.
              </p>
            </div>
            <button type="button" class="btn-primary w-full" (click)="onDownload()">
              Descargar para abrir
            </button>
          </div>
        }
      }
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
export class DmsViewerModalComponent {
  private readonly dms = inject(DmsViewerService);
  readonly doc = this.dms.currentDoc;
  readonly closed = output<void>();

  readonly iconName = computed(() => {
    switch (this.doc()?.type) {
      case 'image':
        return 'image';
      case 'pdf':
        return 'file-text';
      default:
        return 'file';
    }
  });

  onDownload(): void {
    const docData = this.doc();
    if (!docData) return;
    const link = document.createElement('a');
    link.href = docData.url;
    link.download = docData.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
