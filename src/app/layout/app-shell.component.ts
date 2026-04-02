import { Component, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LayoutService } from '@core/services/ui/layout.service';
import { SearchPanelFacadeService } from '@core/services/ui/search-panel.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { SearchPanelComponent } from '@shared/components/search-panel/search-panel.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { LayoutDrawerComponent } from './layout-drawer.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { DmsViewerModalComponent } from '@shared/components/dms-viewer-modal/dms-viewer-modal.component';

/**
 * AppShellComponent — layout principal de rutas protegidas.
 *
 * Estructura: sidebar fijo + área de contenido (topbar + router-outlet).
 * En mobile el sidebar actúa como drawer animado con GSAP.
 *
 * La animación de entrada del contenido la maneja la View Transitions API
 * (vt-page-in en _view-transitions.scss). No usar GSAP animatePageEnter aquí
 * para evitar conflictos que dejen el contenido invisible.
 *
 * Uso en app.routes.ts:
 * ```ts
 * { path: 'app', loadComponent: () => import('./layout/app-shell.component')
 *     .then(m => m.AppShellComponent), children: [...] }
 * ```
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    SearchPanelComponent,
    AnimateInDirective,
    LayoutDrawerComponent,
    IconComponent,
    DmsViewerModalComponent,
  ],
  template: `
    <!-- Panel de búsqueda — fuera del grid para evitar que overflow:hidden lo recorte -->
    @if (search.isOpen()) {
      <app-search-panel appAnimateIn class="search-panel-overlay" (closed)="search.close()" />
    }

    <!-- Visor de documentos DMS -->
    @if (dmsViewer.isOpen()) {
      <app-dms-viewer-modal [doc]="dmsViewer.currentDoc()!" (closed)="dmsViewer.close()" />
    }

    <!-- Modal de confirmación global (usado por guards y servicios imperativos) -->
    @if (confirmModal.isOpen()) {
      <div
        class="fixed inset-0 z-70 flex items-center justify-center bg-(--overlay-backdrop)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div class="surface-glass rounded-2xl p-8 max-w-sm w-full mx-4 space-y-6">
          <div class="flex items-start gap-4">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              [class.bg-state-warning-bg]="confirmModal.config()?.severity === 'warn'"
              [class.bg-state-error-bg]="confirmModal.config()?.severity === 'danger'"
              [class.bg-brand-muted]="
                confirmModal.config()?.severity === 'secondary' || !confirmModal.config()?.severity
              "
            >
              <app-icon
                [name]="
                  confirmModal.config()?.severity === 'danger' ? 'circle-alert' : 'alert-triangle'
                "
                [size]="20"
                [class.text-state-warning]="confirmModal.config()?.severity === 'warn'"
                [class.text-state-error]="confirmModal.config()?.severity === 'danger'"
                [class.text-brand]="
                  confirmModal.config()?.severity === 'secondary' ||
                  !confirmModal.config()?.severity
                "
              />
            </div>
            <div class="space-y-1">
              <h3
                id="confirm-modal-title"
                class="font-bold text-text-primary text-lg leading-tight"
              >
                {{ confirmModal.config()?.title }}
              </h3>
              <p class="text-sm text-text-secondary leading-relaxed">
                {{ confirmModal.config()?.message }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3 justify-end">
            <button
              type="button"
              class="cursor-pointer inline-flex items-center justify-center rounded-(--btn-secondary-radius) border border-(--btn-secondary-border) bg-(--btn-secondary-bg) px-5 py-2 text-sm font-semibold text-(--btn-secondary-text) transition-colors hover:bg-(--btn-secondary-bg-hover)"
              (click)="confirmModal.cancel()"
              data-llm-action="confirm-modal-cancel"
            >
              {{ confirmModal.config()?.cancelLabel }}
            </button>
            <button
              type="button"
              class="cursor-pointer inline-flex items-center justify-center rounded-(--btn-primary-radius) border-none bg-(--btn-primary-bg) px-5 py-2 text-sm font-semibold text-(--btn-primary-text) shadow-(--btn-primary-shadow) transition-colors hover:bg-(--btn-primary-bg-hover) hover:shadow-(--btn-primary-shadow-hover) active:scale-(--btn-press-scale-value)"
              (click)="confirmModal.accept()"
              data-llm-action="confirm-modal-accept"
            >
              {{ confirmModal.config()?.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Backdrop mobile drawer -->
    @if (layout.sidebarOpen()) {
      <div
        #backdropEl
        class="fixed inset-0 z-49 cursor-pointer bg-(--overlay-backdrop) lg:hidden"
        role="presentation"
        aria-hidden="true"
        data-llm-action="close-mobile-sidebar"
        (click)="layout.closeSidebar()"
      ></div>
    }

    <div
      class="shell-container flex sm:grid h-dvh w-full max-w-[100vw] overflow-hidden bg-base sm:grid-cols-1 lg:grid-cols-[auto_1fr]"
    >
      <!-- Sidebar -->
      <app-sidebar
        #sidebarEl
        class="fixed inset-y-0 left-0 z-50 w-60 max-w-[80vw] max-h-dvh -translate-x-full transition-transform duration-normal ease-standard lg:static lg:translate-x-0"
        [class.translate-x-0]="layout.sidebarOpen()"
      />

      <!-- Main Column: topbar + (content area + drawer) -->
      <div
        class="flex flex-col flex-1 w-full max-w-[100vw] lg:max-w-none min-w-0 bg-(--bg-canvas) overflow-hidden"
      >
        <!-- Topbar spans full width of the main column -->
        <app-topbar />

        <!-- Shifting container for main content and drawer -->
        <div class="flex flex-1 min-w-0 w-full overflow-hidden relative">
          <main
            class="shell-content flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 w-full max-w-full"
            style="container-type: inline-size; container-name: layoutmain;"
            role="main"
            tabindex="-1"
          >
            <router-outlet />
          </main>

          <!-- Layout-shifting Drawer -->
          <app-layout-drawer />
        </div>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly search = inject(SearchPanelFacadeService);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  protected readonly confirmModal = inject(ConfirmModalService);
  protected readonly dmsViewer = inject(DmsViewerService);
  private readonly notificationsFacade = inject(NotificationsFacade);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);

  constructor() {
    // Premium Feel: Si abrimos el layout drawer global y estamos en pantallas
    // algo ajustadas (<= 1280px), colapsamos el Sidebar para cederle espacio al drawer.
    effect(() => {
      const isDrawerOpen = this.layoutDrawer.isOpen();
      if (isDrawerOpen && window.innerWidth <= 1280) {
        this.layout.closeSidebar();
      }
    });

    // Inicializar notificaciones persistentes + Realtime
    this.notificationsFacade.initialize();

    // Dispose al logout
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this.notificationsFacade.dispose();
      }
    });

    // Cargar sedes una sola vez cuando el usuario admin se autentica
    effect(() => {
      if (this.auth.currentUser()?.role === 'admin') {
        this.branchFacade.loadBranches();
      }
    });
  }
}
