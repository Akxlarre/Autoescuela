import { Injectable, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { MenuConfigService, NavGroup } from '@core/services/auth/menu-config.service';

export interface BreadcrumbState {
  home: MenuItem;
  items: MenuItem[];
}

/**
 * BreadcrumbService - Deriva el breadcrumb del menú de grupos y la ruta actual.
 *
 * Fuente única de verdad: MenuConfigService (NavGroup[]).
 * Reacciona automáticamente al cambio de rol.
 *
 * Reglas:
 * - Último item del trail: sin `routerLink` (página activa)
 * - Ítem previo: nombre del grupo con `routerLink` al primer item de ese grupo
 * - Si no hay coincidencia, trail vacío
 */
@Injectable({
  providedIn: 'root',
})
export class BreadcrumbService {
  private readonly router = inject(Router);
  private readonly menuConfig = inject(MenuConfigService);

  private readonly _url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly breadcrumb = computed<BreadcrumbState>(() =>
    this.buildFromGroups(this._url(), this.menuConfig.menuItems()),
  );

  // ── Helpers puros (sin efectos secundarios) ─────────────────────────────────

  private matchesUrl(url: string, link: string): boolean {
    return url === link || url.startsWith(link + '/') || url.startsWith(link + '?');
  }

  private buildFromGroups(url: string, groups: NavGroup[]): BreadcrumbState {
    const home: MenuItem = {
      icon: 'pi pi-home',
      label: 'Inicio',
      routerLink: '/',
    };

    for (const group of groups) {
      for (const item of group.items) {
        if (!this.matchesUrl(url, item.routerLink)) continue;

        return {
          home,
          items: [
            { label: group.group, routerLink: group.items[0].routerLink },
            { label: item.label },
          ],
        };
      }
    }

    return { home, items: [] };
  }
}
