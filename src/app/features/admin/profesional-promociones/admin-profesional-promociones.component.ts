import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { PromocionTableRow } from '@core/models/ui/promocion-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AdminPromocionCrearDrawerComponent } from './admin-promocion-crear-drawer.component';
import { AdminPromocionVerDrawerComponent } from './admin-promocion-ver-drawer.component';
import { AdminPromocionEditarDrawerComponent } from './admin-promocion-editar-drawer.component';

@Component({
  selector: 'app-admin-profesional-promociones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
  ],
  template: `
    <div class="page-wide">
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <div class="mb-6">
        <app-section-hero
          title="Promociones Profesionales"
          subtitle="Programación y gestión de ciclos de cursos Clase Profesional"
          [actions]="heroActions()"
          (actionClick)="handleHeroAction($event)"
        />
      </div>

      <!-- ── KPI Cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <app-kpi-card-variant
          label="Total Promociones"
          [value]="facade.totalPromociones()"
          icon="calendar"
          [loading]="facade.isLoading()"
          data-llm-description="Total de promociones registradas"
        />
        <app-kpi-card-variant
          label="En curso"
          [value]="facade.enCurso()"
          icon="play-circle"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones actualmente activas"
        />
        <app-kpi-card-variant
          label="Planificadas"
          [value]="facade.planificadas()"
          icon="clock"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones próximas a iniciar"
        />
        <app-kpi-card-variant
          label="Alumnos totales"
          [value]="facade.totalAlumnos()"
          icon="users"
          [loading]="facade.isLoading()"
          data-llm-description="Total de alumnos en todas las promociones"
        />
      </div>

      <!-- ── Search + Filters ───────────────────────────────────────────────── -->
      <div class="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <div class="relative flex-1">
          <span
            class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style="color: var(--text-muted)"
          >
            <app-icon name="search" [size]="15" />
          </span>
          <input
            type="text"
            class="search-input"
            placeholder="Buscar por nombre o código..."
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            data-llm-description="Buscar promoción por nombre o código"
          />
        </div>

        <div class="flex items-center gap-2">
          <select
            class="filter-select"
            [ngModel]="filtroEstado()"
            (ngModelChange)="filtroEstado.set($event)"
            aria-label="Filtrar por estado"
            data-llm-description="Filtro de promociones por estado"
          >
            <option [value]="null">Todos los estados</option>
            <option value="planned">Planificada</option>
            <option value="in_progress">En curso</option>
            <option value="finished">Finalizada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      </div>

      <!-- ── Content (Grillet) ─────────────────────────────────────────────── -->
      <div class="card p-6 flex flex-col min-h-[400px]">
        <h2 class="text-base font-semibold mb-4" style="color: var(--text-primary)">
          Historial de Promociones
        </h2>

        @if (facade.isLoading()) {
          <div class="flex flex-col gap-3">
            @for (_ of [1, 2, 3, 4]; track $index) {
              <div
                class="flex items-center gap-4 py-4"
                style="border-bottom: 1px solid var(--border-subtle);"
              >
                <div class="flex-1 flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="200px" height="14px" />
                  <app-skeleton-block variant="text" width="300px" height="12px" />
                </div>
                <app-skeleton-block variant="rect" width="80px" height="24px" />
                <app-skeleton-block variant="rect" width="32px" height="32px" />
              </div>
            }
          </div>
        } @else if (paginatedPromociones().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center py-14 text-center">
            <app-icon name="calendar-x" [size]="40" color="var(--text-muted)" class="mb-3" />
            <p class="text-sm font-medium" style="color: var(--text-primary)">
              No se encontraron promociones
            </p>
            <p class="text-xs mt-1" style="color: var(--text-muted)">
              Intenta cambiar los términos de búsqueda o filtros.
            </p>
          </div>
        } @else {
          <div class="flex flex-col">
            @for (promo of paginatedPromociones(); track promo.id) {
              <div
                class="promo-row flex items-center gap-4 py-4"
                style="border-bottom: 1px solid var(--border-subtle);"
              >
                <!-- Info principal -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="text-sm font-bold" style="color: var(--text-primary)">
                      {{ promo.name }}
                    </span>
                    <span
                      class="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style="background: var(--bg-elevated); color: var(--text-muted);"
                    >
                      {{ promo.code }}
                    </span>
                    <span
                      class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      [class]="'status-badge--' + promo.status"
                    >
                      {{ statusLabel(promo.status) }}
                    </span>
                  </div>

                  <div class="flex items-center gap-4 flex-wrap">
                    <span
                      class="flex items-center gap-1.5 text-xs"
                      style="color: var(--text-muted)"
                    >
                      <app-icon name="calendar" [size]="12" />
                      {{ promo.startDate | date: 'dd/MM/yyyy' }} →
                      {{ promo.endDate | date: 'dd/MM/yyyy' }}
                    </span>
                    <span
                      class="flex items-center gap-1.5 text-xs"
                      style="color: var(--text-secondary)"
                    >
                      <app-icon name="users" [size]="12" />
                      {{ promo.totalEnrolled }} / {{ promo.maxStudents }} alumnos
                    </span>
                  </div>
                </div>

                <!-- Cursos mini-pills -->
                <div class="hidden md:flex items-center gap-1 shrink-0">
                  @for (curso of promo.cursos; track curso.id) {
                    <span
                      class="w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold text-white"
                      [style.background]="getCourseColor(curso.courseCode)"
                      [title]="curso.courseName + ': ' + curso.enrolledStudents + ' alumnos'"
                    >
                      {{ curso.courseCode }}
                    </span>
                  }
                </div>

                <!-- Acciones -->
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    class="action-btn"
                    title="Ver detalle"
                    (click)="openVerDrawer(promo)"
                    data-llm-action="ver-promocion"
                  >
                    <app-icon name="eye" [size]="16" />
                  </button>
                  <button
                    class="action-btn"
                    title="Editar promoción"
                    (click)="openEditarDrawer(promo)"
                    data-llm-action="editar-promocion"
                  >
                    <app-icon name="edit" [size]="16" />
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <!-- Paginación -->
        @if (!facade.isLoading() && filteredPromociones().length > 0) {
          <div
            class="flex items-center justify-between pt-6 mt-6"
            style="border-top: 1px solid var(--border-subtle);"
          >
            <p class="text-xs" style="color: var(--text-muted)">
              Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de
              {{ filteredPromociones().length }} promociones
            </p>
            <div class="flex items-center gap-2">
              <button
                class="pagination-btn"
                [disabled]="currentPage() === 1"
                (click)="currentPage.set(currentPage() - 1)"
                data-llm-action="pagina-anterior-promociones"
              >
                Anterior
              </button>
              <button
                class="pagination-btn"
                [disabled]="currentPage() >= totalPages()"
                (click)="currentPage.set(currentPage() + 1)"
                data-llm-action="pagina-siguiente-promociones"
              >
                Siguiente
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .search-input {
      width: 100%;
      padding: 9px 12px 9px 36px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }

    .filter-select {
      padding: 7px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
      cursor: pointer;
    }

    .promo-row {
      transition: background var(--duration-fast);
    }
    .promo-row:hover {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
    }

    .status-badge--planned {
      background: color-mix(in srgb, var(--ds-brand) 10%, transparent);
      color: var(--ds-brand);
    }
    .status-badge--in_progress {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .status-badge--finished {
      background: var(--bg-elevated);
      color: var(--text-muted);
    }
    .status-badge--cancelled {
      background: color-mix(in srgb, var(--state-error) 10%, transparent);
      color: var(--state-error);
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
export class AdminProfesionalPromocionesComponent {
  protected readonly facade = inject(PromocionesFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    this.facade.initialize();
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Programar Promoción', icon: 'plus', primary: true },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') {
      this.layoutDrawer.open(
        AdminPromocionCrearDrawerComponent,
        'Programar Promoción',
        'calendar-plus',
      );
    }
  }

  // ── Filtros locales ────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly currentPage = signal(1);
  private readonly pageSize = 10;

  // ── Lista filtrada ─────────────────────────────────────────────────────────
  protected readonly filteredPromociones = computed<PromocionTableRow[]>(() => {
    let results = this.facade.promociones();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term),
      );
    }
    if (this.filtroEstado()) {
      results = results.filter((p) => p.status === this.filtroEstado());
    }
    return results;
  });

  // ── Paginación ─────────────────────────────────────────────────────────────
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPromociones().length / this.pageSize)),
  );

  protected readonly paginatedPromociones = computed<PromocionTableRow[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredPromociones().slice(start, start + this.pageSize);
  });

  protected readonly paginationStart = computed(() => (this.currentPage() - 1) * this.pageSize + 1);

  protected readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredPromociones().length),
  );

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      planned: 'Planificada',
      in_progress: 'En curso',
      finished: 'Finalizada',
      cancelled: 'Cancelada',
    };
    return map[status] ?? status;
  }

  protected getCourseColor(code: string): string {
    const colors: Record<string, string> = {
      A2: '#3b82f6',
      A3: '#8b5cf6',
      A4: '#f59e0b',
      A5: '#10b981',
    };
    return colors[code] ?? '#6b7280';
  }

  protected openVerDrawer(promo: PromocionTableRow): void {
    this.facade.selectPromocion(promo);
    this.layoutDrawer.open(AdminPromocionVerDrawerComponent, 'Detalle de Promoción', 'eye');
  }

  protected openEditarDrawer(promo: PromocionTableRow): void {
    this.facade.selectPromocion(promo);
    this.layoutDrawer.open(AdminPromocionEditarDrawerComponent, 'Editar Promoción', 'edit');
  }
}
