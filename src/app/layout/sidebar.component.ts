import {
  Component,
  ChangeDetectionStrategy,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthFacade } from '@core/facades/auth.facade';
import { ThemeService } from '@core/services/ui/theme.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { MenuConfigService } from '@core/services/auth/menu-config.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { Button } from 'primeng/button';
import { Avatar } from 'primeng/avatar';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * SidebarComponent — navegación lateral principal.
 *
 * Smart component: inyecta AuthFacade, ThemeService, LayoutService y MenuConfigService.
 * Los nav items se leen desde MenuConfigService agrupados por NavGroup — edita ese
 * servicio para añadir rutas. El rol activo (RoleService vía MenuConfigService)
 * determina qué grupos se renderizan.
 *
 * GSAP: addPillHovers() se aplica en afterNextRender para feedback de hover/press.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Button, Avatar, IconComponent],
  template: `
    <nav
      #sidebarEl
      class="flex h-full min-h-0 w-[240px] flex-col border-r border-border-subtle bg-surface py-4 shadow-[var(--shadow-layout-sidebar)]"
      aria-label="Navegación principal"
    >
      <!-- Brand -->
      <div class="px-5 pb-6 pt-2 shrink-0">
        <span class="font-display text-lg font-bold text-brand">{{ appName }}</span>
      </div>

      <!-- Nav groups -->
      <div class="flex flex-1 flex-col overflow-y-auto min-h-0 px-3">
        @for (group of menuConfig.menuItems(); track group.group) {
          <div class="mb-4">
            <p
              class="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1"
              style="color: var(--text-muted)"
            >
              {{ group.group }}
            </p>
            @for (item of group.items; track item.routerLink) {
              <a
                [routerLink]="item.routerLink"
                routerLinkActive="!bg-brand-muted !text-brand"
                [routerLinkActiveOptions]="{ exact: true }"
                class="flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium text-text-secondary no-underline transition-[var(--transition-color)] hover:bg-brand-muted hover:text-brand"
                [attr.aria-label]="item.label"
                [attr.data-llm-nav]="item.routerLink"
              >
                <app-icon [name]="item.icon" [size]="16" />
                <span>{{ item.label }}</span>
              </a>
            }
          </div>
        }
      </div>

      <!-- Footer: theme toggle + usuario -->
      <div class="flex items-center gap-2 border-t border-border-subtle p-4 shrink-0">
        <p-button
          [text]="true"
          [rounded]="true"
          severity="secondary"
          size="small"
          [icon]="theme.darkMode() ? 'pi pi-sun' : 'pi pi-moon'"
          [ariaLabel]="theme.darkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          data-llm-action="toggle-color-mode"
          (onClick)="theme.cycleColorMode($event)"
        />

        @if (auth.currentUser(); as user) {
          <div class="flex flex-1 items-center gap-2 min-w-0">
            <p-avatar [label]="user.initials" shape="circle" size="normal" />
            <div class="flex flex-col min-w-0">
              <span class="truncate text-sm font-medium text-text-primary">{{ user.name }}</span>
              <span class="whitespace-nowrap text-xs text-text-muted">{{ user.role }}</span>
            </div>
          </div>
        }
      </div>
    </nav>
  `,
  styles: [],
})
export class SidebarComponent {
  protected readonly appName = 'Autoescuela';

  protected readonly auth = inject(AuthFacade);
  protected readonly theme = inject(ThemeService);
  protected readonly layout = inject(LayoutService);
  protected readonly menuConfig = inject(MenuConfigService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly sidebarEl = viewChild<ElementRef<HTMLElement>>('sidebarEl');

  constructor() {
    afterNextRender(() => {
      const el = this.sidebarEl()?.nativeElement;
      if (el) this.gsap.addPillHovers(el);
    });
  }
}
