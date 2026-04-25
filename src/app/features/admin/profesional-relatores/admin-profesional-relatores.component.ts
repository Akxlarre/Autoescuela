import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BranchFacade } from '@core/facades/branch.facade';
import { RelatoresFacade } from '@core/facades/relatores.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { RelatorTableRow } from '@core/models/ui/relator-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SelectModule } from 'primeng/select';
import { AdminRelatorCrearDrawerComponent } from './admin-relator-crear-drawer.component';
import { AdminRelatorVerDrawerComponent } from './admin-relator-ver-drawer.component';
import { AdminRelatorEditarDrawerComponent } from './admin-relator-editar-drawer.component';

@Component({
  selector: 'app-admin-profesional-relatores',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
        title="Gestión de Relatores"
        subtitle="Administración de instructores teóricos para cursos profesionales"
        [actions]="heroActions()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── KPI Cards ──────────────────────────────────────────────────────── -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Total Relatores"
          [value]="facade.totalRelatores()"
          icon="users"
          [loading]="facade.isLoading()"
          data-llm-description="Total de relatores registrados"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Activos"
          [value]="facade.activos()"
          icon="check-circle"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Relatores en estado activo"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Inactivos"
          [value]="facade.inactivos()"
          icon="user-x"
          [loading]="facade.isLoading()"
          data-llm-description="Relatores en estado inactivo"
        />
      </div>
      <!-- TODO: conectar facade.cursosHoy() cuando esté disponible en RelatoresFacade -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Cursos hoy"
          [value]="0"
          icon="calendar"
          [loading]="facade.isLoading()"
          data-llm-description="Cursos dictados hoy por relatores"
        />
      </div>

      <!-- ── Main Content ───────────────────────────────────────────────────── -->
      <!-- ── Main Content ───────────────────────────────────────────────────── -->
      <div class="bento-banner flex flex-col gap-6">
        <div class="card p-0 flex flex-col min-h-[400px] overflow-hidden">
          <div
            class="p-4 lg:px-6 lg:py-4 flex flex-col gap-4 border-b"
            style="border-color: var(--border-muted); background: var(--bg-surface)"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold" style="color: var(--text-primary)">
                Lista de Relatores
              </h2>
              <span class="text-xs" style="color: var(--text-muted)">
                {{ filteredRelatores().length }} relatores encontrados
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
                  placeholder="Buscar por nombre, rut o especialidad..."
                  class="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg transition-colors focus:outline-none bg-base hover:border-text-muted focus:border-brand"
                  style="border: 1px solid var(--border-muted); color: var(--text-primary);"
                  [ngModel]="searchTerm()"
                  (ngModelChange)="searchTerm.set($event)"
                  (input)="currentPage.set(1)"
                />
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <p-select
                  [options]="especialidadOptions"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="filtroEspecialidad()"
                  (ngModelChange)="filtroEspecialidad.set($event); currentPage.set(1)"
                  styleClass="w-full sm:w-56"
                  data-llm-description="filter lecturers by specialty"
                />
                <p-select
                  [options]="estadoOptions"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="filtroEstado()"
                  (ngModelChange)="filtroEstado.set($event); currentPage.set(1)"
                  styleClass="w-full sm:w-44"
                  data-llm-description="filter lecturers by status"
                />
              </div>
            </div>
          </div>

          <div class="p-6">
            @if (facade.isLoading()) {
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                @for (_ of [1, 2, 3, 4, 5, 6]; track $index) {
                  <div class="p-4 rounded-xl border border-[var(--border-subtle)]">
                    <div class="flex items-center gap-3 mb-4">
                      <app-skeleton-block variant="circle" width="40px" height="40px" />
                      <div class="flex-1 flex flex-col gap-2">
                        <app-skeleton-block variant="text" width="120px" height="13px" />
                        <app-skeleton-block variant="text" width="80px" height="11px" />
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <app-skeleton-block variant="rect" width="30px" height="18px" />
                      <app-skeleton-block variant="rect" width="30px" height="18px" />
                    </div>
                  </div>
                }
              </div>
            } @else if (paginatedRelatores().length === 0) {
              <div class="flex-1 flex flex-col items-center justify-center py-14 text-center">
                <app-icon name="users" [size]="40" color="var(--text-muted)" class="mb-3" />
                <p class="text-sm font-medium" style="color: var(--text-primary)">
                  No se encontraron relatores
                </p>
                <p class="text-xs mt-1 mb-4" style="color: var(--text-muted)">
                  Intenta cambiar los términos de búsqueda o filtros.
                </p>
                <button
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style="color: var(--ds-brand); background: color-mix(in srgb, var(--ds-brand) 8%, transparent);"
                  (click)="limpiarFiltros()"
                  data-llm-action="limpiar-filtros-relatores"
                >
                  <app-icon name="filter-x" [size]="16" />
                  Limpiar Filtros
                </button>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                @for (rel of paginatedRelatores(); track rel.id) {
                  <div
                    class="relator-card p-4 rounded-xl border border-[var(--border-subtle)] relative"
                  >
                    <!-- Status Badge -->
                    <div class="absolute top-4 right-4">
                      @if (rel.estado === 'activo') {
                        <span
                          class="flex w-2 h-2 rounded-full"
                          style="background: var(--state-success)"
                          title="Activo"
                        ></span>
                      } @else {
                        <span
                          class="flex w-2 h-2 rounded-full"
                          style="background: var(--text-muted)"
                          title="Inactivo"
                        ></span>
                      }
                    </div>

                    <div class="flex items-start gap-3 mb-4">
                      <!-- Avatar -->
                      <div
                        class="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-xs font-bold"
                        style="background: var(--color-primary-tint); color: var(--color-primary);"
                      >
                        {{ rel.initials }}
                      </div>

                      <div class="flex-1 min-w-0">
                        <h3
                          class="text-sm font-semibold truncate"
                          style="color: var(--text-primary)"
                        >
                          {{ rel.nombre }}
                        </h3>
                        <p class="text-xs" style="color: var(--text-muted)">{{ rel.rut }}</p>
                      </div>
                    </div>

                    <!-- Especialidades -->
                    <div class="flex flex-wrap gap-1.5 mb-4 max-h-[50px] overflow-hidden">
                      @for (spec of rel.specializations; track spec) {
                        <span class="spec-badge" [style.background]="getSpecColor(spec)">
                          {{ spec }}
                        </span>
                      }
                    </div>

                    <!-- Footer Acciones -->
                    <div
                      class="flex items-center justify-between pt-3"
                      style="border-top: 1px dashed var(--border-subtle)"
                    >
                      <div class="flex items-center gap-3">
                        <div class="flex flex-col">
                          <span
                            class="text-[10px] uppercase font-bold"
                            style="color: var(--text-muted)"
                            >WhatsApp</span
                          >
                          <span class="text-xs font-medium" style="color: var(--text-primary)">{{
                            rel.phone || '—'
                          }}</span>
                        </div>
                      </div>

                      <div class="flex items-center gap-1">
                        <button
                          class="action-btn"
                          title="Ver detalle"
                          (click)="openVerDrawer(rel)"
                          data-llm-action="ver-relator"
                        >
                          <app-icon name="eye" [size]="15" />
                        </button>
                        <button
                          class="action-btn"
                          title="Editar relator"
                          (click)="openEditarDrawer(rel)"
                          data-llm-action="editar-relator"
                        >
                          <app-icon name="edit" [size]="15" />
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Paginación -->
            @if (!facade.isLoading() && filteredRelatores().length > 0) {
              <div
                class="flex items-center justify-between mt-6 pt-6"
                style="border-top: 1px solid var(--border-subtle);"
              >
                <p class="text-xs" style="color: var(--text-muted)">
                  Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de
                  {{ filteredRelatores().length }} relatores
                </p>
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <button
                    class="pagination-btn"
                    [disabled]="currentPage() === 1"
                    (click)="currentPage.set(currentPage() - 1)"
                    data-llm-action="pagina-anterior-relatores"
                  >
                    Anterior
                  </button>
                  <button
                    class="pagination-btn"
                    [disabled]="currentPage() >= totalPages()"
                    (click)="currentPage.set(currentPage() + 1)"
                    data-llm-action="pagina-siguiente-relatores"
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
    .relator-card {
      background: var(--bg-base);
      transition: all var(--duration-fast);
      cursor: default;
    }
    .relator-card:hover {
      border-color: var(--ds-brand);
      box-shadow: var(--shadow-sm);
      transform: translateY(-2px);
    }

    .spec-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: white;
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
export class AdminProfesionalRelatoresComponent implements OnInit, OnDestroy, AfterViewInit {
  protected readonly facade = inject(RelatoresFacade);
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

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Nuevo Relator', icon: 'plus', primary: true },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') {
      this.layoutDrawer.open(AdminRelatorCrearDrawerComponent, 'Nuevo Relator', 'user-plus');
    }
  }

  // ── Filtros locales ────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroEspecialidad = signal('todas');
  protected readonly filtroEstado = signal('todos');

  readonly especialidadOptions = [
    { label: 'Todas las especialidades', value: 'todas' },
    { label: 'Clase A2 (Taxis y colectivos)', value: 'A2' },
    { label: 'Clase A3 (Buses)', value: 'A3' },
    { label: 'Clase A4 (Carga simple)', value: 'A4' },
    { label: 'Clase A5 (Carga profesional)', value: 'A5' },
  ];

  readonly estadoOptions = [
    { label: 'Todos los estados', value: 'todos' },
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
  ];
  protected readonly currentPage = signal(1);
  private readonly pageSize = 9;

  // ── Lista filtrada ─────────────────────────────────────────────────────────
  protected readonly filteredRelatores = computed<RelatorTableRow[]>(() => {
    let results = this.facade.relatores();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (r) =>
          r.nombre.toLowerCase().includes(term) ||
          r.rut.toLowerCase().includes(term) ||
          r.specializations.some((s) => s.toLowerCase().includes(term)),
      );
    }
    const especialidad = this.filtroEspecialidad();
    if (especialidad !== 'todas') {
      results = results.filter((r) => r.specializations.includes(especialidad));
    }
    const estado = this.filtroEstado();
    if (estado !== 'todos') {
      results = results.filter((r) => r.estado === estado);
    }
    return results;
  });

  protected limpiarFiltros(): void {
    this.searchTerm.set('');
    this.filtroEspecialidad.set('todas');
    this.filtroEstado.set('todos');
    this.currentPage.set(1);
  }

  // ── Paginación ─────────────────────────────────────────────────────────────
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRelatores().length / this.pageSize)),
  );

  protected readonly paginatedRelatores = computed<RelatorTableRow[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredRelatores().slice(start, start + this.pageSize);
  });

  protected readonly paginationStart = computed(() => (this.currentPage() - 1) * this.pageSize + 1);

  protected readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredRelatores().length),
  );

  protected getSpecColor(spec: string): string {
    const colors: Record<string, string> = {
      A2: '#3b82f6',
      A3: '#8b5cf6',
      A4: '#f59e0b',
      A5: '#10b981',
    };
    return colors[spec] ?? '#6b7280';
  }

  protected openVerDrawer(rel: RelatorTableRow): void {
    this.facade.selectRelator(rel);
    this.layoutDrawer.open(AdminRelatorVerDrawerComponent, 'Detalle de Relator', 'eye');
  }

  protected openEditarDrawer(rel: RelatorTableRow): void {
    this.facade.selectRelator(rel);
    this.layoutDrawer.open(AdminRelatorEditarDrawerComponent, 'Editar Relator', 'edit');
  }
}
