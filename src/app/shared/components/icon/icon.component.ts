import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';

// Mapa de emojis legacy a nombres oficiales de Lucide
const EMOJI_MAP: Record<string, string> = {
  '🚗': 'car',
  '📝': 'file-text',
  '🎓': 'graduation-cap',
  '🛡️': 'shield-check',
  '🎯': 'target',
  '📍': 'map-pin',
  '📆': 'calendar',
  '💳': 'credit-card',
  '🚛': 'truck',
  '💼': 'briefcase',
  '🏢': 'building-2',
  '⏰': 'clock',
  '🔒': 'lock',
  '🔑': 'key',
  '🔔': 'bell',
  '⭐': 'star',
  '👥': 'users',
  '👤': 'user',
  '❓': 'circle-help'
};

// Set de iconos provistos estáticamente en app.config.ts para saber si cargarlos localmente
const PROVIDED_ICONS = new Set([
  'arrow-left', 'arrow-right', 'arrow-right-left', 'arrow-up-down',
  'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'chevrons-down', 'chevrons-up',
  'external-link', 'home', 'layout-dashboard', 'layout', 'layers', 'menu', 'globe',
  'check', 'check-check', 'check-circle', 'check-square', 'circle-check', 'circle-play',
  'download', 'edit', 'edit-3', 'eraser', 'eye', 'filter', 'pencil', 'play', 'plus', 'plus-circle',
  'printer', 'refresh-cw', 'rotate-ccw', 'rotate-cw', 'save', 'search', 'search-x', 'send',
  'trash-2', 'upload', 'upload-cloud', 'x', 'x-circle', 'zoom-in',
  'alert-circle', 'alert-triangle', 'ban', 'circle-alert', 'circle-help', 'circle-x',
  'flag', 'help-circle', 'info', 'minus-circle', 'shield', 'shield-alert', 'shield-check', 'shield-off', 'triangle-alert',
  'user', 'user-check', 'user-minus', 'user-pen', 'user-plus', 'user-x', 'users',
  'clipboard-check', 'clipboard-list', 'file', 'file-badge', 'file-check', 'file-check-2',
  'file-clock', 'file-pen', 'file-plus', 'file-question', 'file-signature', 'file-spreadsheet',
  'file-text', 'table-2', 'file-x', 'filter-x', 'folder', 'folder-open', 'folder-search',
  'list', 'list-checks', 'scroll',
  'calendar', 'calendar-check', 'calendar-clock', 'calendar-days', 'calendar-plus', 'calendar-x',
  'clock', 'history',
  'banknote', 'calculator', 'credit-card', 'dollar-sign', 'landmark', 'piggy-bank', 'receipt', 'tag', 'wallet',
  'at-sign', 'bell', 'bell-off', 'inbox', 'mail', 'mail-check', 'message-circle', 'message-square-off', 'mic', 'phone',
  'camera', 'clock-alert', 'image', 'keyboard', 'monitor', 'monitor-off', 'moon', 'play-circle', 'qr-code', 'square', 'sun', 'video',
  'activity', 'archive', 'award', 'bar-chart-2', 'book-open', 'brain', 'briefcase', 'building-2', 'bus', 'car', 'circle', 'mouse-pointer-click',
  'flask-conical', 'gauge', 'graduation-cap', 'hash', 'coins', 'id-card', 'life-buoy', 'loader', 'loader-2', 'loader-circle', 'lock', 'log-out',
  'map-pin', 'pen-line', 'pen-tool', 'settings', 'settings-2', 'star', 'stethoscope', 'trending-down', 'trending-up', 'truck', 'unlock', 'wrench'
]);

