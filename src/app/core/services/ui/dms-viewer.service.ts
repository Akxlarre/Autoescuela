import { Injectable, signal, computed, inject } from '@angular/core';
import type { DmsViewerDocument } from '@core/models/ui/dms.model';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

@Injectable({ providedIn: 'root' })
export class DmsViewerService {
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly _currentDoc = signal<DmsViewerDocument | null>(null);

  /** Documento actual en el visor (null = cerrado). */
  readonly currentDoc = this._currentDoc.asReadonly();

  /** Si el visor está visible. */
  readonly isOpen = computed(() => this._currentDoc() !== null);

  /**
   * Abre el visor con el documento especificado utilizando el LayoutDrawer.
   */
  open(doc: DmsViewerDocument): void {
    this._currentDoc.set(doc);
    
    // Importación diferida para evitar ciclos de inyección
    import('@shared/components/dms-viewer-modal/dms-viewer-modal.component').then((m) => {
      this.layoutDrawer.open(
        m.DmsViewerModalComponent, 
        doc.name, 
        doc.type === 'pdf' ? 'file-text' : doc.type === 'image' ? 'image' : 'file',
        [
          {
            label: 'Descargar',
            icon: 'download',
            callback: () => {
              const link = document.createElement('a');
              link.href = doc.url;
              link.download = doc.name;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }
        ]
      );
    });
  }

  /**
   * Abre el visor detectando automáticamente el tipo de archivo desde la URL.
   */
  openByUrl(url: string, name: string): void {
    const cleanUrl = url.split('?')[0].toLowerCase();
    const isPdf = cleanUrl.endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|tiff)$/i.test(cleanUrl);

    this.open({
      url,
      name,
      type: isPdf ? 'pdf' : isImage ? 'image' : 'other',
    });
  }

  /**
   * Cierra el visor.
   */
  close(): void {
    this._currentDoc.set(null);
  }
}
