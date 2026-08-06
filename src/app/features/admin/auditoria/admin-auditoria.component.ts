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
import { SelectModule } from 'primeng/select';
import { PaginatorModule } from 'primeng/paginator';
import { AuditoriaFacade } from '@core/facades/auditoria.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AuditLogDetailDrawerComponent } from './audit-log-detail-drawer.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { MODULE_OPTIONS } from '@core/models/ui/audit-log-row.model';
import type { AuditLogRow } from '@core/models/ui/audit-log-row.model';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

const ACTION_OPTIONS = [
  { label: 'Crear', value: 'Crear' },
  { label: 'Actualizar', value: 'Actualizar' },
  { label: 'Eliminar', value: 'Eliminar' },
];

@Component({
  selector: 'app-admin-auditoria',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    SelectModule,
    PaginatorModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
    CardHoverDirective,
    DateInputComponent,
    StableWidthDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoReveal appBentoGridLayout>
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Log de Auditoría"
        subtitle="Registro inmutable de todas las acciones de las secretarias"
        contextLine="Solo acciones de secretarias"
        [actions]="[]"
      />

      <!-- ── Filtros + Tabla (una sola card, consistente con Base Alumnos B) ── -->
      <div
        class="bento-banner bento-fill card card-accent p-0 overflow-hidden flex flex-col h-full"
        appCardHover
      >
        <!-- Toolbar de filtros -->
        <div class="p-5 border-b border-border-default">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <!-- Fecha desde -->
            <div class="flex flex-col gap-1">
              <app-date-input
                label="Fecha desde"
                [value]="fechaDesde() ?? ''"
                (valueChange)="fechaDesde.set($event); applyFilters()"
                data-llm-description="Filtrar logs desde esta fecha"
              />
            </div>

            <!-- Fecha hasta -->
            <div class="flex flex-col gap-1">
              <app-date-input
                label="Fecha hasta"
                [value]="fechaHasta() ?? ''"
                (valueChange)="fechaHasta.set($event); applyFilters()"
                data-llm-description="Filtrar logs hasta esta fecha"
              />
            </div>

            <!-- Secretaria -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-text-secondary">Secretaria</label>
              <p-select
                [options]="secretariaOptions()"
                [(ngModel)]="secretariaModel"
                optionLabel="label"
                optionValue="value"
                placeholder="Todos los usuarios"
                styleClass="w-full"
                aria-label="Filtrar por secretaria"
                data-llm-description="Filtrar logs por secretaria específica"
              />
            </div>

            <!-- Acción -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-text-secondary">Acción</label>
              <p-select
                [options]="actionOptions"
                [(ngModel)]="accionModel"
                optionLabel="label"
                optionValue="value"
                placeholder="Todas las acciones"
                styleClass="w-full"
                aria-label="Filtrar por tipo de acción"
                data-llm-description="Filtrar logs por tipo de acción"
              />
            </div>

            <!-- Módulo -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-text-secondary">Módulo</label>
              <p-select
                [options]="moduloOptions"
                [(ngModel)]="moduloModel"
                optionLabel="label"
                optionValue="value"
                placeholder="Todos los módulos"
                styleClass="w-full"
                aria-label="Filtrar por módulo"
                data-llm-description="Filtrar logs por módulo del sistema"
              />
            </div>
          </div>

          <!-- Acciones de filtro -->
          <div class="flex items-center justify-between flex-wrap gap-3">
            <button
              class="filter-clear-btn flex items-center gap-2 text-sm text-text-secondary"
              (click)="clearFilters()"
              data-llm-action="limpiar-filtros-auditoria"
            >
              <app-icon name="refresh-cw" [size]="14" />
              Limpiar Filtros
            </button>

            <div class="relative">
              <button
                type="button"
                class="btn-secondary flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                [disabled]="facade.isExporting()"
                [appStableWidth]="facade.isExporting()"
                (click)="exportMenuOpen.set(!exportMenuOpen())"
                data-llm-action="open-export-menu-auditoria"
              >
                @if (facade.isExporting()) {
                  <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                } @else {
                  <app-icon name="download" [size]="16" />
                }
                Exportar
                <app-icon name="chevron-down" [size]="14" />
              </button>
              @if (exportMenuOpen()) {
                <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
                <div class="export-menu">
                  <button
                    type="button"
                    class="export-menu-item"
                    (click)="requestExport('excel')"
                    data-llm-action="exportar-excel-auditoria"
                  >
                    <app-icon name="table-2" [size]="15" />
                    Exportar como Excel
                  </button>
                  <button
                    type="button"
                    class="export-menu-item"
                    (click)="requestExport('pdf')"
                    data-llm-action="exportar-pdf-auditoria"
                  >
                    <app-icon name="file-text" [size]="15" />
                    Exportar como PDF
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- ── Tabla ─────────────────────────────────────────────────────────── -->
        <!-- Scroll wrapper: horizontal en pantallas chicas + vertical interno (fill-screen) -->
        <div class="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <!-- Header tabla -->
          <div
            class="overline audit-grid px-6 py-3 audit-header"
            [class.audit-grid--no-sede]="!showSedeColumn()"
          >
            <span>Fecha/Hora</span>
            <span>Usuario</span>
            @if (showSedeColumn()) {
              <span>Sede</span>
            }
            <span>Acción</span>
            <span>Módulo</span>
            <span>Detalles</span>
            <span>IP</span>
          </div>

          <!-- Filas -->
          @if (facade.isLoading()) {
            @for (_ of skeletonRows; track $index) {
              <div
                class="audit-grid px-6 py-4 items-center audit-row-border"
                [class.audit-grid--no-sede]="!showSedeColumn()"
              >
                <app-skeleton-block variant="text" width="120px" height="13px" />
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="140px" height="13px" />
                  <app-skeleton-block variant="text" width="180px" height="11px" />
                </div>
                @if (showSedeColumn()) {
                  <app-skeleton-block variant="text" width="90px" height="13px" />
                }
                <app-skeleton-block variant="rect" width="80px" height="24px" />
                <app-skeleton-block variant="text" width="90px" height="13px" />
                <app-skeleton-block variant="text" width="200px" height="13px" />
                <app-skeleton-block variant="text" width="100px" height="13px" />
              </div>
            }
          } @else if (facade.logs().length === 0) {
            <div class="py-16 flex flex-col items-center gap-3">
              <app-icon name="shield-off" [size]="36" />
              <p class="text-sm text-text-muted">
                No hay registros de auditoría para los filtros seleccionados.
              </p>
            </div>
          } @else {
            @for (log of facade.logs(); track log.id) {
              <div
                class="audit-row audit-grid px-6 py-4 items-start audit-row-border"
                [class.audit-grid--no-sede]="!showSedeColumn()"
                role="button"
                tabindex="0"
                (click)="verDetalle(log)"
                (keydown.enter)="verDetalle(log)"
                data-llm-action="ver-detalle-auditoria"
              >
                <!-- Fecha/Hora -->
                <span class="text-sm tabular-nums text-text-secondary">
                  {{ log.fechaHora | date: 'yyyy-MM-dd HH:mm:ss' }}
                </span>

                <!-- Usuario -->
                <div class="flex flex-col gap-0.5">
                  <span class="item-title">{{ log.usuarioNombre }}</span>
                  <a
                    [href]="'mailto:' + log.usuarioEmail"
                    class="text-xs brand-link"
                    (click)="$event.stopPropagation()"
                  >
                    {{ log.usuarioEmail }}
                  </a>
                </div>

                @if (showSedeColumn()) {
                  <!-- Sede -->
                  <span class="text-sm text-text-secondary">{{ log.sedeNombre }}</span>
                }

                <!-- Acción badge -->
                <div>
                  <span [class]="'action-badge action-badge--' + badgeClass(log)">
                    @if (log.accion === 'Crear') {
                      <app-icon name="plus" [size]="10" />
                    } @else if (log.accion === 'Actualizar') {
                      <app-icon name="pencil" [size]="10" />
                    } @else {
                      <app-icon name="triangle-alert" [size]="10" />
                    }
                    {{ log.accion }}
                  </span>
                </div>

                <!-- Módulo -->
                <span class="text-sm text-text-secondary">{{ log.modulo }}</span>

                <!-- Detalles -->
                <span class="text-sm text-brand">{{ log.detalle }}</span>

                <!-- IP -->
                <span class="text-sm tabular-nums text-text-muted">{{ log.ip }}</span>
              </div>
            }
          }
        </div>

        <!-- Paginación PrimeNG — mismo componente/look que Base Alumnos B.
             Sin borde propio: la última fila ya aporta la línea separadora
             (.audit-row-border) — igual que entre cualquier par de filas. -->
        @if (!facade.isLoading() && facade.totalCount() > 0) {
          <div class="shrink-0">
            <p-paginator
              [rows]="pageSize"
              [totalRecords]="facade.totalCount()"
              [first]="(facade.currentPage() - 1) * pageSize"
              [showCurrentPageReport]="true"
              currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
              (onPageChange)="onPageChange($event)"
            />
          </div>
        }

        <!-- ── Banner informativo ───────────────────────────────────────────── -->
        <div
          class="shrink-0 flex items-start gap-3 p-4 rounded-lg text-sm text-text-secondary warning-banner"
        >
          <app-icon name="info" [size]="16" color="var(--state-warning)" class="mt-0.5 shrink-0" />
          <p>
            <strong>Política de correos:</strong> El log registra el
            <strong>correo personal</strong> de cada secretaria (no el alias institucional) para
            garantizar trazabilidad inequívoca. El alias público (ej.
            <span class="font-semibold text-brand"> secretaria&#64;autoescuela-chillan.cl </span>
            ) puede ser compartido; el correo personal identifica a la persona real.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: `
    /* .bento-grid--fill-screen (@layer bento.grid) solo fija grid-template-rows
       ("auto minmax(0,1fr)") dentro de @container layoutmain >= 1024px. Por debajo
       de eso (drawer abierto angostando <main>, típico en 1440px con un drawer de
       ~450px), cae al default de .bento-grid: grid-auto-rows: minmax(120px, auto).
       El hero (density="slim", sin kpis/actions) mide ~64-70px reales pero
       align-items:stretch lo estira a 120px, dejando un hueco visible antes de la
       card de tabla. Mismo bug ya documentado y resuelto en
       admin-alumno-detalle.component.ts con la misma técnica: un bloque styles de
       Angular no vive dentro de ningún @layer, así que gana por cascada sobre la
       regla base sin !important. Gateado a max-width:1023px para no pisar el
       minmax(0,1fr) que ya aplica en lg+ (fix-123). */
    @container layoutmain (max-width: 1023px) {
      .bento-grid.bento-grid--fill-screen {
        grid-template-rows: auto auto;
      }
    }

    .filter-input {
      width: 100%;
      height: 38px;
      padding: 0 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
    }
    .filter-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }

    .filter-clear-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }

    .brand-link {
      color: var(--ds-brand);
      text-decoration: none;
    }

    /* Tabla — el min-width garantiza scroll horizontal antes de colapsar.
       "Detalles" usa minmax(200px, 1fr): un 1fr sin piso se aprieta a su
       min-content (ancho de la palabra más larga) cuando el contenedor se
       angosta (ej. drawer abierto), partiendo el texto en columnas
       ilegibles. min-width = suma de columnas fijas + gaps + el piso de
       Detalles, para que el 1fr nunca reciba menos que su mínimo real. */
    .audit-grid {
      display: grid;
      grid-template-columns: 148px 220px 130px 110px 130px minmax(200px, 1fr) 120px;
      gap: 16px;
      min-width: 1160px;
    }
    .audit-grid--no-sede {
      grid-template-columns: 148px 220px 110px 130px minmax(200px, 1fr) 120px;
      min-width: 1010px;
    }

    .audit-header {
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
    }

    .audit-row-border {
      border-bottom: 1px solid var(--border-subtle);
    }

    .audit-row {
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .audit-row:hover {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
    }
    .audit-row:focus-visible {
      outline: 2px solid var(--ds-brand);
      outline-offset: -2px;
    }

    .warning-banner {
      background: color-mix(in srgb, var(--state-warning) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--state-warning) 25%, transparent);
    }

    /* Action badges */
    .action-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .action-badge--success {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .action-badge--info {
      background: color-mix(in srgb, var(--ds-brand) 12%, transparent);
      color: var(--ds-brand);
    }
    .action-badge--warning {
      background: color-mix(in srgb, var(--state-warning) 15%, transparent);
      color: var(--state-warning);
    }

    .export-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 20;
      min-width: 200px;
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
      overflow: hidden;
    }
    .export-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--text-primary);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: background var(--duration-fast);
    }
    .export-menu-item:hover {
      background: var(--bg-elevated);
    }
  `,
})
export class AdminAuditoriaComponent {
  protected readonly facade = inject(AuditoriaFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  // ── Filtros locales (UI state) ──────────────────────────────────────────────
  protected readonly fechaDesde = signal<string | null>(null);
  protected readonly fechaHasta = signal<string | null>(null);
  protected readonly filtroSecretaria = signal<number | null>(null);
  protected readonly filtroAccion = signal<string | null>(null);
  protected readonly filtroModulo = signal<string | null>(null);

  // ── Options ─────────────────────────────────────────────────────────────────
  protected readonly actionOptions = ACTION_OPTIONS;
  protected readonly moduloOptions = MODULE_OPTIONS.map((m) => ({ label: m, value: m }));
  protected readonly secretariaOptions = computed(() =>
    this.facade.secretarias().map((s) => ({
      label: s.nombre,
      value: s.id,
    })),
  );

  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  /** Columna "Sede" solo aporta valor cuando el admin ve todas las sedes a la vez. */
  protected readonly showSedeColumn = computed(() => this.branchFacade.selectedBranchId() === null);

  // Modelos two-way p-select
  protected get secretariaModel(): number | null {
    return this.filtroSecretaria();
  }
  protected set secretariaModel(v: number | null) {
    this.filtroSecretaria.set(v);
    this.applyFilters();
  }

  protected get accionModel(): string | null {
    return this.filtroAccion();
  }
  protected set accionModel(v: string | null) {
    this.filtroAccion.set(v);
    this.applyFilters();
  }

  protected get moduloModel(): string | null {
    return this.filtroModulo();
  }
  protected set moduloModel(v: string | null) {
    this.filtroModulo.set(v);
    this.applyFilters();
  }

  protected applyFilters(): void {
    this.facade.setFilters({
      fechaDesde: this.fechaDesde(),
      fechaHasta: this.fechaHasta(),
      secretariaId: this.filtroSecretaria(),
      accion: this.filtroAccion(),
      modulo: this.filtroModulo(),
    });
  }

  protected clearFilters(): void {
    this.fechaDesde.set(null);
    this.fechaHasta.set(null);
    this.filtroSecretaria.set(null);
    this.filtroAccion.set(null);
    this.filtroModulo.set(null);
    this.facade.clearFilters();
  }

  /** Debe coincidir con PAGE_SIZE de AuditoriaFacade (paginación server-side). */
  protected readonly pageSize = 25;

  protected onPageChange(event: { page?: number }): void {
    this.facade.setPage((event.page ?? 0) + 1);
  }

  protected badgeClass(log: AuditLogRow): string {
    if (log.accion === 'Crear') return 'success';
    if (log.accion === 'Actualizar') return 'info';
    return 'warning';
  }

  protected verDetalle(log: AuditLogRow): void {
    this.facade.selectLog(log);
    this.layoutDrawer.open(AuditLogDetailDrawerComponent, 'Detalle de Auditoría', 'file-text');
  }

  protected readonly exportMenuOpen = signal(false);

  protected requestExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    void this.facade.exportar(format);
  }
}
