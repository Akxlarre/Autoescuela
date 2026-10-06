import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { isRouteChange } from '@core/utils/drawer-navigation.utils';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { PressFeedbackDirective } from '@core/directives/press-feedback.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
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
  imports: [
    CommonModule,
    IconComponent,
    BadgeComponent,
    PressFeedbackDirective,
    CardHoverDirective,
    NgComponentOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // En desktop: hermano flex que empuja el contenido (layout-shift)
    // En mobile: fixed por GSAP (override via estilos inline en animación)
    class: 'shrink-0 overflow-visible relative z-30',
    style: 'width: 0px; display: none; box-sizing: border-box;',
  },
  template: `
    <!-- Backdrop (solo mobile, controlado por GSAP) -->
    <div
      #backdropEl
      data-drawer-backdrop
      class="absolute inset-0 bg-black/50 z-0"
      style="opacity: 0; display: none;"
      (click)="close()"
      aria-hidden="true"
    ></div>

    <!-- Panel principal -->
    <div
      #panelEl
      data-drawer-panel
      role="dialog"
      [attr.aria-label]="title()"
      class="relative z-10 flex flex-col w-full h-full bg-base rounded-tl-2xl lg:rounded-tr-2xl lg:border-t lg:border-x border-border-subtle overflow-hidden"
      style="min-height: 0; will-change: transform;"
    >
      <!-- Header -->
      <header
        class="bento-card flex-row! items-center justify-between px-4! py-3! shrink-0 mx-4 mt-4 mb-2 z-20 gap-4"
        appCardHover
      >
        <!-- LADO IZQUIERDO: Navegación e Identidad -->
        <div class="flex items-center min-w-0 flex-1">
          <!-- Botón Volver (Movido a la izquierda, posición UX estándar) -->
          @if (canGoBack()) {
            <button
              appPressFeedback
              (click)="back()"
              class="flex items-center justify-center gap-1.5 px-2.5 py-1.5 mr-3 rounded-lg border-none bg-transparent cursor-pointer transition-colors text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-subtle shrink-0"
              aria-label="Volver"
              data-llm-action="drawer-back"
            >
              <app-icon name="arrow-left" [size]="16" />
              <span class="hidden md:inline">Volver</span>
            </button>
            <div
              class="w-px h-5 mr-3 shrink-0"
              style="background-color: var(--border-subtle);"
            ></div>
          }

          @if (icon()) {
            <div
              class="flex items-center justify-center rounded-lg w-8 h-8 shrink-0 mr-3"
              style="background: var(--color-primary-tint); color: var(--color-primary);"
            >
              <app-icon [name]="icon()!" [size]="18" />
            </div>
          }
          <h2 class="m-0 text-base font-semibold truncate" style="color: var(--text-primary);">
            {{ title() }}
          </h2>
          @if (badge()) {
            <app-badge variant="brand" class="ml-3 shrink-0">{{ badge() }}</app-badge>
          }
        </div>

        <!-- LADO DERECHO: Acciones y Cerrar -->
        <div class="flex items-center shrink-0">
          <!-- Acciones Dinámicas -->
          @if (actions().length > 0) {
            <div class="flex items-center gap-1 mr-3">
              @for (action of actions(); track action.label) {
                <button
                  appPressFeedback
                  (click)="action.callback()"
                  class="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors text-sm font-medium text-text-muted hover:text-text-primary hover:bg-subtle"
                  [attr.data-llm-action]="action.llmAction"
                >
                  <app-icon [name]="action.icon" [size]="16" />
                  <span class="hidden sm:inline">{{ action.label }}</span>
                </button>
              }
            </div>

            <!-- Separador visual antes de cerrar -->
            <div
              class="w-px h-5 mr-3 shrink-0"
              style="background-color: var(--border-subtle);"
            ></div>
          }

          <!-- Botón Cerrar -->
          <button
            appPressFeedback
            (click)="close()"
            class="flex items-center justify-center w-8 h-8 rounded-full border-none bg-transparent cursor-pointer transition-colors text-text-muted hover:text-text-primary hover:bg-subtle shrink-0"
            aria-label="Cerrar panel"
          >
            <app-icon name="x" [size]="20" />
          </button>
        </div>
      </header>

      <!-- Body Dinámico -->
      <div
        class="flex-1 overflow-y-auto mr-1 lg:mr-2 mb-2 pl-4 pr-3 lg:pr-2 py-2 box-border flex flex-col"
      >
        @if (component()) {
          <!-- fix-295-m: renderKey cambia cuando el drawer se reabre a mitad del cierre; al
               cambiar, el contenido se destruye y se crea de nuevo aunque sea el mismo
               componente (si no, se reutilizaba la instancia que se estaba cerrando). -->
          @for (key of [renderKey()]; track key) {
            <ng-container *ngComponentOutlet="component()!" />
          }
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
  private readonly router = inject(Router);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly isOpen = this.layoutDrawer.isOpen;
  readonly component = this.layoutDrawer.component;
  readonly title = this.layoutDrawer.title;
  readonly icon = this.layoutDrawer.icon;
  readonly actions = this.layoutDrawer.actions;
  readonly badge = this.layoutDrawer.badge;
  readonly canGoBack = this.layoutDrawer.canGoBack;
  readonly width = this.layoutDrawer.width;

  private isCurrentlyVisible = false;

  /** Hay una animación de salida corriendo: el contenido todavía no se destruyó. */
  private leaving = false;
  /** Invalida el final de una salida que quedó obsoleta porque el drawer se reabrió. */
  private readonly leaveGuard = createRequestGuard();
  protected readonly renderKey = signal(0);

  constructor() {
    // hotfix-061-b: al ir a otra pantalla el drawer se cierra (antes quedaba abierto encima de
    // la pantalla nueva). En NavigationStart, no en NavigationEnd: una página que abre un drawer
    // al cargar lo abre después de este evento y no lo ve cerrarse.
    this.router.events
      .pipe(
        filter((e): e is NavigationStart => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        if (this.isOpen() && isRouteChange(this.router.url, e.url)) this.layoutDrawer.close();
      });

    effect(() => {
      const open = this.isOpen();

      if (open && !this.isCurrentlyVisible) {
        this.isCurrentlyVisible = true;

        // fix-295-m: se reabrió antes de terminar de cerrarse. Sin esto, la salida seguía y al
        // terminar ocultaba el host y limpiaba el contenido recién abierto.
        if (this.leaving) {
          this.leaving = false;
          this.leaveGuard.next();
          this.gsapService.cancelLayoutDrawerLeave();
          this.renderKey.update((key) => key + 1);
        }

        this.cdr.markForCheck();

        // Un tick para que Angular procese el NgComponentOutlet antes de animar
        setTimeout(() => {
          const backdropEl = this.el.nativeElement.querySelector(
            '[data-drawer-backdrop]',
          ) as HTMLElement;
          this.gsapService.animateLayoutDrawerEnter(
            this.el.nativeElement,
            backdropEl ?? null,
            this.width(),
          );
        }, 0);
      } else if (!open && this.isCurrentlyVisible) {
        this.isCurrentlyVisible = false;
        this.leaving = true;
        const leaveToken = this.leaveGuard.next();
        const backdropEl = this.el.nativeElement.querySelector(
          '[data-drawer-backdrop]',
        ) as HTMLElement;
        this.gsapService.animateLayoutDrawerLeave(this.el.nativeElement, backdropEl ?? null, () => {
          // Una salida que quedó obsoleta (el drawer se reabrió) no destruye nada.
          if (!this.leaveGuard.isCurrent(leaveToken)) return;
          this.leaving = false;
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

  /**
   * fix-317-m: el tamaño del panel se decidía solo al abrirlo. Si la ventana cambia con el panel
   * abierto, se vuelve a aplicar el que corresponde (45 % en escritorio, pantalla completa en
   * móvil); si no, al achicar la ventana el panel quedaba más ancho que ella y la X fuera de vista.
   */
  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (!this.isCurrentlyVisible || this.leaving) return;
    const backdropEl = this.el.nativeElement.querySelector(
      '[data-drawer-backdrop]',
    ) as HTMLElement | null;
    this.gsapService.syncLayoutDrawerToViewport(this.el.nativeElement, backdropEl, this.width());
  }

  back(): void {
    this.layoutDrawer.back();
  }

  /** La X y el fondo: el componente abierto puede pedir confirmación antes (fix-310-m). */
  /**
   * hotfix-061-b: Escape cierra el drawer como la X (respeta la pregunta de "¿descartar
   * cambios?"). No actúa si otro control ya atendió la tecla — los selects y datepickers de
   * PrimeNG con la lista abierta la marcan con preventDefault — ni con el modal de confirmación
   * abierto encima.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.isOpen() || event.defaultPrevented || this.confirmModal.isOpen()) return;
    this.close();
  }

  close(): void {
    void this.layoutDrawer.requestClose();
  }
}
