import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { AdminInstructorEditarDrawerComponent } from './admin-instructor-editar-drawer.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

@Component({
  selector: 'app-admin-instructor-ver-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LowerCasePipe, IconComponent, StatBoxComponent, SkeletonBlockComponent, DrawerContentLoaderComponent],
  template: `
    @if (facade.selectedInstructor(); as inst) {
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-5">
            <div class="flex justify-center"><app-skeleton-block variant="circle" width="64px" height="64px" /></div>
            <app-skeleton-block variant="text" width="60%" height="20px" />
            <div class="grid grid-cols-2 gap-3">
              <app-skeleton-block variant="text" width="100%" height="60px" />
              <app-skeleton-block variant="text" width="100%" height="60px" />
            </div>
            <app-skeleton-block variant="text" width="100%" height="80px" />
          </div>
        </ng-template>
        <ng-template #content>
      <!-- ── Header con nombre y tipo ────────────────────────────────────── -->
      <div
        class="flex flex-col items-center gap-3 pb-6 mb-6"
        style="border-bottom: 1px solid var(--border-subtle)"
      >
        <div
          class="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold"
          style="background: var(--color-primary-tint); color: var(--color-primary)"
        >
          {{ inst.initials }}
        </div>
        <div class="text-center">
          <p class="text-base font-semibold" style="color: var(--text-primary)">
            {{ inst.nombre }}
          </p>
          <p class="text-sm" style="color: var(--ds-brand)">
            Instructor {{ inst.tipoLabel | lowercase }}
          </p>
        </div>

        <!-- Badge estado -->
        @if (inst.estado === 'activo') {
          <span
            class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style="
              background: color-mix(in srgb, var(--state-success) 12%, transparent);
              color: var(--state-success);
            "
          >
            <app-icon name="check-circle" [size]="12" />
            Activo
          </span>
        } @else {
          <span
            class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
            style="background: var(--bg-elevated); color: var(--text-muted)"
          >
            <app-icon name="circle" [size]="12" />
            Inactivo
          </span>
        }
      </div>

      <!-- ── KPI summary cards ───────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <app-stat-box
          label="Clases activas"
          [value]="inst.activeClassesCount"
          variant="brand"
          [compact]="true"
        />
        <app-stat-box
          label="Licencia"
          [value]="inst.licenseStatusLabel"
          [variant]="inst.licenseStatus === 'valid' ? 'success' : inst.licenseStatus === 'expiring_soon' ? 'warning' : 'error'"
          [compact]="true"
        />
      </div>

      <!-- ── Información Personal ────────────────────────────────────────── -->
      <div class="flex flex-col gap-4 mb-6">
        <h3 class="section-header">Información Personal</h3>

        <div class="detail-row">
          <app-icon name="id-card" [size]="15" />
          <div>
            <p class="detail-label">RUT</p>
            <p class="detail-value">{{ inst.rut }}</p>
          </div>
        </div>

        <div class="detail-row">
          <app-icon name="mail" [size]="15" />
          <div>
            <p class="detail-label">Email</p>
            <a
              class="detail-value"
              [href]="'mailto:' + inst.email"
              style="color: var(--ds-brand); text-decoration: none"
            >
              {{ inst.email }}
            </a>
          </div>
        </div>

        @if (inst.phone) {
          <div class="detail-row">
            <app-icon name="phone" [size]="15" />
            <div>
              <p class="detail-label">Teléfono</p>
              <p class="detail-value">{{ inst.phone }}</p>
            </div>
          </div>
        }

        <div class="detail-row">
          <app-icon name="user-check" [size]="15" />
          <div>
            <p class="detail-label">Tipo</p>
            <p class="detail-value">{{ inst.tipoLabel }}</p>
          </div>
        </div>

        @if (inst.registrationDate) {
          <div class="detail-row">
            <app-icon name="calendar" [size]="15" />
            <div>
              <p class="detail-label">Fecha de registro</p>
              <p class="detail-value">{{ inst.registrationDate }}</p>
            </div>
          </div>
        }
      </div>

      <!-- ── Información de Licencia ─────────────────────────────────────── -->
      <div class="flex flex-col gap-4 mb-6">
        <h3 class="section-header">Información de Licencia</h3>

        @if (inst.licenseNumber) {
          <div class="detail-row">
            <app-icon name="file-check" [size]="15" />
            <div>
              <p class="detail-label">Número de licencia</p>
              <p class="detail-value">{{ inst.licenseNumber }}</p>
            </div>
          </div>
        }

        <div class="detail-row">
          <app-icon name="award" [size]="15" />
          <div>
            <p class="detail-label">Clase</p>
            <p class="detail-value">{{ inst.licenseClass }}</p>
          </div>
        </div>

        @if (inst.licenseExpiry) {
          <div class="detail-row">
            <app-icon name="calendar-x" [size]="15" />
            <div>
              <p class="detail-label">Fecha de vencimiento</p>
              <p class="detail-value">{{ inst.licenseExpiry }}</p>
            </div>
          </div>
        }

        <div class="detail-row">
          <app-icon name="shield-check" [size]="15" />
          <div>
            <p class="detail-label">Estado de validación</p>
            <span [class]="'license-badge license-badge--' + inst.licenseStatus">
              {{ inst.licenseStatusLabel }}
            </span>
          </div>
        </div>
      </div>

      <!-- ── Asignación Actual ────────────────────────────────────────────── -->
      <div class="flex flex-col gap-4 mb-6">
        <h3 class="section-header">Asignación Actual</h3>

        @if (inst.vehiclePlate) {
          <div class="detail-row">
            <app-icon name="car" [size]="15" />
            <div>
              <p class="detail-label">Vehículo</p>
              <p class="detail-value font-semibold">{{ inst.vehiclePlate }}</p>
              <p class="text-xs" style="color: var(--text-muted)">{{ inst.vehicleModel }}</p>
            </div>
          </div>
          @if (inst.vehicleAssignmentDate) {
            <div class="detail-row">
              <app-icon name="calendar-check" [size]="15" />
              <div>
                <p class="detail-label">Fecha de asignación</p>
                <p class="detail-value">{{ inst.vehicleAssignmentDate }}</p>
              </div>
            </div>
          }
        } @else {
          <p class="text-sm italic" style="color: var(--text-muted)">Sin vehículo asignado</p>
        }
      </div>

      <!-- ── Historial de Vehículos ──────────────────────────────────────── -->
      <div class="flex flex-col gap-3 mb-6">
        <h3 class="section-header">Historial de Vehículos Asignados</h3>

        @if (facade.assignmentHistory().length === 0) {
          <div class="flex flex-col items-center gap-2 py-6">
            <app-icon name="file-text" [size]="28" color="var(--text-muted)" />
            <p class="text-xs" style="color: var(--text-muted)">
              Sin historial de asignaciones de vehículos
            </p>
          </div>
        } @else {
          @for (h of facade.assignmentHistory(); track h.id) {
            <div
              class="flex items-center justify-between py-2.5 px-3 rounded-lg"
              style="background: var(--bg-elevated)"
            >
              <div>
                <p class="text-sm font-semibold" style="color: var(--text-primary)">
                  {{ h.vehiclePlate }}
                </p>
                <p class="text-xs" style="color: var(--text-muted)">{{ h.vehicleModel }}</p>
              </div>
              <div class="text-right">
                <p class="text-xs" style="color: var(--text-secondary)">
                  {{ h.startDate }}
                  @if (h.endDate) {
                    → {{ h.endDate }}
                  } @else {
                    → Actual
                  }
                </p>
              </div>
            </div>
          }
        }
      </div>

      <!-- ── Acciones rápidas ────────────────────────────────────────────── -->
      <div class="flex flex-col gap-2 mb-6">
        <h3 class="section-header">Acciones rápidas</h3>
        <button
          class="quick-action-btn"
          (click)="editar()"
          data-llm-action="editar-instructor-desde-ver"
        >
          <app-icon name="edit" [size]="16" />
          Editar perfil
        </button>
        <button class="quick-action-btn" data-llm-action="ver-horario-instructor">
          <app-icon name="calendar" [size]="16" />
          Ver horario
        </button>
        <button
          class="quick-action-btn"
          style="border-color: var(--ds-brand); color: var(--ds-brand)"
          data-llm-action="ver-clases-activas-instructor"
        >
          <app-icon name="clipboard-list" [size]="16" />
          Ver clases activas ({{ inst.activeClassesCount }})
        </button>
      </div>
        </ng-template>
      </app-drawer-content-loader>
    }
  `,
  styles: `
    .section-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .detail-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      color: var(--text-muted);
    }

    .detail-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }

    .detail-value {
      font-size: var(--text-sm);
      color: var(--text-primary);
      font-weight: 500;
    }

    .license-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 4px;
      width: fit-content;
    }
    .license-badge--valid {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .license-badge--expiring_soon {
      background: color-mix(in srgb, var(--state-warning) 12%, transparent);
      color: var(--state-warning);
    }
    .license-badge--expired {
      background: color-mix(in srgb, var(--state-error) 12%, transparent);
      color: var(--state-error);
    }

    .quick-action-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      text-align: left;
      transition: all var(--duration-fast);
    }
    .quick-action-btn:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 4%, transparent);
    }
  `,
})
export class AdminInstructorVerDrawerComponent {
  protected readonly facade = inject(InstructoresFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected editar(): void {
    this.layoutDrawer.open(AdminInstructorEditarDrawerComponent, 'Editar instructor', 'edit');
  }
}
