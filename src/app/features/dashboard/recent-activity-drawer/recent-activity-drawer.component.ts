import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-recent-activity-drawer',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonBlockComponent, DrawerFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-form [hasFooter]="false">
      <div class="flex flex-col gap-6">
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
                <li
                  class="flex items-start gap-3 py-3 border-b last:border-b-0 border-border-subtle"
                >
                  <app-skeleton-block
                    variant="circle"
                    width="32px"
                    height="32px"
                    class="mt-1 shrink-0"
                  />
                  <div class="flex-1 min-w-0 flex flex-col gap-1.5 mt-1">
                    <div class="flex items-center justify-between gap-2">
                      <app-skeleton-block variant="text" width="60%" height="14px" />
                      <app-skeleton-block
                        variant="text"
                        width="40px"
                        height="12px"
                        class="shrink-0"
                      />
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
                  [class.cursor-pointer]="isClickable(item)"
                  [class.hover:bg-surface]="isClickable(item)"
                  (click)="handleItemClick(item)"
                >
                  <div
                    class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-1"
                    [style.background]="item.iconBg"
                  >
                    <app-icon [name]="item.icon" [size]="14" [style.color]="item.iconColor" />
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div class="flex items-center justify-between gap-2">
                      <p class="m-0 text-sm font-medium text-text-primary truncate">
                        {{ item.title }}
                      </p>
                      <span class="shrink-0 text-xs text-text-muted whitespace-nowrap">
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
    </app-drawer-form>
  `,
  styles: [
    `
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
    `,
  ],
})
export class RecentActivityDrawerComponent implements OnInit {
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  readonly activities = signal<any[]>([]);
  readonly loading = signal(true);

  /** Cache de `item.id` -> `students.id` resuelto (o `null` si la fila ya no existe). */
  private readonly resolvedStudentIds = signal<Map<string, number | null>>(new Map());

  async ngOnInit() {
    this.loading.set(true);
    try {
      const data = await this.dashboardFacade.fetchActivityHistory(50);
      this.activities.set(data);
      await this.resolveStudentLinkedItems(data);
    } catch (err) {
      console.error('Error fetching activity history:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Resuelve por adelantado el `students.id` de cada item de entidad alumno, para que
   * `isClickable()` pueda distinguir sincrónicamente entre "el alumno sigue existiendo"
   * y "la fila fue eliminada" (cascade delete) sin dar una afordancia de link falsa.
   */
  private async resolveStudentLinkedItems(items: any[]): Promise<void> {
    const candidates = items.filter(
      (item) =>
        item.action !== 'DELETE' &&
        RecentActivityDrawerComponent.STUDENT_LINKED_ENTITIES.includes(item.entity) &&
        item.entityId,
    );
    if (candidates.length === 0) return;

    const resolved = await Promise.all(
      candidates.map((item) =>
        this.dashboardFacade
          .resolveStudentIdForActivity(item.entity, item.entityId)
          .then((studentId) => [item.id, studentId] as const),
      ),
    );

    const map = new Map(this.resolvedStudentIds());
    for (const [itemId, studentId] of resolved) {
      map.set(itemId, studentId);
    }
    this.resolvedStudentIds.set(map);
  }

  /** Entidades cuyo `entity_id` requiere resolverse a `students.id` (no es directo). */
  private static readonly STUDENT_LINKED_ENTITIES = ['enrollments', 'students', 'class_b_sessions'];

  /** Rutas fijas que no dependen de resolver un `students.id`. */
  private getStaticTargetPath(item: any): string | null {
    if (item.action === 'DELETE') return null;

    const role = this.auth.currentUser()?.role === 'secretaria' ? 'secretaria' : 'admin';

    switch (item.entity) {
      case 'payments':
      case 'standalone_course_enrollments':
      case 'special_service_sales':
        return `/app/${role}/pagos`;
      case 'users':
        return role === 'admin' ? `/app/admin/usuarios` : null;
      default:
        return null;
    }
  }

  isClickable(item: any): boolean {
    if (item.action === 'DELETE') return false;
    if (RecentActivityDrawerComponent.STUDENT_LINKED_ENTITIES.includes(item.entity)) {
      return !!this.resolvedStudentIds().get(item.id);
    }
    return this.getStaticTargetPath(item) !== null;
  }

  handleItemClick(item: any) {
    if (!this.isClickable(item)) return;

    const role = this.auth.currentUser()?.role === 'secretaria' ? 'secretaria' : 'admin';

    if (RecentActivityDrawerComponent.STUDENT_LINKED_ENTITIES.includes(item.entity)) {
      const studentId = this.resolvedStudentIds().get(item.id);
      if (!studentId) return;
      this.drawer.close();
      void this.router.navigateByUrl(`/app/${role}/alumnos/${studentId}`);
      return;
    }

    const path = this.getStaticTargetPath(item);
    if (path) {
      this.drawer.close();
      void this.router.navigateByUrl(path);
    }
  }
}
