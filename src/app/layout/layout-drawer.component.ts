import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { PressFeedbackDirective } from '@core/directives/press-feedback.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';

/**
 * LayoutDrawerComponent — Panel lateral dinámico adaptativo.
 *
 * - Desktop (≥768px): layout-shifting (empuja el contenido como hermano en flex).
 * - Mobile (<768px):  fullscreen fixed con backdrop oscuro y animación translateX.
 *
 * El modo se detecta en tiempo de ejecución para permitir resize dinámico.
 *
 * @usageNotes
 * Se coloca en AppShellComponent como hermano de <main>.
 * Solo interactúa con LayoutDrawerService (via LayoutDrawerFacadeService en UI).
 */
@Component({
  selector: 'app-layout-drawer',
  standalone: true,
  imports: [CommonModule, IconComponent, PressFeedbackDirective, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // En desktop: hermano flex que empuja el contenido (layout-shift)
    // En mobile: fixed por GSAP (override via estilos inline en animación)
    class: 'shrink-0 overflow-hidden',
    style: 'width: 0px; display: none; box-sizing: border-box;',
  },
  template: `
    <!-- Backdrop (solo mobile, controlado por GSAP) -->
    <div
      #backdropEl
      data-drawer-backdrop
      class="fixed inset-0 bg-black/50 z-[-1]"
      style="opacity: 0; display: none; pointer-events: none;"
      (click)="close()"
      aria-hidden="true"
    ></div>

    <!-- Panel principal -->
    <div
      #panelEl
      class="flex flex-col w-full h-full bg-surface overflow-hidden"
      style="min-height: 0;"
    >
      <!-- Header -->
      <header
        class="flex items-center justify-between px-4 py-4 shrink-0 border-b"
        style="border-color: var(--border-subtle);"
      >
        <div class="flex items-center gap-3 min-w-0">
          @if (icon()) {
            <div
              class="flex items-center justify-center rounded-lg w-8 h-8 shrink-0"
              style="background: var(--color-primary-tint); color: var(--color-primary);"
            >
              <app-icon [name]="icon()!" [size]="18" />
            </div>
          }
          <h2 class="m-0 text-base font-semibold truncate" style="color: var(--text-primary);">
            {{ title() }}
          </h2>
        </div>

        <!-- Botón cerrar — siempre visible con área de toque generosa -->
        <button
          appPressFeedback
          (click)="close()"
          class="flex items-center justify-center shrink-0 w-10 h-10 rounded-full border-none bg-transparent cursor-pointer transition-colors"
          style="color: var(--text-muted);"
          onmouseover="this.style.color='var(--text-primary)'; this.style.backgroundColor='var(--bg-subtle)';"
          onmouseout="this.style.color='var(--text-muted)'; this.style.backgroundColor='transparent';"
          aria-label="Cerrar panel"
        >
          <app-icon name="x" [size]="22" />
        </button>
      </header>

      <!-- Body Dinámico -->
      <div class="flex-1 w-full overflow-y-auto px-4 py-5 box-border">
        @if (component()) {
          <ng-container *ngComponentOutlet="component()!" />
        }
      </div>
    </div>
  `,
})
export class LayoutDrawerComponent implements OnDestroy {
  private readonly layoutDrawer = inject(LayoutDrawerService);
  private readonly gsapService = inject(GsapAnimationsService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isOpen = this.layoutDrawer.isOpen;
  readonly component = this.layoutDrawer.component;
  readonly title = this.layoutDrawer.title;
  readonly icon = this.layoutDrawer.icon;

  private isCurrentlyVisible = false;

  constructor() {
    effect(() => {
      const open = this.isOpen();

      if (open && !this.isCurrentlyVisible) {
        this.isCurrentlyVisible = true;
        this.cdr.markForCheck();

        // Un tick para que Angular procese el NgComponentOutlet antes de animar
        setTimeout(() => {
          const backdropEl = this.el.nativeElement.querySelector('[data-drawer-backdrop]') as HTMLElement;
          this.gsapService.animateLayoutDrawerEnter(this.el.nativeElement, backdropEl ?? null);
        }, 0);
      } else if (!open && this.isCurrentlyVisible) {
        this.isCurrentlyVisible = false;
        const backdropEl = this.el.nativeElement.querySelector('[data-drawer-backdrop]') as HTMLElement;
        this.gsapService.animateLayoutDrawerLeave(this.el.nativeElement, backdropEl ?? null, () => {
          this.layoutDrawer.clear();
          this.cdr.markForCheck();
        });
      }
    });
  }

  ngOnDestroy(): void {
    // Garantizar que el body scroll se restaure si el componente se destruye
    document.body.style.overflow = '';
  }

  close(): void {
    this.layoutDrawer.close();
  }
}
