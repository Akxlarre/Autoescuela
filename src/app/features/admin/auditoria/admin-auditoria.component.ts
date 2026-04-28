import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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
import { AuditoriaFacade } from '@core/facades/auditoria.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { MODULE_OPTIONS } from '@core/models/ui/audit-log-row.model';
import type { AuditLogRow } from '@core/models/ui/audit-log-row.model';

const ACTION_OPTIONS = [
  { label: 'Todas las acciones', value: null },
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
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <div class="bento-banner" #heroRef>
        <app-section-hero
          title="Log de Auditoría"
          subtitle="Registro inmutable de todas las acciones de las secretarias"
          contextLine="Solo acciones de secretarias"
          [actions]="[]"
        />
      </div>

      <!-- ── Filtros ──────────────────────────────────────────────────────── -->
      <div class="bento-banner card p-5">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <!-- Fecha desde -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color: var(--text-secondary)">
              Fecha desde
            </label>
            <input
              type="date"
              class="filter-input"
              [ngModel]="fechaDesde()"
              (ngModelChange)="fechaDesde.set($event)"
              data-llm-description="Filtrar logs desde esta fecha"
            />
          </div>

          <!-- Fecha hasta -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color: var(--text-secondary)">
              Fecha hasta
            </label>
            <input
              type="date"
              class="filter-input"
              [ngModel]="fechaHasta()"
              (ngModelChange)="fechaHasta.set($event)"
              data-llm-description="Filtrar logs hasta esta fecha"
            />
          </div>

          <!-- Secretaria -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color: var(--text-secondary)">
              Secretaria
            </label>
            <p-select
              [options]="secretariaOptions()"
              [(ngModel)]="secretariaModel"
              optionLabel="label"
              optionValue="value"
              placeholder="Todas"
              styleClass="w-full"
              aria-label="Filtrar por secretaria"
              data-llm-description="Filtrar logs por secretaria específica"
            />
          </div>

          <!-- Acción -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color: var(--text-secondary)">Acción</label>
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
            <label class="text-xs font-medium" style="color: var(--text-secondary)">Módulo</label>
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
            class="flex items-center gap-2 text-sm"
            style="color: var(--text-secondary); background: none; border: none; cursor: pointer; padding: 0;"
            (click)="clearFilters()"
            data-llm-action="limpiar-filtros-auditoria"
          >
            <app-icon name="refresh-cw" [size]="14" />
            Limpiar Filtros
          </button>

          <div class="flex items-center gap-2">
            <button
              class="export-btn"
              (click)="exportExcel()"
              data-llm-action="exportar-excel-auditoria"
            >
              <app-icon name="file-spreadsheet" [size]="14" />
              Exportar Excel
            </button>
            <button
              class="btn-primary export-btn--primary"
              (click)="exportPdf()"
              data-llm-action="exportar-pdf-auditoria"
            >
              <app-icon name="file-text" [size]="14" />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <!-- ── Tabla ─────────────────────────────────────────────────────────── -->
      <div class="bento-banner card p-0 overflow-hidden">
        <!-- Header tabla -->
        <div
          class="grid audit-grid px-6 py-3 text-xs font-semibold uppercase tracking-wide"
          style="
            color: var(--text-muted);
            border-bottom: 1px solid var(--border-subtle);
            background: var(--bg-subtle, rgba(0,0,0,0.02));
          "
        >
          <span>Fecha/Hora</span>
          <span>Usuario</span>
          <span>Acción</span>
          <span>Módulo</span>
          <span>Detalles</span>
          <span>IP</span>
        </div>

        <!-- Filas -->
        @if (facade.isLoading()) {
          @for (_ of skeletonRows; track $index) {
            <div
              class="grid audit-grid px-6 py-4 items-center"
              style="border-bottom: 1px solid var(--border-subtle);"
            >
              <app-skeleton-block variant="text" width="120px" height="13px" />
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="140px" height="13px" />
                <app-skeleton-block variant="text" width="180px" height="11px" />
              </div>
              <app-skeleton-block variant="rect" width="80px" height="24px" />
              <app-skeleton-block variant="text" width="90px" height="13px" />
              <app-skeleton-block variant="text" width="200px" height="13px" />
              <app-skeleton-block variant="text" width="100px" height="13px" />
            </div>
          }
        } @else if (facade.logs().length === 0) {
          <div class="py-16 flex flex-col items-center gap-3">
            <app-icon name="shield-off" [size]="36" />
            <p class="text-sm" style="color: var(--text-muted)">
              No hay registros de auditoría para los filtros seleccionados.
            </p>
          </div>
        } @else {
          @for (log of facade.logs(); track log.id) {
            <div
              class="audit-row grid audit-grid px-6 py-4 items-start"
              style="border-bottom: 1px solid var(--border-subtle);"
            >
              <!-- Fecha/Hora -->
              <span class="text-sm tabular-nums" style="color: var(--text-secondary)">
                {{ log.fechaHora | date: 'yyyy-MM-dd HH:mm:ss' }}
              </span>

              <!-- Usuario -->
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-semibold" style="color: var(--text-primary)">
                  {{ log.usuarioNombre }}
                </span>
                <a
                  [href]="'mailto:' + log.usuarioEmail"
                  class="text-xs"
                  style="color: var(--ds-brand); text-decoration: none;"
                >
                  {{ log.usuarioEmail }}
                </a>
              </div>

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
              <span class="text-sm" style="color: var(--text-secondary)">{{ log.modulo }}</span>

              <!-- Detalles -->
              <span class="text-sm" style="color: var(--ds-brand)">{{ log.detalle }}</span>

              <!-- IP -->
              <span class="text-sm tabular-nums" style="color: var(--text-muted)">
                {{ log.ip }}
              </span>
            </div>
          }
        }

        <!-- Paginación -->
        @if (!facade.isLoading() && facade.totalCount() > 0) {
          <div
            class="flex items-center justify-between px-6 py-4"
            style="border-top: 1px solid var(--border-subtle);"
          >
            <p class="text-xs" style="color: var(--ds-brand)">
              Mostrando {{ facade.paginationStart() }}-{{ facade.paginationEnd() }} de
              {{ facade.totalCount() }} registros
            </p>
            <div class="flex items-center gap-1">
              <button
                class="page-btn"
                [disabled]="facade.currentPage() === 1"
                (click)="goToPage(facade.currentPage() - 1)"
                data-llm-action="auditoria-pagina-anterior"
              >
                ← Anterior
              </button>

              @for (p of visiblePages(); track p) {
                @if (p === -1) {
                  <span class="text-xs px-1" style="color: var(--text-muted)">…</span>
                } @else {
                  <button
                    class="page-btn"
                    [class.page-btn--active]="p === facade.currentPage()"
                    (click)="goToPage(p)"
                  >
                    {{ p }}
                  </button>
                }
              }

              <button
                class="page-btn"
                [disabled]="facade.currentPage() >= facade.totalPages()"
                (click)="goToPage(facade.currentPage() + 1)"
                data-llm-action="auditoria-pagina-siguiente"
              >
                Siguiente →
              </button>
            </div>
          </div>
        }
      </div>

      <!-- ── Banner informativo ─────────────────────────────────────────────── -->
      <div
        class="bento-banner flex items-start gap-3 p-4 rounded-lg text-sm"
        style="
          background: color-mix(in srgb, var(--state-warning) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--state-warning) 25%, transparent);
          color: var(--text-secondary);
        "
      >
        <app-icon name="info" [size]="16" color="var(--state-warning)" class="mt-0.5 shrink-0" />
        <p>
          <strong>Política de correos:</strong> El log registra el
          <strong>correo personal</strong> de cada secretaria (no el alias institucional) para
          garantizar trazabilidad inequívoca. El alias público (ej.
          <span style="color: var(--ds-brand); font-weight: 600;">
            secretaria&#64;autoescuela-chillan.cl
          </span>
          ) puede ser compartido; el correo personal identifica a la persona real.
        </p>
      </div>
    </div>
  `,
  styles: `
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

    .export-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .export-btn:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .export-btn--primary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      font-size: var(--text-sm);
      font-family: inherit;
    }

    .audit-grid {
      grid-template-columns: 148px 220px 110px 130px 1fr 120px;
      gap: 16px;
    }

    .audit-row {
      transition: background var(--duration-fast);
    }
    .audit-row:hover {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
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

    /* Paginación */
    .page-btn {
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .page-btn:hover:not(:disabled):not(.page-btn--active) {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .page-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .page-btn--active {
      background: var(--ds-brand);
      color: #fff;
      border-color: var(--ds-brand);
      cursor: default;
    }
    .page-btn--active:hover {
      background: var(--ds-brand);
      color: #fff;
    }
  `,
})
export class AdminAuditoriaComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(AuditoriaFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  private readonly router = inject(Router);

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
  protected readonly moduloOptions = [
    { label: 'Todos los módulos', value: null },
    ...MODULE_OPTIONS.map((m) => ({ label: m, value: m })),
  ];
  protected readonly secretariaOptions = computed(() => [
    { label: 'Todos los usuarios', value: null },
    ...this.facade.secretarias().map((s) => ({
      label: s.nombre,
      value: s.id,
    })),
  ]);

  protected readonly skeletonRows = [1, 2, 3, 4, 5];

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

  ngOnInit(): void {
    /* lifecycle hook kept — effect() handles initialization */
  }

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();

    if (hero) this.gsap.animateHero(hero.nativeElement);
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
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

  protected goToPage(page: number): void {
    this.facade.setPage(page);
  }

  protected badgeClass(log: AuditLogRow): string {
    if (log.accion === 'Crear') return 'success';
    if (log.accion === 'Actualizar') return 'info';
    return 'warning';
  }

  protected readonly visiblePages = computed(() => {
    const total = this.facade.totalPages();
    const current = this.facade.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  protected exportExcel(): void {
    // TODO: implementar exportación Excel con los filtros actuales
  }

  protected exportPdf(): void {
    // TODO: implementar exportación PDF con los filtros actuales
  }
}
