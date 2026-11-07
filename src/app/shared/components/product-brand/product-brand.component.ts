import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/**
 * ProductBrandComponent — marca del producto «Gestor de Autoescuelas» (fix-242-b).
 *
 * Placa redondeada con la G + logotipo, la misma marca de la entrada pública y del favicon.
 * Va en la puerta de la app (login, cambio de contraseña obligatorio); adentro, el sidebar
 * muestra la escuela del usuario (`resolveBrandText()`).
 *
 * Dumb puro. Es una firma, no un título: logotipo en gris secundario y peso 700, para no competir
 * con el h1 de la pantalla. La placa toma el azul de la app (fill-brand, el mismo del botón
 * principal y el que la entrada pública usa para «la app») y la G el color de la superficie:
 * G blanca sobre azul en modo claro, G oscura sobre celeste en modo oscuro. Un negro sólido
 * desentonaba con una pantalla toda blanca, gris y azul. El SVG vive acá y no en app-icon porque
 * es la marca, no un ícono de Lucide.
 *
 * Tamaños: md (login) · sm (encabezado secundario, cambio de contraseña).
 */
@Component({
  selector: 'app-product-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-2 font-display leading-none text-text-secondary"
      role="img"
      aria-label="Gestor de Autoescuelas"
    >
      <svg
        class="shrink-0"
        [class.size-7]="size() === 'md'"
        [class.size-6]="size() === 'sm'"
        viewBox="0 0 32 32"
        aria-hidden="true"
      >
        <rect class="fill-brand" width="32" height="32" rx="6" />
        <path
          class="stroke-surface"
          d="M22.01 9.99A8.5 8.5 0 1 0 24.5 16H17"
          fill="none"
          stroke-width="3.4"
        />
      </svg>
      <!-- Tamaño por style y no con la clase text-base: en este DS text-base también es el color
           del fondo de página (token color-base) y pintaba el logotipo casi invisible. -->
      <span
        class="font-bold tracking-tight"
        [style.font-size.rem]="size() === 'md' ? 1 : 0.875"
        aria-hidden="true"
        >Gestor <span class="font-normal">de</span> Autoescuelas</span
      >
    </span>
  `,
  host: { class: 'inline-flex' },
})
export class ProductBrandComponent {
  /** md: login · sm: encabezado secundario (cambio de contraseña). */
  readonly size = input<'md' | 'sm'>('md');
}
