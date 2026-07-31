import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DmsFacade } from '@core/facades/dms.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SafePipe } from '@core/pipes/safe.pipe';

/**
 * DmsDocPreviewDrawerComponent — Previsualización de un documento, apilada (push)
 * sobre el drawer de lista (DmsStudentDocsDrawerComponent / DmsInstructorDocsDrawerComponent).
 * El botón "volver" lo provee el header del LayoutDrawer (canGoBack), no este componente.
 * Lee facade.previewDoc()/previewDocLoading(), poblados por facade.openDocPreview().
 */
@Component({
  selector: 'app-dms-doc-preview-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El host del componente ES el flex item dentro del body scrolleable del LayoutDrawer
  // (*ngComponentOutlet inserta el custom element directamente, sin wrapper). Sin esta clase
  // en el host, el tag <app-dms-doc-preview-drawer> queda `display:inline` por defecto y el
  // div interno con flex-1/h-full nunca hereda una altura real → el iframe/imagen colapsaba a
  // su tamaño mínimo, obligando a hacer scroll. Mismo patrón que otros drawers "hoja simple"
  // (ej. AgendaSlotDetailDrawerComponent).
  host: { class: 'flex flex-col flex-1 min-h-0' },
  imports: [IconComponent, SafePipe],
  template: `
    @if (facade.previewDocLoading()) {
      <div class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-4">
          <div
            class="w-10 h-10 rounded-full border-4 border-brand border-t-transparent animate-spin"
          ></div>
          <p class="text-text-secondary font-medium m-0">Cargando documento...</p>
        </div>
      </div>
    } @else if (facade.previewDoc(); as doc) {
      <div
        class="flex-1 bg-subtle relative overflow-hidden flex items-center justify-center p-4 min-h-0"
      >
        @switch (doc.type) {
          @case ('image') {
            <img
              [src]="doc.url"
              [alt]="doc.name"
              class="max-w-full max-h-full object-contain rounded shadow-sm border border-border-subtle"
            />
          }
          @case ('pdf') {
            <iframe
              [src]="doc.url | safe: 'resourceUrl'"
              class="w-full h-full rounded bg-white shadow-sm border border-border-subtle"
              title="Visor PDF"
            ></iframe>
          }
          @default {
            <div
              class="p-8 surface-glass rounded-2xl flex flex-col items-center gap-4 max-w-sm text-center"
            >
              <div
                class="w-16 h-16 rounded-2xl flex items-center justify-center bg-brand-muted shrink-0"
              >
                <app-icon name="file-question" [size]="32" class="text-brand" />
              </div>
              <h4 class="text-lg font-bold text-text-primary m-0">Formato no soportado</h4>
              <p class="text-text-secondary text-sm m-0">Este documento debe ser descargado.</p>
            </div>
          }
        }
      </div>
      <div class="shrink-0 px-4 py-3 border-t border-border-subtle bg-surface">
        <button
          type="button"
          class="btn-secondary w-full"
          data-llm-action="download-document"
          (click)="onDownload()"
        >
          <app-icon name="download" [size]="14" />
          Descargar
        </button>
      </div>
    } @else {
      <div class="flex-1 flex items-center justify-center bg-subtle/30">
        <div class="text-center p-8 max-w-sm">
          <div
            class="w-16 h-16 rounded-2xl bg-surface shadow-sm border border-border-subtle flex items-center justify-center mx-auto mb-4 text-text-secondary"
          >
            <app-icon name="file-question" [size]="24" />
          </div>
          <p class="text-text-secondary text-sm m-0">No se pudo cargar la vista previa.</p>
        </div>
      </div>
    }
  `,
})
export class DmsDocPreviewDrawerComponent {
  readonly facade = inject(DmsFacade);

  onDownload(): void {
    const doc = this.facade.previewDoc();
    if (!doc) return;
    const link = document.createElement('a');
    link.href = doc.url;
    link.download = doc.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
