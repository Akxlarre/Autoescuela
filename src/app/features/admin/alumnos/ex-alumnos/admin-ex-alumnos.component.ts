import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AdminStatsPanelComponent } from './components/stats/admin-ex-alumnos-stats.component';
import {
  AdminExAlumnosCommentsComponent,
} from './components/comments/admin-ex-alumnos-comments.component';
import type {
  SectionHeroAction,
  SectionHeroChip,
} from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-admin-ex-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    AdminStatsPanelComponent,
    AdminExAlumnosCommentsComponent,
  ],
  template: `
    <div class="page-wide flex flex-col min-h-0 gap-8 overflow-y-auto pb-10">
      <!-- ── Hero ── -->
      <app-section-hero
        title="Gestión de Ex-Alumnos"
        subtitle="Archivo histórico, búsqueda avanzada y seguimiento financiero"
        icon="graduation-cap"
        [actions]="heroActions"
        [chips]="heroChips()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Bento Grid ── -->
      <div class="bento-grid">
        <!-- KPIs Row: Direct children of bento-grid with bento-square class -->
        <app-kpi-card-variant
          class="bento-square"
          label="TOTAL EGRESADOS"
          [value]="facade.totalEgresados()"
          icon="graduation-cap"
          [loading]="facade.isLoading()"
        />
        <app-kpi-card-variant
          class="bento-square"
          label="CLASE B"
          [value]="facade.egresadosClaseB()"
          icon="car"
          [loading]="facade.isLoading()"
        />
        <app-kpi-card-variant
          class="bento-square"
          label="PROFESIONAL"
          [value]="facade.egresadosProfesional()"
          icon="award"
          color="success"
          [loading]="facade.isLoading()"
        />
        <app-kpi-card-variant
          class="bento-square"
          label="DEUDA PENDIENTE"
          [value]="facade.conAbonoPendiente()"
          icon="circle-alert"
          color="warning"
          [accent]="true"
          [loading]="facade.isLoading()"
        />

        <!-- Archivo Histórico (Main Area) -->
        <div class="bento-card bento-hero overflow-hidden !p-0 bg-bg-surface flex flex-col h-full">
          <!-- Header for Table Card -->
          <div class="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-elevated/20">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                <app-icon name="archive" [size]="18" />
              </div>
              <h2 class="text-base font-bold text-text-primary m-0">Registro Histórico</h2>
            </div>
            
            <div class="flex items-center gap-2">
               <!-- Filtros compactos -->
               <div class="hidden lg:flex items-center gap-2">
                  <div class="filter-group">
                    <app-icon name="calendar" [size]="12" class="text-text-muted" />
                    <select class="filter-select" [ngModel]="filtroAnio()" (ngModelChange)="filtroAnio.set($event)">
                      <option value="">Años</option>
                      @for (year of availableYears(); track year) { <option [value]="year">{{ year }}</option> }
                    </select>
                  </div>
                  <div class="filter-group">
                    <app-icon name="award" [size]="12" class="text-text-muted" />
                    <select class="filter-select" [ngModel]="filtroLicencia()" (ngModelChange)="filtroLicencia.set($event)">
                      <option value="">Licencia</option>
                      @for (lic of availableLicencias(); track lic) { <option [value]="lic">{{ lic }}</option> }
                    </select>
                  </div>
               </div>
               <div class="w-px h-6 bg-border-subtle mx-1 hidden lg:block"></div>
               <div class="w-px h-6 bg-border-subtle mx-1 hidden lg:block"></div>
               <button 
                 type="button"
                 class="p-2 rounded-lg text-text-muted hover:text-brand hover:bg-brand/10 transition-colors flex items-center justify-center"
                 (click)="clearFilters()"
                 pTooltip="Limpiar Filtros"
                 aria-label="Limpiar todos los filtros"
               >
                 <app-icon name="filter-x" [size]="16" />
               </button>
            </div>
          </div>

          <!-- Búsqueda -->
          <div class="px-5 py-4 border-b border-border-subtle/50 bg-bg-surface/30">
             <div class="relative w-full max-w-md">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  <app-icon name="search" [size]="14" />
                </span>
                <input
                  type="text"
                  class="search-input"
                  placeholder="Buscar por Nombre o RUT..."
                  [ngModel]="searchTerm()"
                  (ngModelChange)="searchTerm.set($event)"
                />
             </div>
          </div>

          <!-- Tabla -->
          <div class="flex-1 min-h-0 overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-bg-elevated/10">
                  <th class="th-col">EGRESADO</th>
                  <th class="th-col">LICENCIA</th>
                  <th class="th-col">AÑO / SEDE</th>
                  <th class="th-col">ESTADO CUENTA</th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                @if (facade.isLoading()) {
                  @for (_ of [1,2,3,4,5]; track $index) {
                    <tr>
                      <td class="py-4 px-5"><app-skeleton-block variant="text" width="160px" height="12px" /></td>
                      <td class="py-4 px-5"><app-skeleton-block variant="rect" width="60px" height="24px" /></td>
                      <td class="py-4 px-5"><app-skeleton-block variant="text" width="100px" height="12px" /></td>
                      <td class="py-4 px-5"><app-skeleton-block variant="rect" width="80px" height="24px" /></td>
                      <td></td>
                    </tr>
                  }
                } @else {
                  @for (egresado of filteredEgresados(); track egresado.id) {
                    <tr class="table-row group">
                      <td class="py-4 px-5">
                        <div class="flex flex-col gap-0.5">
                          <span class="font-bold text-text-primary">{{ egresado.nombre }}</span>
                          <span class="text-xs text-text-muted">{{ egresado.rut }}</span>
                        </div>
                      </td>
                      <td class="py-4 px-5">
                        <span class="inas-badge" [attr.data-licencia]="egresado.licencia">
                          {{ egresado.licencia }}
                        </span>
                      </td>
                      <td class="py-4 px-5">
                        <div class="flex flex-col gap-0.5 text-xs">
                          <span class="font-bold text-text-primary">{{ egresado.anio }}</span>
                          <span class="text-text-muted italic">{{ egresado.sede }}</span>
                        </div>
                      </td>
                      <td class="py-4 px-5">
                        @if (egresado.saldoPendiente > 0) {
                          <span class="status-chip status-chip--warn">
                             Debe {{ egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0' }}
                          </span>
                        } @else {
                          <span class="status-chip status-chip--success">
                             <app-icon name="check" [size]="10" class="mr-1" /> Al día
                          </span>
                        }
                      </td>
                      <td class="py-4 px-5 text-right">
                         <app-icon name="chevron-right" [size]="16" class="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="py-20 text-center">
                        <div class="flex flex-col items-center gap-3 opacity-30">
                           <app-icon name="search-x" [size]="48" />
                           <p class="text-sm font-medium">No se encontraron egresados con estos criterios</p>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Estadísticas Detalladas (Mitad izquierda) -->
        <app-admin-stats-panel
          class="bento-wide"
          [municipalRate]="facade.municipalApprovalRate()"
          [psychoRate]="facade.psychoApprovalRate()"
          [totalExams]="facade.totalExamenes()"
          [egresadosTotal]="facade.annualEgresadosTotal()"
          [licensesTotal]="facade.annualLicensesTotal()"
          [successRate]="facade.successConversionRate()"
        />

        <!-- Comentarios y Feedback (Mitad derecha) -->
        <app-admin-ex-alumnos-comments 
          class="bento-wide" 
          [comentarios]="facade.surveys()" 
          [avgRate]="facade.avgSatisfaction()" 
        />
      </div>
    </div>
  `,
  styles: `
    .search-input {
      width: 100%;
      padding: 9px 12px 9px 36px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-default);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
      transition: all var(--duration-fast);
    }
    .search-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 4px 10px;
      transition: all var(--duration-fast);
    }
    .filter-group:hover {
      border-color: var(--ds-brand);
      background: var(--bg-elevated);
    }

    .filter-select {
      background: transparent;
      border: none;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-secondary);
      cursor: pointer;
      outline: none;
      padding: 0;
    }

    .th-col {
      text-align: left;
      padding: 12px 20px;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .table-row {
      transition: background var(--duration-fast);
      cursor: pointer;
    }
    .table-row:hover {
      background: var(--bg-elevated);
    }

    .inas-badge {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      background: var(--bg-subtle);
      border: 1px solid var(--border-subtle);
    }
    .inas-badge[data-licencia*="B"] { color: var(--color-primary); background: var(--color-primary-tint); border-color: var(--color-primary); }
    .inas-badge[data-licencia*="A"] { color: var(--state-warning); background: var(--state-warning-bg); border-color: var(--state-warning-border); }

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 700;
    }
    .status-chip--warn { color: var(--state-warning); background: var(--state-warning-bg); border: 1px solid var(--state-warning-border); }
    .status-chip--success { color: var(--state-success); background: var(--state-success-bg); border: 1px solid var(--state-success-border); }
  `,
})
export class AdminExAlumnosComponent implements OnInit {
  protected readonly facade = inject(ExAlumnosFacade);

