import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

@Component({
  selector: 'app-recent-activity-drawer',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 h-full flex flex-col gap-6">
      <div class="flex items-center gap-2">
        <app-icon name="activity" [size]="20" class="text-brand" />
        <h2 class="m-0 font-semibold text-lg text-text-primary">Actividad Reciente</h2>
      </div>

      <p class="text-sm text-text-secondary m-0">
        Historial de los últimos 50 movimientos registrados en el sistema.
      </p>

      @if (loading()) {
        <div class="flex-1 pr-2">
          <ul class="m-0 p-0 list-none flex flex-col gap-1">
            @for (_ of [1, 2, 3, 4, 5, 6]; track $index) {
              <li class="flex items-start gap-3 py-3 border-b last:border-b-0 border-border-subtle">
                <app-skeleton-block variant="circle" width="32px" height="32px" class="mt-1 shrink-0" />
                <div class="flex-1 min-w-0 flex flex-col gap-1.5 mt-1">
                  <div class="flex items-center justify-between gap-2">
                    <app-skeleton-block variant="text" width="60%" height="14px" />
                    <app-skeleton-block variant="text" width="40px" height="12px" class="shrink-0" />
                  </div>
                  <app-skeleton-block variant="text" width="90%" height="12px" />
                </div>
              </li>
            }
          </ul>
        </div>
      } @else {
        <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <ul class="m-0 p-0 list-none flex flex-col gap-1">
            @for (item of activities(); track item.id) {
              <li 
                class="flex items-start gap-3 py-3 border-b last:border-b-0 border-border-subtle transition-colors"
                [class.cursor-pointer]="item.action !== 'DELETE'"
                [class.hover:bg-surface-hover]="item.action !== 'DELETE'"
                (click)="handleItemClick(item)"
              >
                <div
                  class="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-1"
                  [style.background]="item.iconBg"
                >
                  <app-icon [name]="item.icon" [size]="14" [style.color]="item.iconColor" />
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div class="flex items-center justify-between gap-2">
                    <p class="m-0 text-sm font-medium text-text-primary truncate">
                      {{ item.title }}
                    </p>
                    <span class="flex-shrink-0 text-xs text-text-muted whitespace-nowrap">
                      {{ item.time }}
                    </span>
                  </div>
                  <p class="m-0 text-xs text-text-secondary line-clamp-2">
                    {{ item.description }}
                  </p>
                </div>
              </li>
            }
          </ul>

          @if (activities().length === 0) {
            <div class="py-8 text-center text-text-muted text-sm">
              No hay actividad reciente para mostrar.
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 4px;
    }
  `]
})
export class RecentActivityDrawerComponent implements OnInit {
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  readonly activities = signal<any[]>([]);
  readonly loading = signal(true);

  async ngOnInit() {
    this.loading.set(true);
    try {
      const data = await this.dashboardFacade.fetchActivityHistory(50);
      this.activities.set(data);
    } catch (err) {
      console.error('Error fetching activity history:', err);
    } finally {
      this.loading.set(false);
    }
  }

  handleItemClick(item: any) {
    if (item.action === 'DELETE') return;

    const role = this.auth.currentUser()?.role === 'secretaria' ? 'secretaria' : 'admin';
    let path = '';

    switch (item.entity) {
      case 'enrollments':
      case 'students':
      case 'class_b_sessions':
        if (item.entityId) {
          path = `/app/${role}/alumno-detalle/${item.entityId}`;
        }
        break;
      case 'payments':
      case 'standalone_course_enrollments':
      case 'special_service_sales':
        path = `/app/${role}/pagos`;
        break;
      case 'users':
        if (role === 'admin') path = `/app/admin/configuracion`;
        break;
    }

    if (path) {
      this.drawer.close();
      void this.router.navigateByUrl(path);
    }
  }
}
