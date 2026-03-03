import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';

import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * AppComponent — raíz de la aplicación.
 *
 * Solo renderiza el router outlet y el toast global de PrimeNG.
 * El layout (sidebar + topbar) vive en AppShellComponent,
 * que se carga únicamente para rutas protegidas (/app/**).
 *
 * Animaciones del toast vía GSAP (visual-system: prohibido @keyframes).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Toast],
  template: `
    <router-outlet />
    <p-toast
      position="bottom-right"
      [breakpoints]="{ '768px': { width: '100%', right: '0', left: '0' } }"
      [motionOptions]="toastMotionOptions()"
    />
  `,
})
export class AppComponent {
  private readonly gsap = inject(GsapAnimationsService);

  protected readonly toastMotionOptions = computed(() => ({
    name: 'p-toast-message',
    duration: { enter: 250, leave: 180 },
    enterClass: { from: 'toast-gsap-from', active: 'toast-gsap-active', to: 'toast-gsap-to' },
    leaveClass: { from: 'toast-gsap-from', active: 'toast-gsap-active', to: 'toast-gsap-to' },
    onBeforeEnter: (event?: { element: Element }) => {
      if (event?.element) this.gsap.animateToastIn(event.element as HTMLElement);
    },
    onLeave: (event?: { element: Element }) => {
      if (event?.element) this.gsap.animateToastOut(event.element as HTMLElement);
    },
  }));
}