  // ── Hero Config ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    {
      id: 'exportar',
      label: 'Exportar Archivo',
      icon: 'download',
      primary: false,
    },
    {
      id: 'activos',
      label: 'Ver Alumnos Activos',
      icon: 'users',
      primary: true,
      route: '/app/admin/alumnos',
    },
  ];

  protected readonly heroChips = computed<SectionHeroChip[]>(() => [
    {
      label: 'Historial Consolidado',
      style: 'default',
      icon: 'archive',
    },
    {
      label: `${this.facade.totalEgresados()} Egresados`,
      style: 'success',
      icon: 'circle-check',
    },
  ]);

  // ── Filtros locales ──────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroAnio = signal('');
  protected readonly filtroLicencia = signal('');
  protected readonly filtroEstado = signal('');

  // ── Lista filtrada (cliente) ─────────────────────────────────────────────────
  protected readonly filteredEgresados = computed<EgresadoTableRow[]>(() => {
    let results: EgresadoTableRow[] = this.facade.egresados();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (e: EgresadoTableRow) =>
          e.nombre.toLowerCase().includes(term) ||
          e.rut.toLowerCase().includes(term) ||
          (e.nroCertificado?.toLowerCase().includes(term) ?? false),
      );
    }
    if (this.filtroAnio()) {
      results = results.filter(
        (e: EgresadoTableRow) => String(e.anio) === this.filtroAnio(),
      );
    }
    if (this.filtroLicencia()) {
      results = results.filter(
        (e: EgresadoTableRow) => e.licencia === this.filtroLicencia(),
      );
    }
    return results;
  });

  // ── Opciones de filtros dinámicas ────────────────────────────────────────────
  protected readonly availableYears = computed<string[]>(() => {
    const years = this.facade
      .egresados()
      .map((e: EgresadoTableRow) => e.anio)
      .filter((y): y is number => y !== null);
    return [...new Set(years)]
      .sort((a: number, b: number) => Number(b) - Number(a))
      .map(String);
  });

  protected readonly availableLicencias = computed<string[]>(() =>
    [
      ...new Set(
        this.facade.egresados().map((e: EgresadoTableRow) => e.licencia),
      ),
    ].sort(),
  );

  ngOnInit(): void {
    void this.facade.loadEgresados();
  }

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'exportar') {
      console.log('[ExAlumnos] Exportando archivo histórico...');
    }
  }

  protected clearFilters(): void {
     this.searchTerm.set('');
     this.filtroAnio.set('');
     this.filtroLicencia.set('');
     this.filtroEstado.set('');
  }
}
