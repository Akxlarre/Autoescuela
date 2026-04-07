import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RelatoresFacade } from '@core/facades/relatores.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { RelatorTableRow } from '@core/models/ui/relator-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AdminRelatorCrearDrawerComponent } from './admin-relator-crear-drawer.component';
import { AdminRelatorVerDrawerComponent } from './admin-relator-ver-drawer.component';
import { AdminRelatorEditarDrawerComponent } from './admin-relator-editar-drawer.component';

@Component({
  selector: 'app-admin-profesional-relatores',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
          title="Gestión de Relatores"
          subtitle="Administración de instructores teóricos para cursos profesionales"
          [actions]="heroActions()"
          (actionClick)="handleHeroAction($event)"
        />
      </div>

      <!-- ── KPI Cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-4 gap-4 mb-6">
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
          data-llm-description="Relatores en estado activo"
        />
        <app-kpi-card-variant
          label="Inactivos"
          [value]="facade.inactivos()"
          icon="user-x"
          [loading]="facade.isLoading()"
          data-llm-description="Relatores en estado inactivo"
        />
        <app-kpi-card-variant
          label="Cursos hoy"
          [value]="0"
          icon="calendar"
          [loading]="facade.isLoading()"
          data-llm-description="Cursos dictados hoy por relatores"
        />
      </div>

      <!-- ── Search + Filters ───────────────────────────────────────────────── -->
      <div class="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <!-- Buscador -->
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
            placeholder="Buscar por nombre, rut o especialidad..."
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            data-llm-description="Buscar relator por nombre, rut o especialidad"
          />
        </div>

        <!-- Filtros rápidos -->
        <div class="flex items-center gap-2">
          <select
            class="filter-select"
            [ngModel]="filtroEstado()"
            (ngModelChange)="filtroEstado.set($event)"
            aria-label="Filtrar por estado"
            data-llm-description="Filtro de relatores por estado"
          >
            <option [value]="null">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      <!-- ── Content (Grid de Relatores) ────────────────────────────────────── -->
      <div class="card p-6 flex flex-col min-h-[400px]">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold" style="color: var(--text-primary)">
            Lista de Relatores
          </h2>
          <span class="text-xs" style="color: var(--text-muted)">
            {{ filteredRelatores().length }} relatores encontrados
          </span>
        </div>

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
            <p class="text-xs mt-1" style="color: var(--text-muted)">
              Intenta cambiar los términos de búsqueda o filtros.
            </p>
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
                    <h3 class="text-sm font-semibold truncate" style="color: var(--text-primary)">
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
                      <span class="text-[10px] uppercase font-bold" style="color: var(--text-muted)"
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
            class="flex items-center justify-between pt-6 mt-6"
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
export class AdminProfesionalRelatoresComponent {
  protected readonly facade = inject(RelatoresFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    this.facade.initialize();
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
  protected readonly filtroEstado = signal<string | null>(null);
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
    if (this.filtroEstado()) {
      results = results.filter((r) => r.estado === this.filtroEstado());
    }
    return results;
  });

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
