import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import type { InstructorTableRow } from '@core/models/ui/instructor-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
import { AdminInstructorCrearDrawerComponent } from './admin-instructor-crear-drawer.component';
import { AdminInstructorVerDrawerComponent } from './admin-instructor-ver-drawer.component';
import { AdminInstructorEditarDrawerComponent } from './admin-instructor-editar-drawer.component';

type FilterTab = 'all' | 'active' | 'expiring';

@Component({
  selector: 'app-admin-instructores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    IconComponent,
    SkeletonBlockComponent,
    DrawerComponent,
    AdminInstructorCrearDrawerComponent,
    AdminInstructorVerDrawerComponent,
    AdminInstructorEditarDrawerComponent,
  ],
  template: `
    <div class="page-wide">
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <div class="mb-6">
        <app-section-hero
          title="Instructores"
          subtitle="Gestión de instructores Clase B con licencias y vehículos"
          [actions]="heroActions()"
          (actionClick)="handleHeroAction($event)"
        />
      </div>

      <!-- ── Filter Tabs ──────────────────────────────────────────────────── -->
      <div class="flex items-center gap-2 mb-6">
        <span class="text-sm font-medium" style="color: var(--text-secondary)">Filtros:</span>
        <button
          class="filter-pill"
          [class.filter-pill--active]="activeFilter() === 'all'"
          (click)="activeFilter.set('all')"
          data-llm-action="filtro-todos"
        >
          Todos ({{ facade.totalInstructores() }})
        </button>
        <button
          class="filter-pill"
          [class.filter-pill--active]="activeFilter() === 'active'"
          (click)="activeFilter.set('active')"
          data-llm-action="filtro-activos"
        >
          Activos ({{ facade.activos() }})
        </button>
        <button
          class="filter-pill"
          [class.filter-pill--warning]="
            facade.licenciasPorVencer() > 0 && activeFilter() === 'expiring'
          "
          [class.filter-pill--warning-idle]="
            facade.licenciasPorVencer() > 0 && activeFilter() !== 'expiring'
          "
          [class.filter-pill--active]="
            activeFilter() === 'expiring' && facade.licenciasPorVencer() === 0
          "
          (click)="activeFilter.set('expiring')"
          data-llm-action="filtro-licencia-por-vencer"
        >
          <app-icon name="alert-triangle" [size]="13" />
          Licencia por vencer ({{ facade.licenciasPorVencer() }})
        </button>
      </div>

      <!-- ── Table ────────────────────────────────────────────────────────── -->
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="instructor-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Licencia</th>
                <th>Vehículo</th>
                <th>Tipo</th>
                <th class="text-center">Clases activas</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @if (facade.isLoading()) {
                @for (_ of skeletonRows; track $index) {
                  <tr>
                    <td>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="140px" height="14px" />
                        <app-skeleton-block variant="text" width="180px" height="11px" />
                      </div>
                    </td>
                    <td><app-skeleton-block variant="text" width="100px" height="14px" /></td>
                    <td>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="rect" width="70px" height="22px" />
                        <app-skeleton-block variant="text" width="110px" height="11px" />
                      </div>
                    </td>
                    <td>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="80px" height="14px" />
                        <app-skeleton-block variant="text" width="120px" height="11px" />
                      </div>
                    </td>
                    <td><app-skeleton-block variant="text" width="70px" height="14px" /></td>
                    <td class="text-center">
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                    </td>
                    <td><app-skeleton-block variant="text" width="60px" height="14px" /></td>
                    <td><app-skeleton-block variant="rect" width="60px" height="28px" /></td>
                  </tr>
                }
              } @else if (filteredInstructores().length === 0) {
                <tr>
                  <td colspan="8">
                    <div class="py-14 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <app-icon name="user-check" [size]="36" color="var(--text-muted)" />
                        <p class="text-sm mt-1" style="color: var(--text-muted)">
                          No hay instructores que coincidan con los filtros.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (inst of paginatedInstructores(); track inst.id) {
                  <tr class="instructor-row">
                    <!-- Nombre + email -->
                    <td>
                      <div class="flex flex-col">
                        <span class="text-sm font-semibold" style="color: var(--text-primary)">
                          {{ inst.nombre }}
                        </span>
                        <a
                          class="text-xs"
                          style="color: var(--text-muted); text-decoration: none;"
                          [href]="'mailto:' + inst.email"
                        >
                          {{ inst.email }}
                        </a>
                      </div>
                    </td>

                    <!-- RUT -->
                    <td>
                      <span class="text-sm" style="color: var(--text-primary)">{{ inst.rut }}</span>
                    </td>

                    <!-- Licencia -->
                    <td>
                      <div class="flex flex-col gap-1">
                        <span
                          class="license-badge"
                          [class]="'license-badge license-badge--' + inst.licenseStatus"
                        >
                          {{ inst.licenseStatusLabel }}
                        </span>
                        @if (inst.licenseExpiry) {
                          <span class="text-xs" style="color: var(--text-muted)">
                            Vence: {{ inst.licenseExpiry }}
                          </span>
                        }
                      </div>
                    </td>

                    <!-- Vehículo -->
                    <td>
                      @if (inst.vehiclePlate) {
                        <div class="flex flex-col">
                          <span class="text-sm font-semibold" style="color: var(--text-primary)">
                            {{ inst.vehiclePlate }}
                          </span>
                          <span class="text-xs" style="color: var(--text-muted)">
                            {{ inst.vehicleModel }}
                          </span>
                        </div>
                      } @else {
                        <span class="text-sm italic" style="color: var(--text-muted)">
                          Sin asignar
                        </span>
                      }
                    </td>

                    <!-- Tipo -->
                    <td>
                      <span class="text-sm" style="color: var(--text-primary)">
                        {{ inst.tipoLabel }}
                      </span>
                    </td>

                    <!-- Clases activas -->
                    <td class="text-center">
                      <span class="classes-badge">
                        {{ inst.activeClassesCount }}
                      </span>
                    </td>

                    <!-- Estado -->
                    <td>
                      @if (inst.estado === 'activo') {
                        <span class="status-text status-text--active">Activo</span>
                      } @else {
                        <span class="status-text status-text--inactive">Inactivo</span>
                      }
                    </td>

                    <!-- Acciones -->
                    <td>
                      <div class="flex items-center gap-1">
                        <button
                          class="action-btn"
                          title="Ver detalle"
                          (click)="openVerDrawer(inst)"
                          data-llm-action="ver-instructor"
                        >
                          <app-icon name="eye" [size]="16" />
                        </button>
                        <button
                          class="action-btn"
                          title="Editar instructor"
                          (click)="openEditarDrawer(inst)"
                          data-llm-action="editar-instructor"
                        >
                          <app-icon name="edit" [size]="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        @if (!facade.isLoading() && filteredInstructores().length > 0) {
          <div
            class="flex items-center justify-between px-6 py-4"
            style="border-top: 1px solid var(--border-subtle);"
          >
            <p class="text-xs" style="color: var(--text-muted)">
              Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de
              {{ filteredInstructores().length }} instructores
            </p>
            <div class="flex items-center gap-2">
              <button
                class="pagination-btn"
                [disabled]="currentPage() === 1"
                (click)="currentPage.set(currentPage() - 1)"
                data-llm-action="pagina-anterior"
              >
                Anterior
              </button>
              <button
                class="pagination-btn"
                [disabled]="currentPage() >= totalPages()"
                (click)="currentPage.set(currentPage() + 1)"
                data-llm-action="pagina-siguiente"
              >
                Siguiente
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ── Drawer: Crear Instructor ──────────────────────────────────────── -->
    <app-drawer
      [isOpen]="crearDrawerOpen()"
      title="Crear instructor Clase B"
      icon="user-plus"
      (closed)="onCrearDrawerClosed()"
    >
      <app-admin-instructor-crear-drawer (closed)="onCrearDrawerClosed()" />
    </app-drawer>

    <!-- ── Drawer: Ver Instructor ────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="verDrawerOpen()"
      title="Detalle de Instructor"
      icon="eye"
      (closed)="verDrawerOpen.set(false)"
    >
      <app-admin-instructor-ver-drawer (editarClicked)="switchToEditar()" />
    </app-drawer>

    <!-- ── Drawer: Editar Instructor ─────────────────────────────────────── -->
    <app-drawer
      [isOpen]="editarDrawerOpen()"
      title="Editar instructor"
      icon="edit"
      (closed)="onEditarDrawerClosed()"
    >
      <app-admin-instructor-editar-drawer (saved)="onEditarDrawerClosed()" />
    </app-drawer>
  `,
  styles: `
    .filter-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 14px;
      border-radius: 9999px;
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .filter-pill:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .filter-pill--active {
      border-color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 8%, transparent);
      color: var(--ds-brand);
    }
    .filter-pill--warning {
      border-color: var(--state-warning);
      background: color-mix(in srgb, var(--state-warning) 12%, transparent);
      color: var(--state-warning);
    }
    .filter-pill--warning-idle {
      border-color: var(--state-warning);
      background: color-mix(in srgb, var(--state-warning) 6%, transparent);
      color: var(--state-warning);
    }

    .instructor-table {
      width: 100%;
      border-collapse: collapse;
    }
    .instructor-table th {
      padding: 14px 20px;
      text-align: left;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-default);
      white-space: nowrap;
    }
    .instructor-table td {
      padding: 16px 20px;
      vertical-align: middle;
      border-bottom: 1px solid var(--border-subtle);
    }

    .instructor-row {
      transition: background var(--duration-fast);
    }
    .instructor-row:hover {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
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

    .classes-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--ds-brand) 8%, transparent);
      color: var(--ds-brand);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .status-text {
      font-size: var(--text-sm);
      font-weight: 500;
    }
    .status-text--active {
      color: var(--state-success);
    }
    .status-text--inactive {
      color: var(--text-muted);
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .action-btn:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }

    .pagination-btn {
      padding: 6px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .pagination-btn:hover:not(:disabled) {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .pagination-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,
})
export class AdminInstructoresComponent implements OnInit {
  protected readonly facade = inject(InstructoresFacade);

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'hours', label: 'Horas trabajadas', icon: 'clock', primary: false },
    { id: 'new', label: 'Nuevo Instructor', icon: 'user-plus', primary: true },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') this.crearDrawerOpen.set(true);
  }

  // ── Estado drawers ─────────────────────────────────────────────────────────
  protected readonly crearDrawerOpen = signal(false);
  protected readonly verDrawerOpen = signal(false);
  protected readonly editarDrawerOpen = signal(false);

  // ── Filtros ────────────────────────────────────────────────────────────────
  protected readonly activeFilter = signal<FilterTab>('all');
  protected readonly currentPage = signal(1);
  private readonly pageSize = 10;

  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  // ── Lista filtrada ─────────────────────────────────────────────────────────
  protected readonly filteredInstructores = computed<InstructorTableRow[]>(() => {
    const filter = this.activeFilter();
    let results = this.facade.instructores();

    if (filter === 'active') {
      results = results.filter((i) => i.estado === 'activo');
    } else if (filter === 'expiring') {
      results = results.filter((i) => i.licenseStatus === 'expiring_soon');
    }

    return results;
  });

  // ── Paginación ─────────────────────────────────────────────────────────────
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredInstructores().length / this.pageSize)),
  );

  protected readonly paginatedInstructores = computed<InstructorTableRow[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredInstructores().slice(start, start + this.pageSize);
  });

  protected readonly paginationStart = computed(() => (this.currentPage() - 1) * this.pageSize + 1);

  protected readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredInstructores().length),
  );

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected openVerDrawer(inst: InstructorTableRow): void {
    this.facade.selectInstructor(inst);
    this.facade.loadAssignmentHistory(inst.id);
    this.verDrawerOpen.set(true);
  }

  protected openEditarDrawer(inst: InstructorTableRow): void {
    this.facade.selectInstructor(inst);
    this.facade.loadAssignmentHistory(inst.id);
    this.editarDrawerOpen.set(true);
  }

  protected switchToEditar(): void {
    this.verDrawerOpen.set(false);
    this.editarDrawerOpen.set(true);
  }

  protected onCrearDrawerClosed(): void {
    this.crearDrawerOpen.set(false);
    this.facade.initialize();
  }

  protected onEditarDrawerClosed(): void {
    this.editarDrawerOpen.set(false);
    this.facade.initialize();
  }
}
