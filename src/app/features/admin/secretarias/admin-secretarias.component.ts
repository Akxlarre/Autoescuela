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
import { Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { SecretariasFacade } from '@core/facades/secretarias.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AdminSecretariasCrearDrawerComponent } from './admin-secretarias-crear-drawer.component';
import { AdminSecretariasVerDrawerComponent } from './admin-secretarias-ver-drawer.component';
import { AdminSecretariasEditarDrawerComponent } from './admin-secretarias-editar-drawer.component';
import type { SecretariaTableRow } from '@core/models/ui/secretaria-table.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';

@Component({
  selector: 'app-admin-secretarias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
    DrawerComponent,
    AdminSecretariasCrearDrawerComponent,
    AdminSecretariasVerDrawerComponent,
    AdminSecretariasEditarDrawerComponent,
  ],
  template: `
    <div class="page-wide">
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <div class="mb-6">
        <app-section-hero
          title="Gestión de Secretarias"
          subtitle="Control de acceso y gestión de personal de secretaría"
          [actions]="heroActions()"
          (actionClick)="handleHeroAction($event)"
        />
      </div>

      <!-- ── KPI Cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <app-kpi-card-variant
          label="Total Secretarias"
          [value]="facade.totalSecretarias()"
          icon="users"
          [loading]="facade.isLoading()"
          data-llm-description="Total de secretarias registradas"
        />
        <app-kpi-card-variant
          label="Activas"
          [value]="facade.activas()"
          icon="check-circle"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Secretarias activas"
        />
        <app-kpi-card-variant
          label="Inactivas"
          [value]="facade.inactivas()"
          icon="user-x"
          [loading]="facade.isLoading()"
          data-llm-description="Secretarias inactivas"
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
            placeholder="Buscar por nombre o email..."
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            data-llm-description="Buscar secretaria por nombre o email"
          />
        </div>

        <div class="flex items-center gap-2">
          <p-select
            [options]="sedeOptions()"
            [(ngModel)]="filtroSedeModel"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las sedes"
            [style]="{ height: '40px' }"
            aria-label="Filtrar por sede"
            data-llm-description="Filtro de secretarias por sede"
          />
          <p-select
            [options]="estadoOptions"
            [(ngModel)]="filtroEstadoModel"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            [style]="{ height: '40px' }"
            aria-label="Filtrar por estado"
            data-llm-description="Filtro de secretarias por estado"
          />
        </div>
      </div>

      <!-- ── Content (List + Sidebar) ───────────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <!-- Lista de Secretarias -->
        <div class="card p-6 flex flex-col">
          <h2 class="text-base font-semibold mb-4" style="color: var(--text-primary)">
            Lista de Secretarias
          </h2>

          @if (facade.isLoading()) {
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
          } @else if (paginatedSecretarias().length === 0) {
            <div class="py-14 text-center">
              <div class="flex flex-col items-center gap-2">
                <app-icon name="users" [size]="36" />
                <p class="text-sm mt-1" style="color: var(--text-muted)">
                  No hay secretarias que coincidan con los filtros.
                </p>
              </div>
            </div>
          } @else {
            @for (sec of paginatedSecretarias(); track sec.id) {
              <div
                class="secretaria-row flex items-center gap-4 py-4"
                style="border-bottom: 1px solid var(--border-subtle);"
              >
                <!-- Avatar -->
                <div
                  class="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold"
                  style="background: var(--color-primary-tint); color: var(--color-primary);"
                >
                  {{ sec.initials }}
                </div>

                <!-- Info principal -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold" style="color: var(--text-primary)">
                      {{ sec.nombre }}
                    </span>

                    <!-- Badge estado -->
                    @if (sec.estado === 'activa') {
                      <span
                        class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style="background: color-mix(in srgb, var(--state-success) 12%, transparent); color: var(--state-success);"
                      >
                        <app-icon name="check-circle" [size]="10" />
                        Activa
                      </span>
                    } @else {
                      <span
                        class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style="background: var(--bg-elevated); color: var(--text-muted);"
                      >
                        Inactiva
                      </span>
                    }

                    <!-- Alias público -->
                    @if (sec.aliasPublico) {
                      <span
                        class="inline-flex text-xs font-medium px-2 py-0.5 rounded-full"
                        style="background: color-mix(in srgb, var(--ds-brand) 10%, transparent); color: var(--ds-brand);"
                      >
                        alias público
                      </span>
                    }
                  </div>

                  <div class="flex items-center gap-3 mt-1 flex-wrap">
                    <a
                      class="text-xs"
                      style="color: var(--ds-brand); text-decoration: none;"
                      [href]="'mailto:' + sec.email"
                    >
                      {{ sec.email }}
                    </a>
                    <span class="flex items-center gap-1 text-xs" style="color: var(--text-muted)">
                      <app-icon name="map-pin" [size]="11" />
                      {{ sec.sede }}
                    </span>
                    @if (sec.ultimoAcceso) {
                      <span class="text-xs" style="color: var(--text-muted)">
                        Último acceso: {{ sec.ultimoAcceso | date: 'yyyy-MM-dd HH:mm' }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Acciones -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    class="action-btn"
                    title="Ver detalle"
                    (click)="openVerDrawer(sec)"
                    data-llm-action="ver-secretaria"
                  >
                    <app-icon name="eye" [size]="16" />
                  </button>
                  <button
                    class="action-btn"
                    title="Editar secretaria"
                    (click)="openEditarDrawer(sec)"
                    data-llm-action="editar-secretaria"
                  >
                    <app-icon name="edit" [size]="16" />
                  </button>
                </div>
              </div>
            }
          }

          <!-- Paginación — siempre al pie del card -->
          @if (!facade.isLoading() && filteredSecretarias().length > 0) {
            <div
              class="flex items-center justify-between pt-4 mt-auto"
              style="border-top: 1px solid var(--border-subtle);"
            >
              <p class="text-xs" style="color: var(--text-muted)">
                Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de
                {{ filteredSecretarias().length }} secretarias
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
          <!-- Permisos de Secretaria -->
          <div class="card p-5">
            <h3 class="text-sm font-semibold mb-4" style="color: var(--text-primary)">
              Permisos de Secretaria
            </h3>

            <div
              class="rounded-lg p-4 mb-4"
              style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent); border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);"
            >
              <div class="flex items-center gap-2 mb-1">
                <app-icon name="shield-check" [size]="16" color="var(--ds-brand)" />
                <span class="text-sm font-semibold" style="color: var(--ds-brand)">
                  Rol: Secretaria
                </span>
              </div>
              <p class="text-xs" style="color: var(--ds-brand)">
                Gestión de matrículas, pagos, agenda y alumnos
              </p>
            </div>

            <ul class="flex flex-col gap-2.5 mb-5">
              @for (permiso of permisos; track permiso) {
                <li class="flex items-center gap-2 text-xs" style="color: var(--text-secondary)">
                  <app-icon name="check" [size]="13" color="var(--state-success)" />
                  {{ permiso }}
                </li>
              }
            </ul>

            <div style="border-top: 1px solid var(--border-subtle);" class="pt-4">
              <h4 class="text-sm font-semibold mb-2" style="color: var(--text-primary)">
                Auditoría
              </h4>
              <p class="text-xs mb-3" style="color: var(--text-muted)">
                Revisa el historial de acciones realizadas por las secretarias del sistema.
              </p>
              <button
                class="quick-action-btn"
                (click)="goToAuditoria()"
                data-llm-action="ver-auditoria"
              >
                <app-icon name="clipboard-list" [size]="16" />
                Ver Auditoría
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Drawer: Crear Secretaria ─────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="crearDrawerOpen()"
      title="Nueva Secretaria"
      icon="user-plus"
      (closed)="onCrearDrawerClosed()"
    >
      <app-admin-secretarias-crear-drawer (closed)="onCrearDrawerClosed()" />
    </app-drawer>

    <!-- ── Drawer: Ver Secretaria ───────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="verDrawerOpen()"
      title="Detalle de Secretaria"
      icon="eye"
      (closed)="verDrawerOpen.set(false)"
    >
      <app-admin-secretarias-ver-drawer (editarClicked)="switchToEditar()" />
    </app-drawer>

    <!-- ── Drawer: Editar Secretaria ────────────────────────────────────────── -->
    <app-drawer
      [isOpen]="editarDrawerOpen()"
      title="Editar Secretaria"
      icon="edit"
      (closed)="editarDrawerOpen.set(false)"
    >
      <app-admin-secretarias-editar-drawer (saved)="editarDrawerOpen.set(false)" />
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
    .filter-select:focus {
      border-color: var(--ds-brand);
    }

    .secretaria-row {
      transition: background var(--duration-fast);
    }
    .secretaria-row:hover {
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

    .quick-action-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      text-align: left;
      transition: all var(--duration-fast);
    }
    .quick-action-btn:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 4%, transparent);
    }
  `,
})
export class AdminSecretariasComponent {
  protected readonly facade = inject(SecretariasFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly router = inject(Router);

  constructor() {
    // Recarga la lista cada vez que el admin cambia de sede (o vuelve a "Todas")
    effect(() => {
      this.branchFacade.selectedBranchId(); // tracking
      this.facade.initialize();
    });
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Nueva Secretaria', icon: 'plus', primary: true },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') this.crearDrawerOpen.set(true);
  }

  // ── Estado drawers ─────────────────────────────────────────────────────────
  protected readonly crearDrawerOpen = signal(false);
  protected readonly verDrawerOpen = signal(false);
  protected readonly editarDrawerOpen = signal(false);

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
    this.verDrawerOpen.set(true);
  }

  protected onCrearDrawerClosed(): void {
    this.crearDrawerOpen.set(false);
  }

  protected openEditarDrawer(sec: SecretariaTableRow): void {
    this.facade.selectSecretaria(sec);
    this.editarDrawerOpen.set(true);
  }

  protected goToAuditoria(): void {
    void this.router.navigate(['/app/admin/auditoria']);
  }

  /** Desde el drawer Ver → abrir Editar sin perder la secretaria seleccionada */
  protected switchToEditar(): void {
    this.verDrawerOpen.set(false);
    this.editarDrawerOpen.set(true);
  }
}
