import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { BranchFacade } from '@core/facades/branch.facade';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { AdminPromocionCrearDrawerComponent } from './admin-promocion-crear-drawer.component';
import { AdminPromocionVerDrawerComponent } from './admin-promocion-ver-drawer.component';
import { AdminPromocionEditarDrawerComponent } from './admin-promocion-editar-drawer.component';
import type { PromocionTableRow, PromocionStatus } from '@core/models/ui/promocion-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';

const COURSE_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  planned: {
    label: 'Planificada',
    bg: 'color-mix(in srgb, var(--ds-brand) 12%, transparent)',
    color: 'var(--ds-brand)',
    icon: 'calendar',
  },
  in_progress: {
    label: 'En curso',
    bg: 'color-mix(in srgb, var(--state-success) 12%, transparent)',
    color: 'var(--state-success)',
    icon: 'circle-play',
  },
  finished: {
    label: 'Finalizada',
    bg: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    icon: 'check-circle',
  },
  cancelled: {
    label: 'Cancelada',
    bg: 'color-mix(in srgb, var(--state-error) 12%, transparent)',
    color: 'var(--state-error)',
    icon: 'circle-x',
  },
};

@Component({
  selector: 'app-admin-profesional-promociones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
    DrawerComponent,
    AdminPromocionCrearDrawerComponent,
    AdminPromocionVerDrawerComponent,
    AdminPromocionEditarDrawerComponent,
  ],
  template: `
    <div class="page-wide">
      <!-- ── Hero ────────────────────────────────────────────────────────── -->
      <div class="mb-6">
        <app-section-hero
          title="Gestión de Promociones"
          subtitle="Cohortes de cursos profesionales A2, A3, A4, A5"
          [actions]="heroActions()"
          (actionClick)="handleHeroAction($event)"
        />
      </div>

      <!-- ── KPI Cards ───────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-kpi-card-variant
          label="Total Promociones"
          [value]="facade.totalPromociones()"
          icon="layers"
          [loading]="facade.isLoading()"
          data-llm-description="Total de promociones registradas"
        />
        <app-kpi-card-variant
          label="Planificadas"
          [value]="facade.planificadas()"
          icon="calendar"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones planificadas"
        />
        <app-kpi-card-variant
          label="En Curso"
          [value]="facade.enCurso()"
          icon="circle-play"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones en curso"
        />
        <app-kpi-card-variant
          label="Finalizadas"
          [value]="facade.finalizadas()"
          icon="check-circle"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones finalizadas"
        />
      </div>

      <!-- ── Search + Filters ────────────────────────────────────────────── -->
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

        <p-select
          [options]="estadoOptions"
          [(ngModel)]="filtroEstadoModel"
          optionLabel="label"
          optionValue="value"
          placeholder="Todos los estados"
          [style]="{ height: '40px' }"
          aria-label="Filtrar por estado"
          data-llm-description="Filtro de promociones por estado"
        />
      </div>

      <!-- ── Content ─────────────────────────────────────────────────────── -->
      @if (facade.isLoading()) {
        <div class="flex flex-col gap-4">
          @for (_ of skeletonRows; track $index) {
            <div class="card p-6">
              <div class="flex items-start gap-4">
                <div class="flex-1 flex flex-col gap-3">
                  <app-skeleton-block variant="text" width="280px" height="20px" />
                  <app-skeleton-block variant="text" width="200px" height="14px" />
                  <div class="flex gap-2 mt-2">
                    @for (_ of [1, 2, 3, 4]; track $index) {
                      <app-skeleton-block variant="rect" width="90px" height="32px" />
                    }
                  </div>
                </div>
                <app-skeleton-block variant="rect" width="100px" height="36px" />
              </div>
            </div>
          }
        </div>
      } @else if (filteredPromociones().length === 0) {
        <div class="card p-14 text-center">
          <div class="flex flex-col items-center gap-2">
            <app-icon name="layers" [size]="36" />
            <p class="text-sm mt-1" style="color: var(--text-muted)">
              No hay promociones que coincidan con los filtros.
            </p>
          </div>
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          @for (promo of paginatedPromociones(); track promo.id) {
            <div class="card p-6 promo-card">
              <!-- Header -->
              <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div class="flex items-center gap-3 flex-wrap">
                    <h3 class="text-base font-semibold" style="color: var(--text-primary)">
                      {{ promo.name }}
                    </h3>
                    <span
                      class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      [style.background]="statusConfig(promo.status).bg"
                      [style.color]="statusConfig(promo.status).color"
                    >
                      <app-icon [name]="statusConfig(promo.status).icon" [size]="10" />
                      {{ statusConfig(promo.status).label }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span
                      class="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                      style="background: var(--bg-elevated); color: var(--text-muted);"
                    >
                      {{ promo.code }}
                    </span>
                    <span
                      class="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                      style="background: color-mix(in srgb, var(--ds-brand) 8%, transparent); color: var(--text-primary);"
                    >
                      <app-icon name="calendar" [size]="12" color="var(--ds-brand)" />
                      {{ formatDate(promo.startDate) }}
                      <span style="color: var(--text-muted)">→</span>
                      {{ formatDate(promo.endDate) }}
                    </span>
                    <span class="text-xs" style="color: var(--text-secondary)">
                      {{ promo.totalEnrolled }} alumnos
                    </span>
                  </div>
                </div>

                <button
                  class="btn-outline flex items-center gap-2"
                  (click)="openVerDrawer(promo)"
                  data-llm-action="ver-detalle-promocion"
                >
                  <app-icon name="eye" [size]="14" />
                  Ver detalle
                </button>
              </div>

              <!-- Progress (solo en curso) -->
              @if (promo.status === 'in_progress') {
                <div class="mb-4">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium" style="color: var(--text-secondary)">
                      Día de clase {{ promo.currentDay }} de 30
                    </span>
                    <span class="text-xs font-semibold" style="color: var(--ds-brand)">
                      {{ progressPercent(promo) }}%
                    </span>
                  </div>
                  <div
                    class="w-full rounded-full overflow-hidden"
                    style="height: 6px; background: var(--bg-elevated);"
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      style="background: var(--ds-brand);"
                      [style.width.%]="progressPercent(promo)"
                    ></div>
                  </div>
                </div>
              }

              <!-- Completada -->
              @if (promo.status === 'finished') {
                <div
                  class="flex items-center gap-2 mb-4 text-xs"
                  style="color: var(--state-success)"
                >
                  <app-icon name="check-circle" [size]="14" />
                  Completada - 30 de 30 días de clase
                </div>
              }

              <!-- Cursos badges -->
              <div class="mb-4">
                <p class="text-xs font-semibold mb-2" style="color: var(--ds-brand)">
                  Alumnos por categoría
                </p>
                <div class="flex items-center gap-2 flex-wrap">
                  @for (curso of promo.cursos; track curso.id) {
                    <div class="curso-badge-pill">
                      <span
                        class="curso-badge-code"
                        [style.background]="courseColor(curso.courseCode)"
                      >
                        {{ curso.courseCode }}
                      </span>
                      <span class="text-xs font-semibold" style="color: var(--text-primary)">
                        {{ curso.enrolledStudents }}
                      </span>
                      <span class="text-xs" style="color: var(--text-muted)">
                        / {{ curso.maxStudents }}
                      </span>
                    </div>
                  }
                </div>
              </div>

              <!-- Relatores mini-cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                @for (curso of promo.cursos; track curso.id) {
                  <div
                    class="rounded-lg p-3"
                    style="border: 1px solid var(--border-subtle); background: var(--bg-base);"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        class="curso-badge-code"
                        [style.background]="courseColor(curso.courseCode)"
                      >
                        {{ curso.courseCode }}
                      </span>
                      <span class="text-xs" style="color: var(--text-muted)">
                        {{ curso.courseName }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1 mb-1.5" style="color: var(--text-muted)">
                      <app-icon name="user-check" [size]="11" />
                      <span class="text-[10px] font-semibold uppercase tracking-wide">
                        {{ curso.relatores.length > 1 ? 'Relatores' : 'Relator' }}
                      </span>
                    </div>
                    @if (curso.relatores.length > 0) {
                      @for (rel of curso.relatores; track rel.id) {
                        <div class="flex items-center gap-2 mb-1">
                          <div
                            class="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0"
                            style="
                              background: var(--color-primary-tint);
                              color: var(--color-primary);
                            "
                          >
                            {{ rel.initials }}
                          </div>
                          <span class="text-xs truncate" style="color: var(--text-primary)">
                            {{ rel.nombre }}
                          </span>
                        </div>
                      }
                    } @else {
                      <span class="text-xs italic" style="color: var(--text-muted)">
                        Sin relator asignado
                      </span>
                    }
                    <!-- Mini progress bar -->
                    <div class="mt-2">
                      <div
                        class="w-full rounded-full overflow-hidden"
                        style="height: 4px; background: var(--bg-elevated);"
                      >
                        <div
                          class="h-full rounded-full"
                          [style.background]="courseColor(curso.courseCode)"
                          [style.width.%]="enrollPercent(curso)"
                        ></div>
                      </div>
                      <div class="flex justify-end mt-0.5">
                        <span class="text-[10px]" style="color: var(--text-muted)">
                          {{ curso.enrolledStudents }}/{{ curso.maxStudents }}
                        </span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Paginación -->
        @if (filteredPromociones().length > 0) {
          <div class="flex items-center justify-between mt-4">
            <p class="text-xs" style="color: var(--text-muted)">
              Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de
              {{ filteredPromociones().length }} promociones
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
      }
    </div>

    <!-- ── Drawer: Crear ───────────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="crearDrawerOpen()"
      title="Nueva Promoción"
      icon="plus"
      (closed)="crearDrawerOpen.set(false)"
    >
      <app-admin-promocion-crear-drawer (closed)="crearDrawerOpen.set(false)" />
    </app-drawer>

    <!-- ── Drawer: Ver ─────────────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="verDrawerOpen()"
      title="Detalle de Promoción"
      icon="eye"
      (closed)="verDrawerOpen.set(false)"
    >
      <app-admin-promocion-ver-drawer (editarClicked)="switchToEditar()" />
    </app-drawer>

    <!-- ── Drawer: Editar ──────────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="editarDrawerOpen()"
      title="Editar Promoción"
      icon="edit"
      (closed)="editarDrawerOpen.set(false)"
    >
      <app-admin-promocion-editar-drawer (saved)="editarDrawerOpen.set(false)" />
    </app-drawer>
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
    .search-input::placeholder {
      color: var(--text-muted);
    }

    .promo-card {
      transition: box-shadow var(--duration-fast);
    }
    .promo-card:hover {
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    }

    .curso-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 4px;
      border-radius: 20px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
    }

    .curso-badge-code {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: white;
    }

    .btn-outline {
      padding: 7px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
      white-space: nowrap;
    }
    .btn-outline:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
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
export class AdminProfesionalPromocionesComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(PromocionesFacade);
  private readonly branchFacade = inject(BranchFacade);

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Nueva Promoción', icon: 'plus', primary: true },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') this.crearDrawerOpen.set(true);
  }

  // ── Drawers ───────────────────────────────────────────────────────────────
  protected readonly crearDrawerOpen = signal(false);
  protected readonly verDrawerOpen = signal(false);
  protected readonly editarDrawerOpen = signal(false);

  // ── Filtros ───────────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroEstado = signal<PromocionStatus | null>(null);
  protected readonly currentPage = signal(1);
  private readonly pageSize = 5;

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

  // ── Paginación ────────────────────────────────────────────────────────────
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

  // ── Opciones filtros ──────────────────────────────────────────────────────
  protected readonly estadoOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Planificada', value: 'planned' },
    { label: 'En curso', value: 'in_progress' },
    { label: 'Finalizada', value: 'finished' },
    { label: 'Cancelada', value: 'cancelled' },
  ];

  protected get filtroEstadoModel(): PromocionStatus | null {
    return this.filtroEstado();
  }
  protected set filtroEstadoModel(v: PromocionStatus | null) {
    this.filtroEstado.set(v);
    this.currentPage.set(1);
  }

  protected readonly skeletonRows = [1, 2, 3];

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  protected statusConfig(status: string): {
    label: string;
    bg: string;
    color: string;
    icon: string;
  } {
    return STATUS_CONFIG[status] ?? STATUS_CONFIG['planned'];
  }

  protected courseColor(code: string): string {
    return COURSE_COLORS[code] ?? '#6b7280';
  }

  protected progressPercent(promo: PromocionTableRow): number {
    return Math.round((promo.currentDay / 30) * 100);
  }

  protected enrollPercent(curso: { enrolledStudents: number; maxStudents: number }): number {
    return curso.maxStudents > 0
      ? Math.round((curso.enrolledStudents / curso.maxStudents) * 100)
      : 0;
  }

  protected formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  protected openVerDrawer(promo: PromocionTableRow): void {
    this.facade.selectPromocion(promo);
    this.verDrawerOpen.set(true);
  }

  protected switchToEditar(): void {
    this.verDrawerOpen.set(false);
    this.editarDrawerOpen.set(true);
  }
}
