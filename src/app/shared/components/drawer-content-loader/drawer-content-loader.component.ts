import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
  ChangeDetectorRef,
  afterNextRender,
  effect,
  signal,
  inject,
  contentChild,
  TemplateRef,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * DrawerContentLoaderComponent
 *
 * Wrapper estandarizado para implementar el "Premium Drawer Pattern".
 * 1. Muestra un esqueleto (vía <ng-template #skeletons>) inmediatamente.
 * 2. Espera 350ms (para que la animación CSS/GSAP del Drawer slide-in no sufra stuttering).
 * 3. Destruye los skeletons y renderiza el contenido real (vía <ng-template #content>).
 * 4. Aplica automáticamente la animación en cascada (gsap.animateBentoGrid) a los hijos directos
 *    del contenido, usando afterNextRender para garantizar que el DOM esté listo.
 */
@Component({
  selector: 'app-drawer-content-loader',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-full',
  },
  template: `
    @if (!contentVisible()) {
      <ng-container *ngTemplateOutlet="skeletonsTpl() || null" />
    } @else {
      <!-- Contenedor animable por GSAP -->
      <div class="h-full flex flex-col w-full" #tabContent>
        <ng-container *ngTemplateOutlet="contentTpl() || null" />
      </div>
    }
  `,
})
export class DrawerContentLoaderComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly injector = inject(Injector);

  readonly skeletonsTpl = contentChild<TemplateRef<unknown>>('skeletons');
  readonly contentTpl = contentChild<TemplateRef<unknown>>('content');

  private readonly tabContent = viewChild<ElementRef>('tabContent');
  readonly contentVisible = signal(false);

  constructor() {
    afterNextRender(() => {
      // 350ms: permite que el slide-in del LayoutDrawer complete antes de revelar contenido.
      // Elimina stuttering visual cuando ambas animaciones compiten por el frame.
      setTimeout(() => {
        this.contentVisible.set(true);
        this.cdr.detectChanges();

        // afterNextRender con injector: garantiza que el DOM del ng-template #content
        // está completamente insertado antes de disparar la animación GSAP.
        // Reemplaza el segundo setTimeout(50) frágil anterior.
        afterNextRender(
          () => {
            const el = this.tabContent()?.nativeElement;
            if (el) {
              this.gsap.animateBentoGrid(el);
            }
          },
          { injector: this.injector },
        );
      }, 350);
    });
  }
}
