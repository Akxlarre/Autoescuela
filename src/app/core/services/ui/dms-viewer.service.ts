import { Injectable, signal, computed } from '@angular/core';
import type { DmsViewerDocument } from '@core/models/ui/dms.model';

@Injectable({ providedIn: 'root' })
export class DmsViewerService {
  private readonly _currentDoc = signal<DmsViewerDocument | null>(null);

  /** Documento actual en el visor (null = cerrado). */
  readonly currentDoc = this._currentDoc.asReadonly();

  /** Si el visor está visible. */
  readonly isOpen = computed(() => this._currentDoc() !== null);

  /**
   * Abre el visor con el documento especificado.
   */
  open(doc: DmsViewerDocument): void {
    this._currentDoc.set(doc);
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
