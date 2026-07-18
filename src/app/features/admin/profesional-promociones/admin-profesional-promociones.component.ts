import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  computed,
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
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
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
    TagModule,
    ButtonModule,
    TooltipModule,
    SectionHeroComponent,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout #bentoGrid>
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Promociones Profesionales"
        subtitle="Programación y gestión de ciclos de cursos Clase Profesional"
        [actions]="heroActions()"
        [kpis]="heroKpis()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Cards ─────────────────────────────────────────────────────────── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col w-full h-full"
        appCardHover
      >
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default">
          <div class="relative flex-1 min-w-52 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="search"
              placeholder="Buscar por nombre o código..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event); currentPage.set(1)"
              data-llm-description="Search promotions by name or code"
            />
          </div>

          <p-select
            [options]="estadoOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            [ngModel]="filtroEstado()"
            (ngModelChange)="filtroEstado.set($event); currentPage.set(1)"
            class="h-9"
            data-llm-description="filter promotions by status"
          />

          <span class="text-xs text-text-muted ml-auto">
            {{ filteredPromociones().length }} promociones encontradas
          </span>
        </div>

        <!-- Contenido -->
        @if (facade.isLoading()) {
          <div class="p-4 lg:p-5 flex-1 min-h-0 overflow-y-auto">
            <div class="bento-grid promo-grid">
              @for (_ of [1, 2, 3, 4, 5, 6]; track $index) {
                <div
                  class="p-4 rounded-xl border border-(--border-subtle) bento-wide"
                  data-col-span="4"
                >
                  <div class="flex items-center gap-3 mb-4">
                    <app-skeleton-block variant="circle" width="40px" height="40px" />
                    <div class="flex-1 flex flex-col gap-2">
                      <app-skeleton-block variant="text" width="70%" height="13px" />
                      <app-skeleton-block variant="text" width="40%" height="11px" />
                    </div>
                    <app-skeleton-block variant="rect" width="60px" height="20px" />
                  </div>
                  <app-skeleton-block variant="text" width="90%" height="11px" class="mb-3" />
                  <div class="flex flex-wrap gap-2">
                    <app-skeleton-block variant="rect" width="30px" height="18px" />
                    <app-skeleton-block variant="rect" width="30px" height="18px" />
                  </div>
                </div>
              }
            </div>
          </div>
        } @else if (filteredPromociones().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center">
            <app-empty-state
              icon="calendar-x"
              message="No se encontraron promociones"
              subtitle="Intenta cambiar los términos de búsqueda o filtros."
              actionLabel="Limpiar Filtros"
              actionIcon="filter-x"
              (action)="limpiarFiltros()"
            />
          </div>
        } @else {
          <div class="p-4 lg:p-5 flex-1 min-h-0 overflow-y-auto">
            <div class="bento-grid promo-grid">
              @for (promo of paginatedPromociones(); track promo.id) {
                <div
                  class="promo-card p-4 rounded-xl border border-(--border-subtle) relative bento-wide"
                  data-col-span="4"
                >
                  <!-- Header: icono + nombre/código + estado -->
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class="w-10 h-10 rounded-full bg-brand-tint text-brand flex items-center justify-center shrink-0"
                      >
                        <app-icon name="calendar" [size]="18" />
                      </div>
                      <div class="flex flex-col min-w-0">
                        <h3 class="text-sm font-semibold truncate text-text-primary">
                          {{ promo.name }}
                        </h3>
                        <span class="text-xs font-mono text-text-muted">{{ promo.code }}</span>
                      </div>
                    </div>
                    <p-tag
                      [value]="statusLabel(promo.status)"
                      [severity]="statusSeverity(promo.status)"
                      styleClass="text-2xs font-bold px-2 py-0.5 shrink-0"
                    ></p-tag>
                  </div>

                  <!-- Meta: fechas + alumnos -->
                  <div class="flex items-center gap-4 flex-wrap mb-3">
                    <span class="flex items-center gap-1.5 text-xs text-text-muted">
                      <app-icon name="calendar" [size]="12" />
                      {{ promo.startDate | date: 'dd/MM/yyyy' }} →
                      {{ promo.endDate | date: 'dd/MM/yyyy' }}
                    </span>
                    <span class="flex items-center gap-1.5 text-xs text-text-secondary">
                      <app-icon name="users" [size]="12" />
                      {{ promo.totalEnrolled }} / {{ promo.maxStudents }} alumnos
                    </span>
                  </div>

                  <!-- Cursos -->
                  <div class="flex flex-wrap gap-1.5 mb-3">
                    @for (curso of promo.cursos; track curso.id) {
                      <span
                        class="course-badge"
                        [style.background]="getCourseColor(curso.courseCode)"
                        [pTooltip]="
                          curso.courseName +
                          ': ' +
                          curso.enrolledStudents +
                          '/' +
                          curso.maxStudents +
                          ' alumnos'
                        "
                      >
                        {{ curso.courseCode }}
                      </span>
                    }
                  </div>

                  <!-- Footer: acciones -->
                  <div
                    class="flex items-center justify-between pt-3"
                    style="border-top: 1px dashed var(--border-subtle)"
                  >
                    <span class="text-2xs uppercase font-bold text-text-muted">
                      {{ promo.cursos.length }} curso(s)
                    </span>
                    <div class="inline-flex items-center gap-0.5">
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        pTooltip="Ver detalle"
                        (click)="openVerDrawer(promo)"
                        data-llm-action="ver-promocion"
                      >
                        <app-icon name="eye" [size]="16" />
                      </button>
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        pTooltip="Editar promoción"
                        (click)="openEditarDrawer(promo)"
                        data-llm-action="editar-promocion"
                      >
                        <app-icon name="edit" [size]="16" />
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Paginación -->
            @if (filteredPromociones().length > 0) {
              <div
                class="flex items-center justify-between mt-4 pt-4"
                style="border-top: 1px solid var(--border-subtle);"
              >
                <p class="text-xs text-text-muted">
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
        }
      </div>
    </div>
  `,
  styles: `
    .promo-grid {
      gap: var(--space-4);
    }

    .promo-card {
      background: var(--bg-base);
      transition: all var(--duration-fast);
      cursor: default;
    }
    .promo-card:hover {
      border-color: var(--ds-brand);
      box-shadow: var(--shadow-sm);
      transform: translateY(-2px);
    }

    .course-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: white;
      cursor: default;
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

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
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

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Total Promociones',
      value: this.facade.totalPromociones(),
      icon: 'calendar',
    },
    {
      id: 'en-curso',
      label: 'En curso',
      value: this.facade.enCurso(),
      icon: 'play-circle',
      color: 'success',
    },
    { id: 'planificadas', label: 'Planificadas', value: this.facade.planificadas(), icon: 'clock' },
    {
      id: 'canceladas',
      label: 'Canceladas',
      value: this.facade.canceladas(),
      icon: 'ban',
      color: 'warning',
    },
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
  private readonly pageSize = 6;

  readonly estadoOptions = [
    { label: 'Planificada', value: 'planned' },
    { label: 'En curso', value: 'in_progress' },
    { label: 'Finalizada', value: 'finished' },
    { label: 'Cancelada', value: 'cancelled' },
  ];

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

  protected statusSeverity(
    status: string,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | undefined {
    switch (status) {
      case 'planned':
        return 'warn';
      case 'in_progress':
        return 'success';
      case 'finished':
        return 'info';
      case 'cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
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
