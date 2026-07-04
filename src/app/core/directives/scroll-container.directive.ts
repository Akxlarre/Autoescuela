import {
  Directive,
  ElementRef,
  Renderer2,
  inject,
  input,
  afterNextRender,
  DestroyRef,
  effect,
} from '@angular/core';

/**
 * Directiva reutilizable que convierte cualquier contenedor en una caja con scroll
 * interno vertical (y opcionalmente horizontal), aplicando un `max-height` configurable
 * para evitar que el contenedor desborde la página o un drawer.
 *
 * Aplica automáticamente estilos de scrollbar refinados consistentes con los tokens
 * del design system (`_scrollbar.scss`).
 *
 * @example Uso básico (default 65vh):
 * ```html
 * <div appScrollContainer>
 *   <!-- contenido largo -->
 * </div>
 * ```
 *
 * @example Altura personalizada:
 * ```html
 * <div appScrollContainer maxHeight="400px">
 *   <!-- contenido largo -->
 * </div>
 * ```
 *
 * @example Con scroll horizontal habilitado:
 * ```html
 * <div appScrollContainer maxHeight="70vh" [scrollX]="true">
 *   <!-- contenido ancho -->
 * </div>
 * ```
 *
 * @example Sin límite de altura (solo scroll-behavior + scrollbar styling):
 * ```html
 * <div appScrollContainer maxHeight="none">
 *   <!-- el padre controla la altura via flex/grid -->
 * </div>
 * ```
 */
@Directive({
  selector: '[appScrollContainer]',
  standalone: true,
})
export class ScrollContainerDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Altura máxima del contenedor. Acepta cualquier valor CSS válido.
   * - `'65vh'` (default) — ocupa hasta el 65% del viewport
   * - `'400px'` — altura fija en píxeles
   * - `'none'` — sin límite (útil cuando el padre controla la altura vía flex)
   */
  readonly maxHeight = input('65vh');

  /** Habilitar scroll horizontal además del vertical. Default: false. */
  readonly scrollX = input(false);

  constructor() {
    // Aplicar estilos iniciales después del primer render
    afterNextRender(() => {
      this._applyStyles();
    });

    // Reaccionar a cambios en los inputs
    effect(() => {
      // Leer signals para trackear dependencias
      const mh = this.maxHeight();
      const sx = this.scrollX();
      // Aplicar (effect se re-ejecuta cuando cambian)
      this._applyStyleValues(mh, sx);
    });
  }

  /** Aplica los estilos CSS base al host element. */
  private _applyStyles(): void {
    const el = this.el.nativeElement;

    this.renderer.setStyle(el, 'overflow-y', 'auto');
    this.renderer.setStyle(el, 'scroll-behavior', 'smooth');
    this.renderer.setStyle(el, '-webkit-overflow-scrolling', 'touch');

    // Aplicar valores reactivos
    this._applyStyleValues(this.maxHeight(), this.scrollX());
  }

  /** Aplica max-height y overflow-x basándose en los inputs actuales. */
  private _applyStyleValues(maxHeight: string, scrollX: boolean): void {
    const el = this.el.nativeElement;

    if (maxHeight && maxHeight !== 'none') {
      this.renderer.setStyle(el, 'max-height', maxHeight);
    } else {
      this.renderer.removeStyle(el, 'max-height');
    }

    this.renderer.setStyle(el, 'overflow-x', scrollX ? 'auto' : 'hidden');
  }
}
