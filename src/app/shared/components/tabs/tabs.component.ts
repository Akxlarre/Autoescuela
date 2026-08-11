import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { pickSubnavTier, type SubnavTier } from '@core/utils/subnav-tier.utils';

export interface TabOption {
  id: string;
  label: string;
  /** Etiqueta abreviada para el tier "short" (variant="line") cuando el label completo no cabe. Si se omite, ese tier no abrevia este tab. */
  shortLabel?: string;
  count?: number | null;
  icon?: string;
  disabled?: boolean;
}

export type TabVariant = 'line' | 'segmented' | 'pill';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'line') {
      <div class="tabs-line-host" #lineHost>
        <!-- Medición oculta: cada fila (full/short/icon) mide su ancho natural real
             de forma independiente (inline-flex → shrink-to-fit propio), igual que
             libro-de-clases-subnav.component.ts (fix-052-m). -->
        <div class="tabs-measure" aria-hidden="true">
          <div class="tabs-measure-row" #lineFullMeasure>
            @for (tab of tabs(); track tab.id) {
              <span class="tabs-measure-item">
                @if (tab.icon) {
                  <app-icon [name]="tab.icon" [size]="16" />
                }
                <span
                  [class.uppercase]="uppercase()"
                  [class.text-xs]="uppercase()"
                  [class.tracking-wider]="uppercase()"
                  >{{ tab.label }}</span
                >
              </span>
            }
          </div>
          <div class="tabs-measure-row" #lineShortMeasure>
            @for (tab of tabs(); track tab.id) {
              <span class="tabs-measure-item">
                @if (tab.icon) {
                  <app-icon [name]="tab.icon" [size]="16" />
                }
                <span
                  [class.uppercase]="uppercase()"
                  [class.text-xs]="uppercase()"
                  [class.tracking-wider]="uppercase()"
                  >{{ tab.shortLabel || tab.label }}</span
                >
              </span>
            }
          </div>
          <div class="tabs-measure-row" #lineIconMeasure>
            @for (tab of tabs(); track tab.id) {
              <span class="tabs-measure-item">
                @if (tab.icon) {
                  <app-icon [name]="tab.icon" [size]="16" />
                }
              </span>
            }
          </div>
        </div>

        @if (lineTier() === 'select') {
          <p-select
            [options]="tabs()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="activeId()"
            (ngModelChange)="activeIdChange.emit($event)"
            styleClass="w-full"
            data-llm-description="dropdown para elegir la tab activa"
          />
        } @else {
          <div class="flex border-b border-border-default" role="tablist">
            @for (tab of tabs(); track tab.id) {
              <button
                role="tab"
                class="flex-1 px-4 py-3.5 text-sm font-medium transition-all duration-300 border-b-[3px] cursor-pointer flex items-center justify-center gap-1.5"
                [class.border-brand]="activeId() === tab.id"
                [class.border-transparent]="activeId() !== tab.id"
                [class.tab-line-active]="activeId() === tab.id"
                [style.color]="
                  activeId() === tab.id
                    ? 'var(--ds-brand, var(--text-primary))'
                    : 'var(--text-muted)'
                "
                [style.border-color]="
                  activeId() === tab.id ? 'var(--ds-brand, var(--color-brand))' : 'transparent'
                "
                [attr.aria-selected]="activeId() === tab.id"
                [attr.title]="tab.label"
                [disabled]="tab.disabled"
                (click)="!tab.disabled && activeIdChange.emit(tab.id)"
                [attr.data-llm-action]="'seleccionar-tab-' + tab.id"
              >
                @if (tab.icon) {
                  <app-icon [name]="tab.icon" [size]="16" />
                }
                @if (lineTier() !== 'icon') {
                  <span
                    [class.uppercase]="uppercase()"
                    [class.text-xs]="uppercase()"
                    [class.tracking-wider]="uppercase()"
                  >
                    {{ lineTier() === 'short' ? tab.shortLabel || tab.label : tab.label }}
                  </span>
                }
                @if (tab.count != null && tab.count > 0) {
                  <span class="tab-count ml-1.5">
                    {{ tab.count }}
                  </span>
                }
              </button>
            }
          </div>
        }
      </div>
    }

    @if (variant() === 'segmented') {
      <div
        class="flex gap-1 self-start p-1 rounded-lg bg-subtle"
        [class.flex-wrap]="wrap()"
        [class.overflow-x-auto]="!wrap()"
        [class.custom-scrollbar-hidden]="!wrap()"
        role="tablist"
      >
        @for (tab of tabs(); track tab.id) {
          <button
            role="tab"
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border-0 flex items-center justify-center gap-1.5 shrink-0"
            [style.background]="activeId() === tab.id ? 'var(--bg-surface)' : 'transparent'"
            [style.color]="activeId() === tab.id ? 'var(--text-primary)' : 'var(--text-muted)'"
            [style.box-shadow]="
              activeId() === tab.id ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12))' : 'none'
            "
            [attr.aria-selected]="activeId() === tab.id"
            [disabled]="tab.disabled"
            (click)="!tab.disabled && activeIdChange.emit(tab.id)"
            [attr.data-llm-action]="'seleccionar-tab-' + tab.id"
          >
            @if (tab.icon) {
              <app-icon [name]="tab.icon" [size]="16" />
            }
            <span
              [class.uppercase]="uppercase()"
              [class.text-xs]="uppercase()"
              [class.tracking-wider]="uppercase()"
            >
              {{ tab.label }}
            </span>
            @if (tab.count != null && tab.count > 0) {
              <span class="tab-count ml-1.5">
                {{ tab.count }}
              </span>
            }
          </button>
        }
      </div>
    }

    @if (variant() === 'pill') {
      <div class="flex flex-wrap gap-2 overflow-x-auto custom-scrollbar-hidden" role="tablist">
        @for (tab of tabs(); track tab.id) {
          <button
            type="button"
            role="tab"
            class="relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all outline-none whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5"
            [class.text-brand]="activeId() === tab.id"
            [class.text-text-muted]="activeId() !== tab.id"
            [class.hover:text-text-primary]="activeId() !== tab.id"
            [attr.aria-selected]="activeId() === tab.id"
            [disabled]="tab.disabled"
            (click)="!tab.disabled && activeIdChange.emit(tab.id)"
            [attr.data-llm-action]="'seleccionar-tab-' + tab.id"
          >
            @if (activeId() === tab.id) {
              <div
                class="absolute inset-0 bg-brand-muted border border-brand/20 rounded-xl shadow-sm z-0"
              ></div>
            } @else {
              <div
                class="absolute inset-0 bg-surface border border-border-subtle rounded-xl z-0"
              ></div>
            }
            <span class="relative z-10 flex items-center gap-2">
              @if (tab.icon) {
                <app-icon
                  [name]="tab.icon"
                  [size]="16"
                  [class.text-brand]="activeId() === tab.id"
                />
              }
              <span
                [class.uppercase]="uppercase()"
                [class.text-xs]="uppercase()"
                [class.tracking-wider]="uppercase()"
              >
                {{ tab.label }}
              </span>
              @if (tab.count != null && tab.count > 0) {
                <span class="tab-count border border-border-subtle bg-surface">
                  {{ tab.count }}
                </span>
              }
            </span>
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .custom-scrollbar-hidden {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .custom-scrollbar-hidden::-webkit-scrollbar {
        display: none;
      }
      .tabs-line-host {
        position: relative;
      }
      .tabs-measure {
        position: absolute;
        top: -9999px;
        left: -9999px;
        visibility: hidden;
        pointer-events: none;
      }
      .tabs-measure-row {
        display: inline-flex;
        flex-wrap: nowrap;
        white-space: nowrap;
      }
      .tabs-measure-item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        white-space: nowrap;
        padding: 0.875rem 1rem;
        font-size: var(--text-sm);
        font-weight: 500;
      }
      .tab-line-active {
        background: radial-gradient(
            50% 20px at bottom center,
            color-mix(in srgb, var(--ds-brand, #0ea5e9) 15%, transparent) 0%,
            transparent 100%
          )
          no-repeat bottom center;
      }
    `,
  ],
})
export class TabsComponent {
  tabs = input.required<TabOption[]>();
  activeId = input.required<string>();
  variant = input<TabVariant>('line');
  uppercase = input<boolean>(false);
  /** Solo aplica a variant="segmented": true = las tabs bajan de línea; false (default) = scroll horizontal. */
  wrap = input<boolean>(false);

  activeIdChange = output<string>();

  /** Tier vigente de la variante "line" — full/short/icon/select según el ancho real del host. */
  readonly lineTier = signal<SubnavTier>('full');

  private readonly destroyRef = inject(DestroyRef);
  private readonly lineHost = viewChild<ElementRef<HTMLElement>>('lineHost');
  private readonly lineFullMeasure = viewChild<ElementRef<HTMLElement>>('lineFullMeasure');
  private readonly lineShortMeasure = viewChild<ElementRef<HTMLElement>>('lineShortMeasure');
  private readonly lineIconMeasure = viewChild<ElementRef<HTMLElement>>('lineIconMeasure');

  private resizeObserver?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      this.recomputeLineTier();

      if (typeof ResizeObserver === 'undefined') return;

      this.resizeObserver = new ResizeObserver(() => this.recomputeLineTier());
      const host = this.lineHost()?.nativeElement;
      if (host) this.resizeObserver.observe(host);
      this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
    });
  }

  private recomputeLineTier(): void {
    const host = this.lineHost()?.nativeElement;
    const full = this.lineFullMeasure()?.nativeElement;
    const short = this.lineShortMeasure()?.nativeElement;
    const icon = this.lineIconMeasure()?.nativeElement;
    if (!host || !full || !short || !icon) return;

    const available = host.clientWidth;
    const widths: Record<'full' | 'short' | 'icon', number> = {
      full: full.scrollWidth,
      short: short.scrollWidth,
      icon: icon.scrollWidth,
    };

    const next = pickSubnavTier((t) => widths[t] <= available);
    if (next !== this.lineTier()) this.lineTier.set(next);
  }
}
