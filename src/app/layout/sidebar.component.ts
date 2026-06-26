import { TooltipModule } from 'primeng/tooltip';
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  computed,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { MenuConfigService } from '@core/services/auth/menu-config.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { canAccessProfessional } from '@core/utils/professional-access.utils';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * SidebarComponent — navegación lateral principal.
 *
 * Smart component: inyecta AuthFacade, BranchFacade, LayoutService y MenuConfigService.
 * Los nav items se leen desde MenuConfigService agrupados por NavGroup.
 *
 * Incluye la mecánica del "Candado de Sede" (locks para cursos profesionales en sedes B2C)
 * y el redireccionamiento interactivo a la conmutación de sede.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav
      #sidebarEl
      class="flex h-full min-h-0 w-60 flex-col border-r border-border-subtle bg-surface py-4 shadow-(--shadow-layout-sidebar)"
      aria-label="Navegación principal"
    >
      <!-- Brand & Active Branch Badge -->
      <div class="px-5 pb-4 pt-2 shrink-0 flex flex-col gap-1.5 border-b border-border-subtle">
        <span class="font-display text-lg font-bold text-brand">{{ appName }}</span>
        <div
          class="flex items-center gap-1.5 text-xs font-semibold text-text-muted bg-subtle px-2.5 py-1 rounded-md w-fit border border-border-subtle"
        >
          <app-icon name="map-pin" [size]="12" class="text-brand" />
          <span class="truncate max-w-37.5">{{ currentSedeLabel() }}</span>
        </div>
      </div>

      <!-- Nav groups -->
      <div class="flex flex-1 flex-col overflow-y-auto min-h-0 px-3 pt-4">
        @for (group of menuConfig.menuItems(); track group.group) {
          <div class="mb-6">
            <p
              class="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1"
              style="color: var(--text-muted)"
            >
              {{ group.group }}
            </p>
            @for (item of group.items; track item.routerLink) {
              <a
                [routerLink]="
                  item.requiresProfessional && !hasProfessional() ? null : item.routerLink
                "
                routerLinkActive="!bg-brand-muted !text-brand"
                [routerLinkActiveOptions]="{ exact: true }"
                class="flex items-center justify-between rounded-md px-4 py-2.5 text-sm font-medium text-text-secondary no-underline transition-(--transition-color) hover:bg-brand-muted hover:text-brand"
                [class.opacity-50]="item.requiresProfessional && !hasProfessional()"
                [attr.aria-label]="
                  item.label +
                  (item.requiresProfessional && !hasProfessional() ? ' (Bloqueado)' : '')
                "
                [attr.data-llm-nav]="item.routerLink"
                (click)="onItemClick($event, item)"
              >
                <div class="flex items-center gap-3">
                  <app-icon [name]="item.icon" [size]="16" />
                  <span>{{ item.label }}</span>
                </div>
                @if (item.requiresProfessional && !hasProfessional()) {
                  <app-icon name="lock" [size]="14" class="text-text-muted" />
                }
              </a>
            }
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
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly layout = inject(LayoutService);
  protected readonly menuConfig = inject(MenuConfigService);
  protected readonly confirmModal = inject(ConfirmModalService);
  protected readonly toast = inject(ToastService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly sidebarEl = viewChild<ElementRef<HTMLElement>>('sidebarEl');

  /**
   * Determina si la sede activa tiene habilitados los cursos profesionales.
   */
  protected readonly hasProfessional = computed(() => {
    const user = this.auth.currentUser();
    // Núcleo testeable (fix-028): honra el grant multi-sede (RF-013) tanto para admin como
    // para secretaria con grant — ambos respetan el selector; sin grant, la sede fija.
    return canAccessProfessional(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      this.branchFacade.branches(),
      user?.canAccessBothBranches,
    );
  });

  /**
   * Obtiene la etiqueta amigable de la sede actual.
   */
  protected readonly currentSedeLabel = computed(() => {
    const role = this.auth.currentUser()?.role;
    if (role === 'admin') {
      return this.branchFacade.selectedBranchLabel();
    } else if (role === 'secretaria') {
      const activeId = this.auth.currentUser()?.branchId;
      if (!activeId) return 'Sede No Asignada';
      return (
        this.branchFacade.branches().find((b) => b.id === activeId)?.name ?? 'Cargando Sede...'
      );
    }
    return 'Autoescuela';
  });

  constructor() {
    afterNextRender(() => {
      const el = this.sidebarEl()?.nativeElement;
      if (el) this.gsap.addPillHovers(el);
    });
  }

  async onItemClick(event: MouseEvent, item: any): Promise<void> {
    if (item.requiresProfessional && !this.hasProfessional()) {
      event.preventDefault();
      event.stopPropagation();

      const role = this.auth.currentUser()?.role;
      if (role === 'secretaria') {
        // Autorización multisede real (RF-013 / spec 0017): el grant del admin.
        const canConmute = this.auth.currentUser()?.canAccessBothBranches ?? false;

        if (!canConmute) {
          await this.confirmModal.confirm({
            title: 'Acceso denegado',
            message:
              'Su cuenta de secretaria no está autorizada para operar en múltiples sedes ni conmutar al portal de Clase Profesional. Contacte a su Administrador.',
            severity: 'danger',
            confirmLabel: 'Entendido',
            cancelLabel: 'Cerrar',
          });
          return;
        }
      }

      // Si es Admin o Secretaria autorizada: sugerir conmutación rápida
      const confirmed = await this.confirmModal.confirm({
        title: 'Módulo de Clase Profesional',
        message:
          'Este módulo requiere conmutar la sucursal activa a "Conductores Chillán" (Clase Profesional). ¿Desea realizar el cambio ahora?',
        severity: 'warn',
        confirmLabel: 'Conmutar Sede',
        cancelLabel: 'Cancelar',
      });

      if (confirmed) {
        const proBranch = this.branchFacade.branches().find((b) => b.hasProfessional);
        if (proBranch) {
          this.branchFacade.selectBranch(proBranch.id);
          this.toast.success(`Cambiado exitosamente a la sede: ${proBranch.name}`);
        } else {
          this.toast.error('No se encontró una sede profesional disponible.');
        }
      }
    } else {
      this.layout.closeSidebar();
    }
  }
}