// Caché en memoria para evitar descargar múltiples veces el mismo icono SVG desde la CDN
const SVG_CACHE = new Map<string, string>();

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    @if (isLocal()) {
      <lucide-icon
        [name]="resolvedName()"
        [size]="size()"
        [strokeWidth]="2"
        [absoluteStrokeWidth]="true"
        [color]="color()"
        [attr.aria-hidden]="ariaHidden() ? 'true' : null"
        [attr.aria-label]="!ariaHidden() ? ariaLabel() : null"
      />
    } @else {
      <span
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.color]="color()"
        [innerHTML]="safeSvgContent()"
        [attr.aria-hidden]="ariaHidden() ? 'true' : null"
        [attr.aria-label]="!ariaHidden() ? ariaLabel() : null"
        class="dynamic-svg-container"
      ></span>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
    }
    .dynamic-svg-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .dynamic-svg-container ::ng-deep svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      stroke-width: 2px;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
  `]
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** Nombre del ícono en kebab-case tal como aparece en lucide.dev (ej: "settings", "trending-up", "trash-2", o emoji 🚗) */
  readonly name = input.required<string>();

  /** Tamaño en px. Valores recomendados: 12, 14, 16, 18, 20, 24 */
  readonly size = input<number>(16);

  /** Color CSS. Default: currentColor — hereda el color del elemento padre */
  readonly color = input<string>('currentColor');

  /** Ocultar de lectores de pantalla. true → decorativo (default), false → semántico */
  readonly ariaHidden = input<boolean>(true);

  /** Label para AT cuando el ícono tiene significado semántico (ariaHidden: false) */
  readonly ariaLabel = input<string | undefined>(undefined);

  // Señal local para almacenar el SVG descargado dinámicamente
  private readonly dynamicSvg = signal<string>('');

  // Procesa y limpia el nombre del icono
  protected readonly resolvedName = computed(() => {
    const raw = this.name();
    if (!raw) return 'circle-help';
    
    const trimmed = raw.trim();
    // 1. Traducir emojis conocidos
    if (EMOJI_MAP[trimmed]) {
      return EMOJI_MAP[trimmed];
    }
    // 2. Retornar en minúsculas por si acaso
    return trimmed.toLowerCase();
  });

  // Determina si el icono está provisto localmente en el bundle estático de Angular
  protected readonly isLocal = computed(() => {
    const iconName = this.resolvedName();
    return PROVIDED_ICONS.has(iconName);
  });

  // Provee el SVG sanitizado para la inyección innerHTML segura
  protected readonly safeSvgContent = computed<SafeHtml>(() => {
    const svgStr = this.dynamicSvg();
    return this.sanitizer.bypassSecurityTrustHtml(svgStr);
  });

  constructor() {
    // Escucha cambios en el resolvedName para descargar el SVG si no está localmente en el bundle
    effect(() => {
      const name = this.resolvedName();
      const isLocal = this.isLocal();

      if (!isLocal) {
        this.loadDynamicSvg(name);
      }
    });
  }

  /**
   * Carga el SVG de Lucide en caliente desde la CDN oficial y lo almacena en la caché
   */
  private async loadDynamicSvg(iconName: string): Promise<void> {
    // Si ya está en la caché en memoria, usarlo directamente
    if (SVG_CACHE.has(iconName)) {
      this.dynamicSvg.set(SVG_CACHE.get(iconName)!);
      return;
    }

    try {
      const response = await fetch(`https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg`);
      if (response.ok) {
        const svgContent = await response.text();
        
        // Almacenar en caché y asignar a la señal reactiva
        SVG_CACHE.set(iconName, svgContent);
        this.dynamicSvg.set(svgContent);
      } else {
        console.warn(`[IconComponent] Icon "${iconName}" not found on CDN. Falling back to circle-help.`);
        this.useFallback();
      }
    } catch (err) {
      console.error(`[IconComponent] Failed to load dynamic icon "${iconName}" from CDN:`, err);
      this.useFallback();
    }
  }

  /**
   * Carga el icono estático por defecto "circle-help" en caso de falla o error
   */
  private useFallback(): void {
    // Dado que "circle-help" sí está provisto localmente en el bundle,
    // podemos simplemente usar la vía local. Sin embargo, para evitar comportamientos extraños
    // renderizaremos un SVG de fallback descargado si es necesario, o podemos inyectar un SVG local.
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
    this.dynamicSvg.set(fallbackSvg);
  }
}
