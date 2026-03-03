import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { AuthFacade } from '@core/facades/auth.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { NotificationsService } from '@core/services/infrastructure/notifications.service';
import { SearchPanelService } from '@core/services/ui/search-panel.service';
import { ThemeService } from '@core/services/ui/theme.service';
import { RoleService, UserRole } from '@core/services/auth/role.service';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { ClickOutsideDirective } from '@core/directives/click-outside.directive';
import { SearchShortcutDirective } from '@core/directives/search-shortcut.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { NotificationsPanelComponent } from '@shared/components/notifications-panel/notifications-panel.component';
import { UserPanelComponent } from '@shared/components/user-panel/user-panel.component';
import { Button } from 'primeng/button';

/**
 * TopbarComponent — barra superior de la aplicación.
 *
 * Smart component: inyecta LayoutService, AuthFacade, NotificationsService,
 * SearchPanelService, ThemeService, GsapAnimationsService y RoleService.
 *
 * Responsabilidades de animación:
 * - animateBell() → oscilación pendular (estilo Aladino) al abrir panel de notificaciones
 * - [appAnimateIn] en ambos paneles → fade+slide de entrada
 * - [appClickOutside] en los wrappers → cierre al clic exterior
 * - [appSearchShortcut] en el <header> → Ctrl+K / Cmd+K abre el buscador
 *
 * Selector de rol: visible solo en desarrollo. Se eliminará cuando el login sea real.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    IconComponent,
    AnimateInDirective,
    ClickOutsideDirective,
    SearchShortcutDirective,
    NotificationsPanelComponent,
    UserPanelComponent,
  ],
  template: `
    <header
      appSearchShortcut
      class="sticky top-0 z-10 flex h-[56px] items-center gap-4 border-b border-border-subtle bg-surface px-6 shadow-[var(--shadow-layout-topbar)]"
      role="banner"
    >
      <!-- Hamburger — solo visible en mobile -->
      <p-button
        class="!flex lg:!hidden"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        icon="pi pi-bars"
        ariaLabel="Abrir menú de navegación"
        data-llm-action="toggle-mobile-sidebar"
        (onClick)="layout.toggleSidebar()"
      />

      <!-- Título de sección / breadcrumb -->
      <div class="flex-1 text-sm font-medium text-text-secondary" aria-label="Sección actual">
        <!-- TODO: conectar BreadcrumbService o título de la ruta activa -->
      </div>

      <!-- Acciones de la derecha -->
      <div
        class="toolbar-actions flex items-center gap-1"
        role="toolbar"
        aria-label="Acciones globales"
      >
        <!-- Selector de rol — DEV only, eliminar cuando login sea real -->
        <div
          class="flex items-center gap-1.5 px-2 py-1 rounded-md border mr-2"
          style="border-color: var(--border-subtle)"
          title="Selector de rol (solo en desarrollo)"
        >
          <span
            class="text-[10px] font-semibold uppercase tracking-widest"
            style="color: var(--text-muted)"
            >ROL</span
          >
          <select
            class="text-xs font-semibold bg-transparent border-none outline-none cursor-pointer"
            style="color: var(--ds-brand)"
            [value]="roleService.currentRole()"
            (change)="onRoleChange($event)"
            aria-label="Cambiar rol de desarrollo"
            data-llm-action="dev-switch-role"
          >
            <option value="admin">Admin</option>
            <option value="secretaria">Secretaria</option>
            <option value="instructor">Instructor</option>
            <option value="alumno">Alumno</option>
            <option value="relator">Relator</option>
          </select>
        </div>

        <!-- Búsqueda — wrapper con click-outside -->
        <div
          #searchWrapper
          class="relative"
          appClickOutside
          [clickOutsideEnabled]="search.isOpen()"
          [clickOutsideExclude]="'app-search-panel'"
          (clickOutside)="search.close()"
        >
          <p-button
            [text]="true"
            [rounded]="true"
            [severity]="search.isOpen() ? 'primary' : 'secondary'"
            ariaLabel="Buscar (Ctrl+K)"
            [attr.aria-expanded]="search.isOpen()"
            aria-haspopup="true"
            data-llm-action="open-search-panel"
            (onClick)="openSearch(searchWrapper)"
          >
            <app-icon name="search" [size]="18" />
          </p-button>
        </div>

        <!-- Cambio de tema -->
        <p-button
          [text]="true"
          [rounded]="true"
          severity="secondary"
          size="small"
          [ariaLabel]="theme.darkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          [disabled]="theme.isThemeTransitioning()"
          data-llm-action="toggle-color-mode"
          (onClick)="cycleTheme($event)"
        >
          <app-icon [name]="theme.darkMode() ? 'sun' : 'moon'" [size]="18" />
        </p-button>

        <!-- Notificaciones — wrapper con click-outside y animación Aladino -->
        <div
          #bellWrapper
          class="relative"
          appClickOutside
          [clickOutsideEnabled]="panelOpen()"
          (clickOutside)="panelOpen.set(false)"
        >
          <p-button
            [text]="true"
            [rounded]="true"
            [severity]="panelOpen() ? 'primary' : 'secondary'"
            [ariaLabel]="'Notificaciones — ' + notifications.unreadCount() + ' sin leer'"
            [attr.aria-expanded]="panelOpen()"
            aria-haspopup="true"
            data-llm-action="open-notifications-panel"
            (onClick)="togglePanel()"
          >
            <app-icon name="bell" [size]="18" />
          </p-button>

          @if (notifications.unreadCount() > 0) {
            <span
              class="pointer-events-none absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-center text-[10px] font-bold text-brand-text"
              aria-hidden="true"
            >
              {{ notifications.unreadCount() }}
            </span>
          }

          @if (panelOpen()) {
            <app-notifications-panel
              appAnimateIn
              [notifications]="notifications.panelNotifications()"
              [unreadCount]="notifications.unreadCount()"
              (markRead)="notifications.markAsRead($event)"
              (markAllRead)="notifications.markAllAsRead()"
            />
          }
        </div>

        <!-- Avatar de usuario con panel desplegable -->
        @if (auth.currentUser(); as user) {
          <div
            class="relative"
            appClickOutside
            [clickOutsideEnabled]="userPanelOpen()"
            (clickOutside)="userPanelOpen.set(false)"
          >
            <p-button
              [text]="true"
              [rounded]="true"
              [severity]="userPanelOpen() ? 'primary' : 'secondary'"
              [attr.aria-expanded]="userPanelOpen()"
              [attr.aria-label]="'Perfil de ' + user.name"
              aria-haspopup="menu"
              data-llm-action="open-user-profile-menu"
              (onClick)="userPanelOpen.set(!userPanelOpen())"
            >
              <app-icon name="user" [size]="18" />
            </p-button>

            @if (userPanelOpen()) {
              <app-user-panel
                appAnimateIn
                [user]="user"
                (action)="onUserAction($event)"
                (logout)="onLogout()"
              />
            }
          </div>
        }
      </div>
    </header>
  `,
  styles: [],
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly auth = inject(AuthFacade);
  protected readonly notifications = inject(NotificationsService);
  protected readonly search = inject(SearchPanelService);
  protected readonly theme = inject(ThemeService);
  protected readonly roleService = inject(RoleService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly router = inject(Router);

  protected readonly panelOpen = signal(false);
  protected readonly userPanelOpen = signal(false);

  private readonly bellWrapperRef = viewChild<ElementRef<HTMLElement>>('bellWrapper');

  openSearch(wrapper: HTMLElement): void {
    this.search.toggle(wrapper);
  }

  cycleTheme(event: MouseEvent): void {
    const btnEl = (event.target as HTMLElement).closest?.('button') as HTMLElement | null;
    if (btnEl) this.gsap.animateThemeToggleIcon(btnEl);
    this.theme.cycleColorMode(event);
  }

  togglePanel(): void {
    const opening = !this.panelOpen();

    // Animación Aladino solo al abrir — una campana suena al recibir, no al colgar
    if (opening) {
      const btnEl = this.bellWrapperRef()?.nativeElement?.querySelector<HTMLElement>('button');
      if (btnEl) this.gsap.animateBell(btnEl);
    }

    this.panelOpen.set(opening);
    if (opening) this.userPanelOpen.set(false); // Close user panel if notifications open
  }

  onRoleChange(event: Event): void {
    const role = (event.target as HTMLSelectElement).value as UserRole;
    this.roleService.setRole(role);
    void this.router.navigate(['/app', role, 'dashboard']);
  }

  onUserAction(action: 'profile' | 'settings'): void {
    this.userPanelOpen.set(false);
    // TODO: Navigation to profile or settings
    console.log('[Topbar] User action:', action);
  }

  onLogout(): void {
    this.userPanelOpen.set(false);
    this.auth.logout();
  }
}
