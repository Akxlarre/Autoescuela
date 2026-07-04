import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { SecretariasFacade } from '@core/facades/secretarias.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminSecretariasCrearDrawerComponent } from './admin-secretarias-crear-drawer.component';
import { AdminSecretariasVerDrawerComponent } from './admin-secretarias-ver-drawer.component';
import { AdminSecretariasEditarDrawerComponent } from './admin-secretarias-editar-drawer.component';
import type { SecretariaTableRow } from '@core/models/ui/secretaria-table.model';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

@Component({
  selector: 'app-admin-secretarias',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    IconComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid style="--bento-row-min: 125px;">
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Gestión de Secretarias"
        subtitle="Control de acceso y gestión de personal de secretaría"
        [actions]="heroActions()"
        [kpis]="heroKpis()"
        (actionClick)="handleHeroAction($event)"
      />

      @if (facade.isLoading()) {
        <!-- Content Skeleton -->
        <div class="bento-wide" data-col-span="9">
          <div class="card p-6 h-full">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <app-skeleton-block variant="text" width="180px" height="20px" />
              <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <app-skeleton-block
                  variant="rect"
                  width="100%"
                  height="36px"
                  class="md:w-[200px]"
                />
                <app-skeleton-block
                  variant="rect"
                  width="100%"
                  height="36px"
                  class="sm:w-[120px]"
                />
                <app-skeleton-block
                  variant="rect"
                  width="100%"
                  height="36px"
                  class="sm:w-[120px]"
                />
              </div>
            </div>

            @for (_ of skeletonRows; track $index) {
              <div
                class="flex items-center gap-4 py-4"
                style="border-bottom: 1px solid var(--border-subtle);"
              >
                <app-skeleton-block variant="circle" width="40px" height="40px" />
                <div class="flex-1 flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="180px" height="14px" />
                  <app-skeleton-block variant="text" width="240px" height="12px" />
                </div>
                <app-skeleton-block variant="rect" width="60px" height="24px" />
              </div>
            }
          </div>
        </div>

        <div class="bento-tall" data-col-span="3">
          <div class="card p-6 h-full">
            <app-skeleton-block variant="text" width="150px" height="18px" class="mb-4" />
            <app-skeleton-block variant="rect" width="100%" height="80px" class="mb-4" />
            @for (_ of [1, 2, 3, 4]; track $index) {
              <app-skeleton-block variant="text" width="100%" height="12px" class="mb-3" />
            }
          </div>
        </div>
      } @else {
        <!-- ── Active View ──────────────────────────────────────────────────── -->

        <!-- Lista de Secretarias -->
        <div class="bento-wide" data-col-span="9">
          <div class="card p-6 flex flex-col h-full" appCardHover>
            <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-6">
              <h2 class="text-base font-bold whitespace-nowrap text-text-primary">
                Lista de Personal
              </h2>

              <!-- Search + Filters (Fully Responsive) -->
              <div
                class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto"
              >
                <div class="relative flex-1 min-w-[200px]">
                  <span
                    class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
                  >
                    <app-icon name="search" [size]="14" />
                  </span>
                  <input
                    type="text"
                    class="w-full h-9 pl-9 pr-3 rounded-md border border-border-subtle bg-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                    placeholder="Buscar por nombre o email..."
                    [ngModel]="searchTerm()"
                    (ngModelChange)="searchTerm.set($event)"
                  />
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <p-select
                    [options]="sedeOptions()"
                    [(ngModel)]="filtroSedeModel"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Sede"
                    appendTo="body"
                    [style]="{ flex: '1', 'min-width': '120px', height: '36px' }"
                    class="flex-1 sm:flex-none"
                  />
                  <p-select
                    [options]="estadoOptions"
                    [(ngModel)]="filtroEstadoModel"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Estado"
                    appendTo="body"
                    [style]="{ flex: '1', 'min-width': '120px', height: '36px' }"
                    class="flex-1 sm:flex-none"
                  />
                </div>
              </div>
            </div>

            <div class="flex-1">
              @if (paginatedSecretarias().length === 0) {
                <div class="py-14 text-center">
                  <div class="flex flex-col items-center gap-2">
                    <app-icon name="users" [size]="36" />
                    <p class="text-sm mt-1 text-text-muted">
                      No hay registros que coincidan con los filtros.
                    </p>
                  </div>
                </div>
              } @else {
                <div class="flex flex-col">
                  @for (sec of paginatedSecretarias(); track sec.id) {
                    <div
                      class="secretaria-row flex items-center gap-4 py-4"
                      style="border-bottom: 1px solid var(--border-subtle);"
                    >
                      <!-- Avatar -->
                      <div
                        class="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold bg-brand-tint text-brand"
                      >
                        {{ sec.initials }}
                      </div>

                      <!-- Info principal -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-sm font-semibold truncate text-text-primary">
                            {{ sec.nombre }}
                          </span>

                          <!-- Badge estado -->
                          @if (sec.estado === 'activa') {
                            <span
                              class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-success bg-success/10"
                            >
                              <app-icon name="check" [size]="8" />
                              Activa
                            </span>
                          } @else {
                            <span
                              class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-subtle text-text-muted"
                            >
                              Inactiva
                            </span>
                          }
                        </div>

                        <div class="flex items-center gap-3 mt-1 flex-wrap">
                          <span class="text-xs text-brand">
                            {{ sec.email }}
                          </span>
                          <span class="flex items-center gap-1 text-xs text-text-muted">
                            <app-icon name="map-pin" [size]="11" />
                            {{ sec.sede }}
                          </span>
                        </div>
                      </div>

                      <!-- Acciones -->
                      <div class="flex items-center gap-2 shrink-0">
                        <button class="action-btn" title="Ver detalle" (click)="openVerDrawer(sec)">
                          <app-icon name="eye" [size]="15" />
                        </button>
                        <button class="action-btn" title="Editar" (click)="openEditarDrawer(sec)">
                          <app-icon name="pencil" [size]="15" />
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Paginación -->
            @if (filteredSecretarias().length > 0) {
              <div
                class="flex items-center justify-between pt-5 mt-auto"
                style="border-top: 1px solid var(--border-subtle);"
              >
                <p class="text-xs font-medium text-text-muted">
                  {{ paginationStart() }}-{{ paginationEnd() }} de
                  {{ filteredSecretarias().length }}
                </p>
                <div class="flex items-center gap-2">
                  <button
                    class="pagination-btn"
                    [disabled]="currentPage() === 1"
                    (click)="currentPage.set(currentPage() - 1)"
                  >
                    Anterior
                  </button>
                  <button
                    class="pagination-btn"
                    [disabled]="currentPage() >= totalPages()"
                    (click)="currentPage.set(currentPage() + 1)"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Sidebar (Panel de Control) -->
        <div class="bento-tall" data-col-span="3">
          <div class="card p-6 h-full flex flex-col" appCardHover>
            <h3 class="text-sm font-bold uppercase tracking-widest mb-6 text-text-secondary">
              Panel de Control
            </h3>

            <div class="flex-1">
              <div class="rounded-xl p-5 mb-8 bg-subtle border border-border-subtle">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2.5 rounded-xl bg-brand/10 bg-brand/10">
                    <app-icon name="shield-check" [size]="20" color="var(--ds-brand)" />
                  </div>
                  <span class="text-sm font-bold text-brand"> Rol Secretaria </span>
                </div>
                <p class="text-xs leading-relaxed text-text-secondary">
                  Acceso a matrículas, pagos, agenda y gestión de alumnos de su sede asignada.
                </p>
              </div>

              <h4 class="text-[11px] font-bold uppercase tracking-widest mb-4 text-text-muted">
                Permisos del Sistema
              </h4>
              <ul class="flex flex-col gap-4 mb-8">
                @for (permiso of permisos; track permiso) {
                  <li class="flex items-center gap-3 text-xs font-semibold text-text-secondary">
                    <div class="w-1.5 h-1.5 rounded-full bg-success"></div>
                    {{ permiso }}
                  </li>
                }
              </ul>
            </div>

            <div style="border-top: 1px solid var(--border-subtle);" class="pt-6">
              <h4 class="text-sm font-bold mb-2 text-text-primary">Auditoría de Acciones</h4>
              <p class="text-[11px] mb-5 leading-relaxed text-text-muted">
                Historial de movimientos realizados por el personal administrativo.
              </p>
              <button class="quick-action-btn-primary" (click)="goToAuditoria()">
                <app-icon name="clipboard-list" [size]="16" />
                Explorar Auditoría
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .search-input-inline {
      width: 100%;
      padding: 8px 12px 8px 34px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: 13px;
      outline: none;
      transition: all 0.2s ease;
    }
    .search-input-inline:focus {
      border-color: var(--ds-brand);
      background: var(--bg-base);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--ds-brand) 8%, transparent);
    }

    .secretaria-row {
      transition: background var(--duration-fast);
    }
    .secretaria-row:hover {
      background: var(--bg-subtle);
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .action-btn:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 4%, transparent);
    }

    .pagination-btn {
      padding: 7px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .pagination-btn:hover:not(:disabled) {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .pagination-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .quick-action-btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 12px;
      border-radius: var(--radius-lg);
      border: none;
      background: var(--ds-brand);
      color: white;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .quick-action-btn-primary:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--ds-brand) 20%, transparent);
    }
  `,
})
export class AdminSecretariasComponent {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  protected readonly facade = inject(SecretariasFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly router = inject(Router);

  constructor() {
    // Recarga la lista cada vez que el admin cambia de sede
    effect(() => {
      this.branchFacade.selectedBranchId(); // tracking
      this.facade.initialize();
    });

    // Animación reactiva atada al ciclo SWR
    // Evita setTimeout y sincroniza GSAP exactamente con los cambios del DOM (@if)
    effect(() => {
      const loading = this.facade.isLoading();
      const grid = this.bentoGrid();

      // El effect corre después del Change Detection, por lo que el DOM
      // ya tiene los elementos correspondientes (Skeletons o Contenido Real)
      if (loading) {
        if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
      } else {
        // Al transicionar a contenido real, animamos los elementos nuevos
        // sin tocar la opacidad para que se vea más rápido (skipOpacity: true)
        if (grid) this.gsap.animateBentoGrid(grid.nativeElement, { skipOpacity: true });
      }
    });
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Nueva Secretaria', icon: 'plus', primary: true },
  ]);

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Total Secretarias',
      value: this.facade.totalSecretarias(),
      icon: 'users',
    },
    {
      id: 'sedes',
      label: 'Sedes con Personal',
      value: this.facade.sedesConPersonal(),
      icon: 'map-pin',
    },
    {
      id: 'activas',
      label: 'Cuentas Activas',
      value: this.facade.activas(),
      icon: 'check-circle',
      color: 'success',
    },
    { id: 'inactivas', label: 'Inactivas', value: this.facade.inactivas(), icon: 'user-x' },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') {
      this.layoutDrawer.open(AdminSecretariasCrearDrawerComponent, 'Nueva Secretaria', 'user-plus');
    }
  }

  // ── Filtros locales ────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroSede = signal<string | null>(null);
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly currentPage = signal(1);
  private readonly pageSize = 10;

  // ── Lista filtrada ─────────────────────────────────────────────────────────
  protected readonly filteredSecretarias = computed<SecretariaTableRow[]>(() => {
    let results = this.facade.secretarias();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (s) => s.nombre.toLowerCase().includes(term) || s.email.toLowerCase().includes(term),
      );
    }
    if (this.filtroSede()) {
      results = results.filter((s) => s.sede === this.filtroSede());
    }
    if (this.filtroEstado()) {
      results = results.filter((s) => s.estado === this.filtroEstado());
    }
    return results;
  });

  // ── Paginación ─────────────────────────────────────────────────────────────
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredSecretarias().length / this.pageSize)),
  );

  protected readonly paginatedSecretarias = computed<SecretariaTableRow[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredSecretarias().slice(start, start + this.pageSize);
  });

  protected readonly paginationStart = computed(() => (this.currentPage() - 1) * this.pageSize + 1);

  protected readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredSecretarias().length),
  );

  // ── Opciones para p-select ────────────────────────────────────────────────
  protected readonly sedeOptions = computed(() => [
    { label: 'Todas las sedes', value: null },
    ...[...new Set(this.facade.secretarias().map((s) => s.sede))]
      .filter((s) => s !== '—')
      .sort()
      .map((s) => ({ label: s, value: s })),
  ]);

  protected readonly estadoOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Activa', value: 'activa' },
    { label: 'Inactiva', value: 'inactiva' },
  ];

  // Modelos two-way para p-select
  protected get filtroSedeModel(): string | null {
    return this.filtroSede();
  }
  protected set filtroSedeModel(v: string | null) {
    this.filtroSede.set(v);
  }

  protected get filtroEstadoModel(): string | null {
    return this.filtroEstado();
  }
  protected set filtroEstadoModel(v: string | null) {
    this.filtroEstado.set(v);
  }

  // ── Datos estáticos ────────────────────────────────────────────────────────
  protected readonly permisos = [
    'Gestión de matrículas y alumnos',
    'Registro de pagos y cuadratura',
    'Gestión de agenda y asistencia',
    'Acceso a informes y certificados',
  ];

  protected readonly skeletonRows = [1, 2, 3, 4];

  protected openVerDrawer(sec: SecretariaTableRow): void {
    this.facade.selectSecretaria(sec);
    this.layoutDrawer.open(AdminSecretariasVerDrawerComponent, 'Detalle de Secretaria', 'eye');
  }

  protected openEditarDrawer(sec: SecretariaTableRow): void {
    this.facade.selectSecretaria(sec);
    this.layoutDrawer.open(AdminSecretariasEditarDrawerComponent, 'Editar Secretaria', 'edit');
  }

  protected goToAuditoria(): void {
    void this.router.navigate(['/app/admin/auditoria']);
  }
}
