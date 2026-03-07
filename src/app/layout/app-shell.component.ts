import { Component, ChangeDetectionStrategy, inject, effect } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { LayoutService } from "@core/services/ui/layout.service";
import { SearchPanelFacadeService } from "@core/services/ui/search-panel.service";
import { SearchPanelComponent } from "@shared/components/search-panel/search-panel.component";
import { AnimateInDirective } from "@core/directives/animate-in.directive";
import { SidebarComponent } from "./sidebar.component";
import { TopbarComponent } from "./topbar.component";
import { LayoutDrawerComponent } from "./layout-drawer.component";
import { LayoutDrawerFacadeService } from "@core/services/ui/layout-drawer.facade.service";

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
  selector: "app-shell",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, SearchPanelComponent, AnimateInDirective, LayoutDrawerComponent],
  template: `
    <!-- Panel de búsqueda — fuera del grid para evitar que overflow:hidden lo recorte -->
    @if (search.isOpen()) {
      <app-search-panel
        appAnimateIn
        class="search-panel-overlay"
        (closed)="search.close()"
      />
    }

    <!-- Backdrop mobile drawer -->
    @if (layout.sidebarOpen()) {
      <div
        #backdropEl
        class="fixed inset-0 z-[49] cursor-pointer bg-[var(--overlay-backdrop)] lg:hidden"
        role="presentation"
        aria-hidden="true"
        data-llm-action="close-mobile-sidebar"
        (click)="layout.closeSidebar()"
      ></div>
    }

    <div
      class="shell-container grid h-[100dvh] grid-cols-1 overflow-hidden bg-base lg:grid-cols-[auto_1fr]"
    >
      <!-- Sidebar -->
      <app-sidebar
        #sidebarEl
        class="fixed inset-y-0 start-0 z-50 w-[240px] max-h-[100dvh] -translate-x-full transition-transform duration-normal ease-standard lg:static lg:translate-x-0"
        [class.translate-x-0]="layout.sidebarOpen()"
      />

      <!-- Main Column: topbar + (content area + drawer) -->
      <div class="flex flex-col min-w-0 bg-[var(--bg-canvas)] overflow-hidden">
        <!-- Topbar spans full width of the main column -->
        <app-topbar />

        <!-- Shifting container for main content and drawer -->
        <div class="flex flex-1 min-w-0 overflow-hidden">
          <main
            class="shell-content flex-1 overflow-y-auto p-6"
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

  constructor() {
    // Premium Feel: Si abrimos el layout drawer global y estamos en pantallas
    // algo ajustadas (<= 1280px), colapsamos el Sidebar para cederle espacio al drawer.
    effect(() => {
      const isDrawerOpen = this.layoutDrawer.isOpen();
      if (isDrawerOpen && window.innerWidth <= 1280) {
        this.layout.closeSidebar();
      }
    });
  }
}
