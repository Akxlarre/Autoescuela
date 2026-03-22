import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { DmsViewerDocument } from '@core/models/ui/dms.model';
import { SafePipe } from '../../../core/pipes/safe.pipe';

/**
 * DmsViewerModalComponent — Visor de documentos premium.
 * Soporta PDF, Imágenes y descarga.
 * Animaciones con GSAP gestionadas por el componente padre (AppShell/AnimateIn).
 */
@Component({
  selector: 'app-dms-viewer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, SafePipe],
  template: `
    <div
      class="fixed inset-0 z-70 flex flex-col bg-(--overlay-backdrop)"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-title"
    >
      <!-- HEADER -->
      <header class="h-16 flex items-center justify-between px-6 bg-(--bg-surface) border-b border-(--border-subtle) backdrop-blur-sm shadow-sm shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-(--bg-subtle)">
            <app-icon [name]="iconName()" [size]="20" />
          </div>
          <div class="min-w-0">
            <h3 id="viewer-title" class="font-bold text-text-primary text-base leading-tight truncate m-0">
              {{ doc().name }}
            </h3>
            <span class="text-xs text-text-secondary">Visualización de documento</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- BOTÓN DESCARGAR -->
          <button
            type="button"
            class="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer border border-(--border-subtle) bg-(--bg-surface) hover:bg-(--bg-subtle) text-text-primary"
            (click)="onDownload()"
          >
            <app-icon name="download" [size]="16" />
            Descargar
          </button>

          <!-- BOTÓN CERRAR -->
          <button
            type="button"
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer border-0 bg-transparent text-text-primary hover:bg-(--bg-subtle)"
            (click)="closed.emit()"
            aria-label="Cerrar visor"
          >
            <app-icon name="x" [size]="24" />
          </button>
        </div>
      </header>

      <!-- CONTENT AREA -->
      <main class="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-[#09090b]">
        @switch (doc().type) {
          @case ('image') {
            <div class="relative max-h-full max-w-full rounded-lg overflow-hidden shadow-2xl bg-white flex items-center justify-center">
              <img
                [src]="doc().url"
                [alt]="doc().name"
                class="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            </div>
          }
          @case ('pdf') {
            <div class="w-full h-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden">
              <iframe
                [src]="doc().url | safe: 'resourceUrl'"
                class="w-full h-full border-0"
                title="Visor PDF"
              ></iframe>
            </div>
          }
          @default {
            <div class="p-12 surface-glass rounded-2xl flex flex-col items-center gap-6 max-w-md text-center">
              <div class="w-16 h-16 rounded-2xl flex items-center justify-center bg-brand-muted shrink-0 shadow-glow">
                <app-icon name="file-question" [size]="32" class="text-brand" />
              </div>
              <div class="space-y-2">
                <h4 class="text-xl font-bold text-text-primary">Formato no soportado</h4>
                <p class="text-text-secondary text-sm">Este documento no puede visualizarse directamente en el navegador.</p>
              </div>
              <button
                type="button"
                class="btn-primary w-full"
                (click)="onDownload()"
              >
                Descargar para abrir
              </button>
            </div>
          }
        }
      </main>

      <!-- MOBILE FOOTER (SUBSTITUE FOR HIDDEN HEADER DOWNLOAD) -->
      <div class="sm:hidden p-4 bg-(--bg-surface) border-t border-(--border-subtle) shrink-0">
        <button
          type="button"
          class="w-full btn-primary"
          (click)="onDownload()"
        >
          <app-icon name="download" [size]="16" class="mr-2" />
          Descargar documento
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DmsViewerModalComponent {
  readonly doc = input.required<DmsViewerDocument>();
  readonly closed = output<void>();

  readonly iconName = computed(() => {
    switch (this.doc().type) {
      case 'image': return 'image';
      case 'pdf': return 'file-text';
      default: return 'file';
    }
  });

  onDownload(): void {
    const link = document.createElement('a');
    link.href = this.doc().url;
    link.download = this.doc().name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
