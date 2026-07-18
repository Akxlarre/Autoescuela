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
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
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
    TableModule,
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
        title="Gestión de Relatores"
        subtitle="Administración de instructores teóricos para cursos profesionales"
        [actions]="heroActions()"
        [kpis]="heroKpis()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Tabla / Tarjetas (Dual-Viewport) ─────────────────────────────── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col w-full h-full dual-viewport-container"
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
              placeholder="Buscar por nombre, rut o especialidad..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              data-llm-description="Search lecturers by name, RUT or specialty"
            />
          </div>

          <p-select
            [options]="especialidadOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las especialidades"
            [ngModel]="filtroEspecialidad()"
            (ngModelChange)="filtroEspecialidad.set($event)"
            class="h-9"
            data-llm-description="filter lecturers by specialty"
          />
          <p-select
            [options]="estadoOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            [ngModel]="filtroEstado()"
            (ngModelChange)="filtroEstado.set($event)"
            class="h-9"
            data-llm-description="filter lecturers by status"
          />

          <span class="text-xs text-text-muted ml-auto">
            {{ filteredRelatores().length }} relatores encontrados
          </span>
        </div>

        <!-- Contenido -->
        @if (facade.isLoading()) {
          <!-- VISTA Desktop: Tabla skeleton (oculta cuando se comprime) -->
          <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full p-4">
            <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
              <app-skeleton-block variant="text" width="24%" height="11px" />
              <app-skeleton-block variant="text" width="14%" height="11px" />
              <app-skeleton-block variant="text" width="18%" height="11px" />
              <app-skeleton-block variant="text" width="14%" height="11px" />
              <app-skeleton-block variant="text" width="10%" height="11px" />
            </div>
            @for (row of [1, 2, 3, 4, 5, 6]; track row) {
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                <div class="flex items-center gap-3 w-[24%]">
                  <app-skeleton-block variant="circle" width="36px" height="36px" />
                  <div class="flex flex-col gap-1.5 flex-1">
                    <app-skeleton-block variant="text" width="75%" height="12px" />
                    <app-skeleton-block variant="text" width="45%" height="10px" />
                  </div>
                </div>
                <app-skeleton-block variant="rect" width="60px" height="20px" />
                <app-skeleton-block variant="text" width="18%" height="12px" />
                <app-skeleton-block variant="rect" width="64px" height="20px" />
                <div class="flex items-center gap-1 ml-auto">
                  <app-skeleton-block variant="circle" width="28px" height="28px" />
                  <app-skeleton-block variant="circle" width="28px" height="28px" />
                </div>
              </div>
            }
          </div>

          <!-- VISTA Mobile: Tarjetas skeleton (visible cuando se comprime) -->
          <div class="mobile-view show-on-squeeze p-4 space-y-4">
            @for (card of [1, 2, 3]; track card) {
              <div class="bg-base border border-border-subtle rounded-xl p-4 space-y-4">
                <div class="flex items-center gap-3">
                  <app-skeleton-block variant="circle" width="36px" height="36px" />
                  <div class="flex flex-col gap-1.5 flex-1">
                    <app-skeleton-block variant="text" width="70%" height="13px" />
                    <app-skeleton-block variant="text" width="45%" height="10px" />
                  </div>
                  <app-skeleton-block variant="rect" width="60px" height="20px" />
                </div>
                <div class="flex gap-1.5">
                  <app-skeleton-block variant="rect" width="30px" height="18px" />
                  <app-skeleton-block variant="rect" width="30px" height="18px" />
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- VISTA Desktop: Tabla clásica (oculta cuando se comprime) -->
          <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
            <p-table
              [value]="filteredRelatores()"
              [rows]="10"
              [paginator]="true"
              [scrollable]="true"
              scrollHeight="flex"
              styleClass="p-datatable-sm h-full flex flex-col"
              [showCurrentPageReport]="true"
              currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} relatores"
            >
              <ng-template pTemplate="header">
                <tr
                  class="bg-subtle text-text-muted uppercase text-xs tracking-wider font-medium text-left"
                >
                  <th class="pl-6 py-4">Relator</th>
                  <th>Especialidades</th>
                  <th>WhatsApp</th>
                  <th>Estado</th>
                  <th class="pr-6 text-right">Acciones</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-rel>
                <tr class="hover:bg-subtle transition-colors border-b border-border-subtle">
                  <!-- Relator -->
                  <td class="pl-6 py-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-9 h-9 rounded-full bg-brand-tint text-brand flex items-center justify-center text-xs font-bold shrink-0"
                      >
                        {{ rel.initials }}
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-bold text-sm text-text-primary truncate">{{
                          rel.nombre
                        }}</span>
                        <span class="text-xs text-text-muted">{{ rel.rut }}</span>
                      </div>
                    </div>
                  </td>
                  <!-- Especialidades -->
                  <td>
                    <div class="flex flex-wrap gap-1.5">
                      @for (spec of rel.specializations; track spec) {
                        <span class="spec-badge" [style.background]="getSpecColor(spec)">
                          {{ spec }}
                        </span>
                      }
                    </div>
                  </td>
                  <!-- WhatsApp -->
                  <td class="text-xs font-medium text-text-secondary">
                    {{ rel.phone || '—' }}
                  </td>
                  <!-- Estado -->
                  <td>
                    <p-tag
                      [value]="rel.estado === 'activo' ? 'Activo' : 'Inactivo'"
                      [severity]="rel.estado === 'activo' ? 'success' : 'secondary'"
                      styleClass="text-xs font-bold px-2 py-0.5"
                    ></p-tag>
                  </td>
                  <!-- Acciones -->
                  <td class="pr-6 text-right">
                    <div class="inline-flex items-center justify-end gap-0.5">
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        pTooltip="Ver detalle"
                        (click)="openVerDrawer(rel)"
                        data-llm-action="ver-relator"
                      >
                        <app-icon name="eye" [size]="16" />
                      </button>
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        pTooltip="Editar relator"
                        (click)="openEditarDrawer(rel)"
                        data-llm-action="editar-relator"
                      >
                        <app-icon name="edit" [size]="16" />
                      </button>
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="5" class="p-0">
                    <app-empty-state
                      icon="users"
                      message="No se encontraron relatores"
                      subtitle="Intenta cambiar los términos de búsqueda o filtros."
                      actionLabel="Limpiar Filtros"
                      actionIcon="filter-x"
                      (action)="limpiarFiltros()"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <!-- VISTA Mobile: Tarjetas apiladas (visible cuando se comprime) -->
          <div class="mobile-view show-on-squeeze p-4 space-y-4 overflow-y-auto">
            @for (rel of filteredRelatores(); track rel.id) {
              <div
                class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm hover:border-brand hover:-translate-y-0.5 transition-all"
              >
                <div
                  class="p-4 border-b border-border-subtle flex items-center justify-between gap-3 bg-subtle"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="w-9 h-9 rounded-full bg-brand-tint text-brand flex items-center justify-center text-xs font-bold shrink-0"
                    >
                      {{ rel.initials }}
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-sm font-bold text-text-primary truncate">{{
                        rel.nombre
                      }}</span>
                      <span class="text-xs text-text-muted truncate">{{ rel.rut }}</span>
                    </div>
                  </div>
                  <p-tag
                    [value]="rel.estado === 'activo' ? 'Activo' : 'Inactivo'"
                    [severity]="rel.estado === 'activo' ? 'success' : 'secondary'"
                    styleClass="text-2xs font-bold px-2 py-0.5 shrink-0"
                  ></p-tag>
                </div>

                <div class="p-4 grid grid-cols-2 gap-4 text-xs">
                  <div class="flex flex-col">
                    <span class="text-text-muted mb-0.5 uppercase tracking-tighter font-bold"
                      >Especialidades</span
                    >
                    <div class="flex flex-wrap gap-1.5">
                      @for (spec of rel.specializations; track spec) {
                        <span class="spec-badge" [style.background]="getSpecColor(spec)">
                          {{ spec }}
                        </span>
                      } @empty {
                        <span class="text-text-muted">—</span>
                      }
                    </div>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-text-muted mb-0.5 uppercase tracking-tighter font-bold"
                      >WhatsApp</span
                    >
                    <span>{{ rel.phone || '—' }}</span>
                  </div>
                </div>

                <div class="p-2 border-t border-border-subtle flex justify-end gap-1">
                  <button
                    class="action-btn"
                    (click)="openVerDrawer(rel)"
                    pTooltip="Ver detalle"
                    data-llm-action="ver-relator"
                  >
                    <app-icon name="eye" [size]="16" />
                  </button>
                  <button
                    class="action-btn"
                    (click)="openEditarDrawer(rel)"
                    pTooltip="Editar relator"
                    data-llm-action="editar-relator"
                  >
                    <app-icon name="edit" [size]="16" />
                  </button>
                </div>
              </div>
            } @empty {
              <app-empty-state
                icon="users"
                message="No se encontraron relatores"
                subtitle="Intenta cambiar los términos de búsqueda o filtros."
                actionLabel="Limpiar Filtros"
                actionIcon="filter-x"
                (action)="limpiarFiltros()"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
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

    /* Container Queries para Dual-Viewport Render */
    .dual-viewport-container {
      container-type: inline-size;
      container-name: relatorContainer;
    }

    .show-on-squeeze {
      display: none;
    }

    @container relatorContainer (max-width: 850px) {
      .hide-on-squeeze {
        display: none !important;
      }
      .show-on-squeeze {
        display: block !important;
      }
    }
  `,
})
export class AdminProfesionalRelatoresComponent implements OnInit, OnDestroy, AfterViewInit {
  protected readonly facade = inject(RelatoresFacade);
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

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Nuevo Relator', icon: 'plus', primary: true },
  ]);

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    { id: 'total', label: 'Total Relatores', value: this.facade.totalRelatores(), icon: 'users' },
    {
      id: 'activos',
      label: 'Activos',
      value: this.facade.activos(),
      icon: 'check-circle',
      color: 'success',
    },
    { id: 'inactivos', label: 'Inactivos', value: this.facade.inactivos(), icon: 'user-x' },
    { id: 'hoy', label: 'Cursos hoy', value: 0, icon: 'calendar' },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') {
      this.layoutDrawer.open(AdminRelatorCrearDrawerComponent, 'Nuevo Relator', 'user-plus');
    }
  }

  // ── Filtros locales ────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroEspecialidad = signal<string | null>(null);
  protected readonly filtroEstado = signal<string | null>(null);

  readonly especialidadOptions = [
    { label: 'Clase A2 (Taxis y colectivos)', value: 'A2' },
    { label: 'Clase A3 (Buses)', value: 'A3' },
    { label: 'Clase A4 (Carga simple)', value: 'A4' },
    { label: 'Clase A5 (Carga profesional)', value: 'A5' },
  ];

  readonly estadoOptions = [
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
  ];

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
    if (especialidad) {
      results = results.filter((r) => r.specializations.includes(especialidad));
    }
    const estado = this.filtroEstado();
    if (estado) {
      results = results.filter((r) => r.estado === estado);
    }
    return results;
  });

  protected limpiarFiltros(): void {
    this.searchTerm.set('');
    this.filtroEspecialidad.set(null);
    this.filtroEstado.set(null);
  }

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
