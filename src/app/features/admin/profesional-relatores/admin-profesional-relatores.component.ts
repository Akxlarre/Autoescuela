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
import { RelatoresFacade } from '@core/facades/relatores.facade';
import { AdminRelatorCrearDrawerComponent } from './admin-relator-crear-drawer.component';
import { AdminRelatorVerDrawerComponent } from './admin-relator-ver-drawer.component';
import { AdminRelatorEditarDrawerComponent } from './admin-relator-editar-drawer.component';
import type { RelatorTableRow } from '@core/models/ui/relator-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';

const SPEC_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

@Component({
  selector: 'app-admin-profesional-relatores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
    DrawerComponent,
    AdminRelatorCrearDrawerComponent,
    AdminRelatorVerDrawerComponent,
    AdminRelatorEditarDrawerComponent,
  ],
  template: `
    <div class="page-wide">
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <div class="mb-6">
        <app-section-hero
          title="Gestión de Relatores"
          subtitle="Relatores para cursos profesionales A2, A3, A4, A5"
          [actions]="heroActions()"
          (actionClick)="handleHeroAction($event)"
        />
      </div>

      <!-- ── KPI Cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-kpi-card-variant
          label="Total Relatores"
          [value]="facade.totalRelatores()"
          icon="users"
          [loading]="facade.isLoading()"
          data-llm-description="Total de relatores registrados"
        />
        <app-kpi-card-variant
          label="Activos"
          [value]="facade.activos()"
          icon="check-circle"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Relatores activos"
        />
        <app-kpi-card-variant
          label="Especialidad A2"
          [value]="kpiA2()"
          icon="graduation-cap"
          [loading]="facade.isLoading()"
          data-llm-description="Relatores con especialidad A2"
        />
        <app-kpi-card-variant
          label="Especialidad A3"
          [value]="kpiA3()"
          icon="graduation-cap"
          [loading]="facade.isLoading()"
          data-llm-description="Relatores con especialidad A3"
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
            placeholder="Buscar por nombre o RUT..."
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            data-llm-description="Buscar relator por nombre o RUT"
          />
        </div>

        <div class="flex items-center gap-2">
          <p-select
            [options]="especialidadOptions"
            [(ngModel)]="filtroEspecialidadModel"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las especialidades"
            [style]="{ height: '40px' }"
            aria-label="Filtrar por especialidad"
            data-llm-description="Filtro de relatores por especialidad"
          />
          <p-select
            [options]="estadoOptions"
            [(ngModel)]="filtroEstadoModel"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            [style]="{ height: '40px' }"
            aria-label="Filtrar por estado"
            data-llm-description="Filtro de relatores por estado"
          />
        </div>
      </div>

      <!-- ── Content (List + Sidebar) ───────────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <!-- Lista de Relatores -->
        <div class="card p-6 flex flex-col">
          <h2 class="text-base font-semibold mb-4" style="color: var(--text-primary)">
            Lista de Relatores
          </h2>

          @if (facade.isLoading()) {
            @for (_ of skeletonRows; track $index) {
              <div
                class="flex items-center gap-4 py-4"
                style="border-bottom: 1px solid var(--border-subtle);"
              >
                <app-skeleton-block variant="circle" width="40px" height="40px" />
                <div class="flex-1 flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="200px" height="14px" />
                  <app-skeleton-block variant="text" width="160px" height="12px" />
                </div>
                <app-skeleton-block variant="rect" width="80px" height="24px" />
                <app-skeleton-block variant="rect" width="60px" height="24px" />
              </div>
            }
          } @else if (paginatedRelatores().length === 0) {
            <div class="py-14 text-center">
              <div class="flex flex-col items-center gap-2">
                <app-icon name="users" [size]="36" />
                <p class="text-sm mt-1" style="color: var(--text-muted)">
                  No hay relatores que coincidan con los filtros.
                </p>
              </div>
            </div>
          } @else {
            @for (rel of paginatedRelatores(); track rel.id) {
              <div
                class="relator-row flex items-center gap-4 py-4"
                style="border-bottom: 1px solid var(--border-subtle);"
              >
                <!-- Avatar -->
                <div
                  class="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold"
                  style="background: var(--color-primary-tint); color: var(--color-primary);"
                >
                  {{ rel.initials }}
                </div>

                <!-- Info principal -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold" style="color: var(--text-primary)">
                      {{ rel.nombre }}
                    </span>

                    @for (spec of rel.specializations; track spec) {
                      <span class="spec-badge" [style.background]="specColor(spec)">
                        {{ spec }}
                      </span>
                    }

                    @if (rel.estado === 'activo') {
                      <span
                        class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style="background: color-mix(in srgb, var(--state-success) 12%, transparent); color: var(--state-success);"
                      >
                        <app-icon name="check-circle" [size]="10" />
                        Activo
                      </span>
                    } @else {
                      <span
                        class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style="background: var(--bg-elevated); color: var(--text-muted);"
                      >
                        Inactivo
                      </span>
                    }
                  </div>

                  <div class="flex items-center gap-3 mt-1 flex-wrap">
                    <span class="text-xs" style="color: var(--text-muted)">{{ rel.rut }}</span>
                    @if (rel.email) {
                      <a
                        class="text-xs"
                        style="color: var(--ds-brand); text-decoration: none;"
                        [href]="'mailto:' + rel.email"
                      >
                        {{ rel.email }}
                      </a>
                    }
                  </div>
                </div>

                <!-- Acciones -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    class="action-btn"
                    title="Ver detalle"
                    (click)="openVerDrawer(rel)"
                    data-llm-action="ver-relator"
                  >
                    <app-icon name="eye" [size]="16" />
                  </button>
                  <button
                    class="action-btn"
                    title="Editar relator"
                    (click)="openEditarDrawer(rel)"
                    data-llm-action="editar-relator"
                  >
                    <app-icon name="edit" [size]="16" />
                  </button>
                </div>
              </div>
            }
          }

          <!-- Paginación -->
          @if (!facade.isLoading() && filteredRelatores().length > 0) {
            <div
              class="flex items-center justify-between pt-4 mt-auto"
              style="border-top: 1px solid var(--border-subtle);"
            >
              <p class="text-xs" style="color: var(--text-muted)">
                Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de
                {{ filteredRelatores().length }} relatores
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

        <!-- Sidebar -->
        <div class="flex flex-col gap-6">
          <!-- Especialidades -->
          <div class="card p-5">
            <h3 class="text-sm font-semibold mb-4" style="color: var(--text-primary)">
              Especialidades Profesionales
            </h3>
            <div class="flex flex-col gap-2">
              @for (spec of specializations; track spec.value) {
                <div
                  class="rounded-lg p-3"
                  style="border: 1px solid var(--border-subtle); background: var(--bg-elevated);"
                >
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="spec-badge" [style.background]="spec.color">{{ spec.value }}</span>
                    <span class="text-sm font-semibold" style="color: var(--text-primary)">
                      {{ spec.label }}
                    </span>
                  </div>
                  <p class="text-xs" style="color: var(--text-muted); padding-left: 36px">
                    {{ spec.description }}
                  </p>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Drawer: Crear ──────────────────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="crearDrawerOpen()"
      title="Nuevo Relator"
      icon="user-plus"
      (closed)="onCrearDrawerClosed()"
    >
      <app-admin-relator-crear-drawer (closed)="onCrearDrawerClosed()" />
    </app-drawer>

    <!-- ── Drawer: Ver ────────────────────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="verDrawerOpen()"
      title="Detalle de Relator"
      icon="eye"
      (closed)="verDrawerOpen.set(false)"
    >
      <app-admin-relator-ver-drawer (editarClicked)="switchToEditar()" />
    </app-drawer>

    <!-- ── Drawer: Editar ─────────────────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="editarDrawerOpen()"
      title="Editar Relator"
      icon="edit"
      (closed)="editarDrawerOpen.set(false)"
    >
      <app-admin-relator-editar-drawer (saved)="editarDrawerOpen.set(false)" />
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

    .spec-badge {
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

    .relator-row {
      transition: background var(--duration-fast);
    }
    .relator-row:hover {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
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
export class AdminProfesionalRelatoresComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(RelatoresFacade);
  private readonly branchFacade = inject(BranchFacade);

  // ── Hero ────────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Nuevo Relator', icon: 'plus', primary: true },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') this.crearDrawerOpen.set(true);
  }

  // ── Drawers ─────────────────────────────────────────────────────────────────
  protected readonly crearDrawerOpen = signal(false);
  protected readonly verDrawerOpen = signal(false);
  protected readonly editarDrawerOpen = signal(false);

  // ── Filtros ─────────────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroEspecialidad = signal<string | null>(null);
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly currentPage = signal(1);
  private readonly pageSize = 10;

  // ── KPIs adicionales ────────────────────────────────────────────────────────
  protected readonly kpiA2 = computed(
    () => this.facade.relatores().filter((r) => r.specializations.includes('A2')).length,
  );
  protected readonly kpiA3 = computed(
    () => this.facade.relatores().filter((r) => r.specializations.includes('A3')).length,
  );

  // ── Lista filtrada ──────────────────────────────────────────────────────────
  protected readonly filteredRelatores = computed<RelatorTableRow[]>(() => {
    let results = this.facade.relatores();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (r) => r.nombre.toLowerCase().includes(term) || r.rut.toLowerCase().includes(term),
      );
    }
    if (this.filtroEspecialidad()) {
      results = results.filter((r) => r.specializations.includes(this.filtroEspecialidad()!));
    }
    if (this.filtroEstado()) {
      results = results.filter((r) => r.estado === this.filtroEstado());
    }
    return results;
  });

  // ── Paginación ──────────────────────────────────────────────────────────────
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

  // ── Opciones filtros ────────────────────────────────────────────────────────
  protected readonly especialidadOptions = [
    { label: 'Todas las especialidades', value: null },
    { label: 'A2 — Taxis y colectivos', value: 'A2' },
    { label: 'A3 — Buses', value: 'A3' },
    { label: 'A4 — Carga simple', value: 'A4' },
    { label: 'A5 — Carga profesional', value: 'A5' },
  ];

  protected readonly estadoOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
  ];

  protected get filtroEspecialidadModel(): string | null {
    return this.filtroEspecialidad();
  }
  protected set filtroEspecialidadModel(v: string | null) {
    this.filtroEspecialidad.set(v);
    this.currentPage.set(1);
  }

  protected get filtroEstadoModel(): string | null {
    return this.filtroEstado();
  }
  protected set filtroEstadoModel(v: string | null) {
    this.filtroEstado.set(v);
    this.currentPage.set(1);
  }

  // ── Datos estáticos sidebar ─────────────────────────────────────────────────
  protected readonly specializations = [
    {
      value: 'A2',
      label: 'A2 - Taxis y colectivos',
      description: 'Transporte menor de pasajeros',
      color: SPEC_COLORS['A2'],
    },
    {
      value: 'A3',
      label: 'A3 - Buses',
      description: 'Transporte mayor de pasajeros',
      color: SPEC_COLORS['A3'],
    },
    {
      value: 'A4',
      label: 'A4 - Carga simple',
      description: 'Transporte de carga simple',
      color: SPEC_COLORS['A4'],
    },
    {
      value: 'A5',
      label: 'A5 - Carga',
      description: 'Transporte de carga profesional',
      color: SPEC_COLORS['A5'],
    },
  ];

  protected readonly skeletonRows = [1, 2, 3, 4];

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  protected specColor(spec: string): string {
    return SPEC_COLORS[spec] ?? '#6b7280';
  }

  protected openVerDrawer(rel: RelatorTableRow): void {
    this.facade.selectRelator(rel);
    this.verDrawerOpen.set(true);
  }

  protected openEditarDrawer(rel: RelatorTableRow): void {
    this.facade.selectRelator(rel);
    this.editarDrawerOpen.set(true);
  }

  protected onCrearDrawerClosed(): void {
    this.crearDrawerOpen.set(false);
  }

  protected switchToEditar(): void {
    this.verDrawerOpen.set(false);
    this.editarDrawerOpen.set(true);
  }
}
