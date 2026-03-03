import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    input,
    output,
    viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { PressFeedbackDirective } from '@core/directives/press-feedback.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * DrawerComponent — Componente de panel lateral premium animado con GSAP.
 * Usado para ver detalles, formularios o tablas complementarias al dashboard
 * sin perder contexto.
 * 
 * Sigue las reglas estrictas de UI: 
 * - Usa \`var(--overlay-backdrop)\`, \`var(--bg-surface)\`, etc.
 * - Cambios de estado manejados vía Signal Inputs/Outputs (OnPush).
 * - Cero keyframes de CSS, toda la animación pasa por GsapAnimationsService.
 */
@Component({
    selector: 'app-drawer',
    standalone: true,
    imports: [CommonModule, IconComponent, PressFeedbackDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (isOpen()) {
      <!-- Backdrop (overlay) -->
      <div
        #backdrop
        class="fixed inset-0 z-40"
        style="background: var(--overlay-backdrop); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
        (click)="close()"
        aria-hidden="true"
      ></div>

      <!-- Drawer Panel -->
      <div
        #panel
        class="fixed inset-y-0 right-0 z-50 flex flex-col w-full md:w-[50%] shadow-2xl"
        style="background: var(--bg-surface);"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
      >
        <!-- Header -->
        <header
          class="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-transparent"
          style="border-color: var(--border-subtle);"
        >
          <div class="flex items-center gap-3">
            @if (icon()) {
              <div 
                class="flex items-center justify-center rounded-lg w-8 h-8" 
                style="background: var(--color-primary-tint); color: var(--color-primary);"
              >
                 <app-icon [name]="icon()!" [size]="18" />
              </div>
            }
            <h2 [id]="titleId" class="m-0 text-lg font-semibold" style="color: var(--text-primary);">
              {{ title() }}
            </h2>
          </div>
          <button
            appPressFeedback
            (click)="close()"
            class="flex items-center justify-center w-8 h-8 rounded-full border-none bg-transparent cursor-pointer transition-colors"
            style="color: var(--text-muted);"
            onmouseover="this.style.color='var(--text-primary)'; this.style.backgroundColor='var(--bg-subtle)';"
            onmouseout="this.style.color='var(--text-muted)'; this.style.backgroundColor='transparent';"
            aria-label="Cerrar panel"
          >
            <app-icon name="x" [size]="20" />
          </button>
        </header>

        <!-- Body -->
        <div class="flex-1 px-6 py-6 overflow-y-auto" style="background: var(--bg-surface);">
          <ng-content></ng-content>
        </div>
        
        <!-- Footer (opcional via select) -->
        @if (hasFooter()) {
            <footer class="px-6 py-4 border-t shrink-0" style="background: var(--bg-elevated); border-color: var(--border-subtle);">
              <ng-content select="[drawer-footer]"></ng-content>
            </footer>
        }
      </div>
    }
  `,
    host: {
        // Si necesitas manejar escape key: 
        '(window:keydown.escape)': 'closeOnEscape($event)',
    }
})
export class DrawerComponent {
    // Inputs
    readonly isOpen = input.required<boolean>();
    readonly title = input.required<string>();
    readonly icon = input<string>();
    readonly hasFooter = input<boolean>(false);

    // Outputs
    readonly closed = output<void>();

    // ElementRefs for GSAP
    private backdropEl = viewChild<ElementRef<HTMLElement>>('backdrop');
    private panelEl = viewChild<ElementRef<HTMLElement>>('panel');

    private gsapService = inject(GsapAnimationsService);

    // A11y ID
    readonly titleId = `drawer-title-${Math.random().toString(36).substring(2, 9)}`;

    constructor() {
        // Escuchar el cambio a isOpen()
        effect(() => {
            const open = this.isOpen();
            const backdrop = this.backdropEl();
            const panel = this.panelEl();

            if (open && backdrop && panel) {
                // Ejecutar animación de entrada inmediatamente
                this.gsapService.animateDrawerEnter(backdrop.nativeElement, panel.nativeElement);
                // Prevenir scroll en el body
                document.body.style.overflow = 'hidden';
            }
        });
    }

    close() {
        this.executeCloseAnimation();
    }

    closeOnEscape(event: Event) {
        if (this.isOpen()) {
            this.executeCloseAnimation();
        }
    }

    private executeCloseAnimation() {
        const backdrop = this.backdropEl();
        const panel = this.panelEl();

        if (backdrop && panel) {
            // Restore scroll
            document.body.style.overflow = '';

            // Animate out, then emit closed
            this.gsapService.animateDrawerLeave(
                backdrop.nativeElement,
                panel.nativeElement,
                () => {
                    this.closed.emit();
                }
            );
        } else {
            document.body.style.overflow = '';
            this.closed.emit();
        }
    }
}
