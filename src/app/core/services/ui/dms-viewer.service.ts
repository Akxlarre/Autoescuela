import { Injectable, signal, computed, inject } from '@angular/core';
import type { DmsViewerDocument } from '@core/models/ui/dms.model';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { documentDownloadUrl } from '@core/utils/document-download.utils';

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
      this.layoutDrawer.push(
        m.DmsViewerModalComponent,
        doc.name,
        doc.type === 'pdf' ? 'file-text' : doc.type === 'image' ? 'image' : 'file',
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
   * Descarga el documento (fix-468-m). Con una URL de Storage, la descarga es real
   * (`documentDownloadUrl`); con otra URL, se abre en una pestaña nueva como antes.
   */
  download(doc: Pick<DmsViewerDocument, 'url' | 'name'>): void {
    const downloadUrl = documentDownloadUrl(doc.url, doc.name);
    const link = document.createElement('a');
    link.href = downloadUrl ?? doc.url;
    if (!downloadUrl) link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Cierra el visor.
   */
  close(): void {
    this._currentDoc.set(null);
  }
}
