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
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import type { LibroClasesSubnavSection } from '@core/models/ui/libro-clases-subnav.model';
import { pickSubnavTier, type SubnavTier } from '@core/utils/subnav-tier.utils';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Subnav horizontal adaptativo para el Libro de Clases: reemplaza el acordeón
 * de 7 secciones por una sola fila que muestra una sección a la vez. En vez
 * de depender de scroll horizontal cuando los 7 ítems no caben, comprime en
 * tiers (completo → abreviado → solo-ícono → dropdown) según el ancho real
 * del contenedor — mismo enfoque de densidad-por-contenedor que
 * `LayoutService.observeMain()` usa para el patrón App-like. Estilo del
 * track calcado del segmented control de Asistencia B (bg-subtle + pill
 * activa con borde de marca).
 */
@Component({
  selector: 'app-libro-de-clases-subnav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, IconComponent],
  template: `
    <div class="subnav-host" #hostEl>
      <!-- Medición oculta: cada fila (full/short/icon) se mide de forma
           independiente (inline-flex → shrink-to-fit propio) para saber su
           ancho natural real, sin que una fila "contamine" el ancho de las
           otras — bug detectado en QA visual: las 3 antes colapsaban al
           ancho de la más ancha por compartir un padre en bloque. -->
      <div class="subnav-measure" aria-hidden="true">
        <div class="subnav-measure-row" #fullMeasure>
          @for (s of sections(); track s.id) {
            <span class="subnav-item">
              <app-icon [name]="s.icon" [size]="14" />
              <span>{{ s.label }}</span>
            </span>
          }
        </div>
        <div class="subnav-measure-row" #shortMeasure>
          @for (s of sections(); track s.id) {
            <span class="subnav-item">
              <app-icon [name]="s.icon" [size]="14" />
              <span>{{ s.shortLabel }}</span>
            </span>
          }
        </div>
        <div class="subnav-measure-row" #iconMeasure>
          @for (s of sections(); track s.id) {
            <span class="subnav-item">
              <app-icon [name]="s.icon" [size]="14" />
            </span>
          }
        </div>
      </div>

      @if (tier() === 'select') {
        <p-select
          [options]="sections()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="activeId()"
          (ngModelChange)="onSelect($event)"
          styleClass="w-full"
          data-llm-description="dropdown para elegir la sección del libro de clases"
        />
      } @else {
        <div
          class="subnav-track flex gap-1 p-1 rounded-xl bg-subtle w-full"
          role="tablist"
          aria-label="Secciones del libro de clases"
        >
          @for (s of sections(); track s.id) {
            <button
              type="button"
              class="subnav-item flex-1 rounded-lg"
              role="tab"
              [attr.aria-selected]="s.id === activeId()"
              [attr.title]="s.label"
              [attr.data-llm-nav]="'libro-clases-' + s.id"
              [style.background]="s.id === activeId() ? 'var(--bg-surface)' : 'transparent'"
              [style.color]="s.id === activeId() ? 'var(--ds-brand)' : 'var(--text-muted)'"
              [style.boxShadow]="
                s.id === activeId()
                  ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12)), inset 0 0 0 1.5px var(--ds-brand)'
                  : 'none'
              "
              (click)="onSelect(s.id)"
            >
              <app-icon [name]="s.icon" [size]="14" />
              @if (tier() !== 'icon') {
                <span>{{ tier() === 'short' ? s.shortLabel : s.label }}</span>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .subnav-host {
      position: relative;
    }
    .subnav-measure {
      position: absolute;
      top: -9999px;
      left: -9999px;
      visibility: hidden;
      pointer-events: none;
    }
    .subnav-measure-row {
      display: inline-flex;
      gap: 6px;
      flex-wrap: nowrap;
      white-space: nowrap;
    }
    .subnav-track {
      flex-wrap: nowrap;
    }
    .subnav-item {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      appearance: none;
      border: none;
      font-family: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 12px 12px;
      cursor: pointer;
      transition:
        background-color 0.15s,
        color 0.15s,
        box-shadow 0.15s;
    }
  `,
})
export class LibroDeClasesSubnavComponent {
  readonly sections = input.required<LibroClasesSubnavSection[]>();
  readonly activeId = input.required<string>();
  readonly sectionChange = output<string>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = viewChild.required<ElementRef<HTMLElement>>('hostEl');
  private readonly fullMeasure = viewChild.required<ElementRef<HTMLElement>>('fullMeasure');
  private readonly shortMeasure = viewChild.required<ElementRef<HTMLElement>>('shortMeasure');
  private readonly iconMeasure = viewChild.required<ElementRef<HTMLElement>>('iconMeasure');

  readonly tier = signal<SubnavTier>('full');

  private resizeObserver?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      this.recomputeTier();

      if (typeof ResizeObserver === 'undefined') return;

      this.resizeObserver = new ResizeObserver(() => this.recomputeTier());
      this.resizeObserver.observe(this.hostEl().nativeElement);
      this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
    });
  }

  private recomputeTier(): void {
    const available = this.hostEl().nativeElement.clientWidth;
    const widths: Record<'full' | 'short' | 'icon', number> = {
      full: this.fullMeasure().nativeElement.scrollWidth,
      short: this.shortMeasure().nativeElement.scrollWidth,
      icon: this.iconMeasure().nativeElement.scrollWidth,
    };

    const next = pickSubnavTier((t) => widths[t] <= available);
    if (next !== this.tier()) this.tier.set(next);
  }

  onSelect(id: string): void {
    this.sectionChange.emit(id);
  }
}
