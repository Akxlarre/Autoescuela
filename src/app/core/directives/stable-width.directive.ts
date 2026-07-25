import { DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';

/**
 * Fija el ancho del host al de su contenido "completo" (idle) para que no se achique
 * al mostrar un estado de carga con texto más corto (ej: "Guardar y Continuar" → "Procesando...").
 * Usa ResizeObserver (nativo del navegador) en vez de hooks de renderizado de Angular —
 * reacciona al tamaño real ya calculado por el layout, sin depender de timing de CD.
 * Uso: <button [appStableWidth]="isSaving()">
 */
@Directive({
  selector: '[appStableWidth]',
  standalone: true,
  host: {
    '[style.min-width.px]': 'stableWidth()',
  },
})
export class StableWidthDirective {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** true mientras el contenido está en su versión reducida (loading/procesando) — no se remide en ese estado. */
  readonly appStableWidth = input<boolean>(false);

  protected readonly stableWidth = signal<number | null>(null);

  constructor() {
    const el = this.host.nativeElement;
    const observer = new ResizeObserver(() => {
      if (this.appStableWidth()) return;
      const width = el.offsetWidth;
      if (width) {
        this.stableWidth.set(width);
      }
    });
    observer.observe(el);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
