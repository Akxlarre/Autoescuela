import { Injectable, inject, computed } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, NavigationEnd } from "@angular/router";
import { filter, map } from "rxjs";
import { MenuItem } from "primeng/api";
import { MenuConfigService } from "@core/services/menu-config.service";

export interface BreadcrumbState {
  home: MenuItem;
  items: MenuItem[];
}

/**
 * BreadcrumbService - Deriva el breadcrumb del menú y la ruta actual.
 *
 * Fuente única de verdad: MenuConfigService.
 * Soporta menús planos y jerárquicos (con `item.items`).
 *
 * Reglas:
 * - Último item del trail: sin `routerLink` (página activa)
 * - Items intermedios (grupos): con `routerLink` al primer item del grupo
 * - Si la URL activa es la ruta home, el trail queda vacío
 */
@Injectable({
  providedIn: "root",
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
    this.buildFromMenu(this._url(), this.menuConfig.menuItems()),
  );

  // ── Helpers puros (sin efectos secundarios) ─────────────────────────────────

  private resolveLink(routerLink: MenuItem["routerLink"]): string | undefined {
    if (typeof routerLink === "string") return routerLink;
    if (Array.isArray(routerLink)) return routerLink[0];
    return undefined;
  }

  private matchesUrl(url: string, link: string): boolean {
    return (
      url === link || url.startsWith(link + "/") || url.startsWith(link + "?")
    );
  }

  private buildFromMenu(url: string, menu: MenuItem[]): BreadcrumbState {
    const home: MenuItem = {
      icon: "pi pi-home",
      label: "Inicio",
      routerLink: "/",
    };
    const homeLink = this.resolveLink(home.routerLink);

    for (const entry of menu) {
      // ── Menú jerárquico: entry es un grupo con sub-items ──────────────────
      if (entry.items?.length) {
        for (const item of entry.items) {
          const link = this.resolveLink(item.routerLink);
          if (!link || !this.matchesUrl(url, link)) continue;

          const firstLink = this.resolveLink(entry.items[0].routerLink);
          return {
            home,
            items: [
              ...(entry.label
                ? [{ label: entry.label, routerLink: firstLink ?? link }]
                : []),
              { label: item.label ?? "" },
            ],
          };
        }
        continue;
      }

      // ── Menú plano: entry es un item de navegación directo ────────────────
      const link = this.resolveLink(entry.routerLink);
      if (!link || !this.matchesUrl(url, link)) continue;

      // Si coincide con la ruta home, no hay trail
      if (homeLink && this.matchesUrl(link, homeLink))
        return { home, items: [] };

      return { home, items: [{ label: entry.label ?? "" }] };
    }

    return { home, items: [] };
  }
}
