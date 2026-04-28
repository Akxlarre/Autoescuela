import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  computed,
  effect,
  inject,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BranchFacade } from '@core/facades/branch.facade';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { PromocionTableRow } from '@core/models/ui/promocion-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

import { SelectModule } from 'primeng/select';
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
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        #heroRef
        title="Promociones Profesionales"
        subtitle="Programación y gestión de ciclos de cursos Clase Profesional"
        [actions]="heroActions()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── KPI Cards ──────────────────────────────────────────────────────── -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Total Promociones"
          [value]="facade.totalPromociones()"
          icon="calendar"
          [loading]="facade.isLoading()"
          data-llm-description="Total de promociones registradas"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="En curso"
          [value]="facade.enCurso()"
          icon="play-circle"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones actualmente activas"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Planificadas"
          [value]="facade.planificadas()"
          icon="clock"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones próximas a iniciar"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Canceladas"
          [value]="facade.canceladas()"
          icon="ban"
          color="warning"
          [loading]="facade.isLoading()"
          data-llm-description="Promociones canceladas"
        />
      </div>

      <!-- ── Content (Grillet) ─────────────────────────────────────────────── -->
      <div class="bento-banner flex flex-col gap-6">
        <div class="card p-0 flex flex-col min-h-[400px] overflow-hidden">
          <div
            class="p-4 lg:px-6 lg:py-4 flex flex-col gap-4 border-b"
            style="border-color: var(--border-muted); background: var(--bg-surface)"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold" style="color: var(--text-primary)">
                Historial de Promociones
              </h2>
              <span class="text-xs" style="color: var(--text-muted)">
                {{ filteredPromociones().length }} promociones encontradas
              </span>
            </div>

            <!-- ── Barra de búsqueda + filtros (Integrada como Toolbar) ── -->
            <div class="flex flex-col xl:flex-row gap-3 w-full">
              <!-- Input de búsqueda -->
              <div class="relative flex-1">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <app-icon name="search" [size]="16" color="var(--text-muted)" />
                </div>
                <input
                  type="search"
                  placeholder="Buscar por nombre o código..."
                  class="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg transition-colors focus:outline-none bg-base hover:border-text-muted focus:border-brand"
                  style="border: 1px solid var(--border-muted); color: var(--text-primary);"
                  [ngModel]="searchTerm()"
                  (ngModelChange)="searchTerm.set($event)"
                  (input)="currentPage.set(1)"
                />
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <p-select
                  [options]="estadoOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Todos los estados"
                  [ngModel]="filtroEstado()"
                  (ngModelChange)="filtroEstado.set($event); currentPage.set(1)"
                  styleClass="w-full sm:w-48"
                  data-llm-description="filter promotions by status"
                />
              </div>
            </div>
          </div>

          <div class="p-6">
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
                <p class="text-xs mt-1 mb-4" style="color: var(--text-muted)">
                  Intenta cambiar los términos de búsqueda o filtros.
                </p>
                <button
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style="color: var(--ds-brand); background: color-mix(in srgb, var(--ds-brand) 8%, transparent);"
                  (click)="limpiarFiltros()"
                  data-llm-action="limpiar-filtros-promociones"
                >
                  <app-icon name="filter-x" [size]="16" />
                  Limpiar Filtros
                </button>
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
                class="flex items-center justify-between mt-6 pt-6"
                style="border-top: 1px solid var(--border-subtle);"
              >
                <p class="text-xs" style="color: var(--text-muted)">
                  Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de
                  {{ filteredPromociones().length }} promociones
                </p>
                <div class="flex items-center justify-end flex-wrap gap-2">
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
      </div>
    </div>
  `,
  styles: `
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
export class AdminProfesionalPromocionesComponent implements OnInit, OnDestroy, AfterViewInit {
  protected readonly facade = inject(PromocionesFacade);
  private readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild('heroRef', { read: ElementRef });
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();

    if (hero) this.gsap.animateHero(hero.nativeElement);
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  protected limpiarFiltros(): void {
    this.searchTerm.set('');
    this.filtroEstado.set(null);
    this.currentPage.set(1);
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

  readonly estadoOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Planificada', value: 'planned' },
    { label: 'En curso', value: 'in_progress' },
    { label: 'Cancelada', value: 'cancelled' },
  ];
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
