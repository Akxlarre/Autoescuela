import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  AfterViewInit,
  ElementRef,
  viewChild,
  inject,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type { LiquidacionRow, LiquidacionesKpis } from '@core/models/ui/liquidaciones.model';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-liquidaciones-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    IconComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
  ],
  styles: [
    `
      .liq-table th {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-secondary);
        padding: 10px 12px;
        white-space: nowrap;
        transition:
          padding 0.2s ease,
          font-size 0.2s ease;
      }
      .liq-table.compact-mode th {
        font-size: 10px;
        padding: 8px 8px;
      }
      .liq-table th:first-child {
        padding-left: 24px;
      }
      .liq-table.compact-mode th:first-child {
        padding-left: 16px;
      }
      .liq-table td {
        padding: 14px 12px;
        border-top: 1px solid var(--border-color);
        vertical-align: middle;
        white-space: nowrap;
        transition:
          padding 0.2s ease,
          font-size 0.2s ease;
      }
      .liq-table.compact-mode td {
        padding: 10px 8px;
        font-size: 12px;
      }
      .liq-table td:first-child {
        padding-left: 24px;
      }
      .liq-table.compact-mode td:first-child {
        padding-left: 16px;
      }
      .liq-table tfoot td {
        padding: 12px 16px;
        border-top: 2px solid var(--border-color);
        background: var(--bg-elevated);
        font-weight: 700;
      }
      .liq-table.compact-mode tfoot td {
        padding: 8px 12px;
        font-size: 12px;
      }
      .liq-table tr:hover td {
        background: color-mix(in srgb, var(--ds-brand) 3%, var(--bg-surface));
      }
      .liq-table tfoot tr:hover td {
        background: var(--bg-elevated);
      }

      .anticipo-box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--state-error) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--state-error) 25%, transparent);
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 12px;
        font-weight: 600;
        color: var(--state-error);
        font-variant-numeric: tabular-nums;
      }

      .btn-pagar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--state-success) 35%, transparent);
        background: color-mix(in srgb, var(--state-success) 10%, var(--bg-surface));
        color: var(--state-success);
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
      }
      .btn-pagar:hover {
        background: color-mix(in srgb, var(--state-success) 18%, var(--bg-surface));
      }

      .btn-pagado {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid var(--border-muted);
        background: var(--bg-elevated);
        color: var(--state-success);
        cursor: default;
        white-space: nowrap;
      }

      .btn-deshacer {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
        padding: 5px 10px;
        border-radius: 7px;
        border: 1px solid var(--border-muted);
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition:
          color 0.15s,
          background 0.15s;
        white-space: nowrap;
      }
      .btn-deshacer:hover {
        color: var(--state-error);
        border-color: color-mix(in srgb, var(--state-error) 30%, transparent);
        background: color-mix(in srgb, var(--state-error) 6%, transparent);
      }

      .card-mobile-liq {
        background: var(--bg-surface);
        border: 1px solid var(--border-muted);
        border-radius: 12px;
        padding: 16px;
        transition:
          transform 0.2s ease,
          background 0.2s ease;
      }
      .card-mobile-liq:active {
        transform: scale(0.98);
      }

      .badge-liq {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 6px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .adaptive-grid {
        display: grid !important;
        grid-template-columns: 1fr;
        gap: 16px;
      }

      @container liq-container (min-width: 720px) {
        .adaptive-grid {
          grid-template-columns: repeat(2, 1fr) !important;
        }
      }
      @container liq-container (min-width: 1100px) {
        .adaptive-grid {
          grid-template-columns: repeat(3, 1fr) !important;
        }
      }

      .export-menu {
        min-width: 200px;
        background: var(--bg-surface);
        border: 1px solid var(--border-muted);
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
  ],
  template: `
    <div class="bento-grid" appBentoReveal appBentoGridLayout #pageRef>
      <!-- ── Cabecera de página ─────────────────────────────────────────────────── -->
      <div class="bento-banner relative overflow-visible">
        <app-section-hero
          title="Liquidaciones de Instructores"
          subtitle="Nómina mensual y registro de pagos"
          icon="banknote"
          density="slim"
          [kpis]="heroKpis()"
          [loading]="isLoading()"
          [actions]="heroActions()"
          (actionClick)="onHeroAction($event)"
        />
        @if (exportMenuOpen()) {
          <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
          <div class="export-menu absolute top-14 right-4 z-20">
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('excel')"
              data-llm-action="export-nomina-excel"
            >
              <app-icon name="table-2" [size]="16" />
              Exportar como Excel
            </button>
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('pdf')"
              data-llm-action="export-nomina-pdf"
            >
              <app-icon name="file-text" [size]="16" />
              Exportar como PDF
            </button>
          </div>
        }
      </div>

      <!-- ── Filtros y Mes ───────────────────────────────────────────────────────── -->
      <div
        class="bento-banner flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 py-3 shadow-sm bg-surface"
        style="border:1px solid var(--border-color); border-radius:var(--radius-lg,10px)"
      >
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <!-- Navegación de mes -->
          <div
            class="flex items-center shrink-0 bg-elevated border border-border-muted overflow-hidden"
            style="border-radius:8px"
          >
            <button
              class="px-3 py-2 transition-colors cursor-pointer hover:opacity-75 text-text-secondary"
              style="border-right:1px solid var(--border-muted)"
              (click)="mesAnterior.emit()"
              aria-label="Mes anterior"
            >
              <app-icon name="chevron-left" [size]="16" />
            </button>
            <span
              class="text-sm font-semibold px-4 text-text-primary"
              style="min-width: 140px; text-align: center"
            >
              {{ mesLabel() }}
            </span>
            <button
              class="px-3 py-2 transition-colors cursor-pointer hover:opacity-75 text-text-secondary"
              style="border-left:1px solid var(--border-muted)"
              (click)="mesSiguiente.emit()"
              aria-label="Mes siguiente"
            >
              <app-icon name="chevron-right" [size]="16" />
            </button>
          </div>

          <!-- Buscador -->
          <div class="relative w-64">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              class="w-full h-9 pl-8 pr-8 text-sm rounded-lg border outline-none transition-colors border-border-default bg-surface text-text-primary"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              data-llm-description="Search filter for instructor liquidations by name or RUT"
              aria-label="Buscar instructor"
            />
            @if (query()) {
              <button
                class="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-text-muted"
                (click)="query.set('')"
                aria-label="Limpiar búsqueda"
              >
                <app-icon name="x" [size]="13" />
              </button>
            }
          </div>
        </div>

        <!-- Contadores de estado -->
        <div class="flex items-center gap-4 justify-end shrink-0">
          <span class="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <span style="width:8px;height:8px;border-radius:50%;background:currentColor"></span>
            {{ contadores().pendientes }} Pendientes
          </span>
          <span class="flex items-center gap-1.5 text-xs font-semibold text-brand">
            <span style="width:8px;height:8px;border-radius:50%;background:currentColor"></span>
            {{ contadores().pagados }} Pagados
          </span>
        </div>
      </div>

      <div
        style="border:1px solid var(--border-color); border-radius:var(--radius-lg,10px); container-type:inline-size; container-name:liq-container"
        class="bento-banner shadow-sm bg-surface overflow-hidden"
      >
        <!-- VISTA TABLA (Solo escritorio y drawer cerrado) -->
        @if (!isDrawerOpen()) {
          <div class="hidden md:block w-full">
            <table
              class="w-full liq-table"
              [class.compact-mode]="isDrawerOpen()"
              role="table"
              aria-label="Tabla de liquidaciones de instructores"
            >
              <thead>
                <tr class="bg-elevated">
                  <th class="text-left">Instructor</th>
                  <th class="text-right">Clases Impartidas</th>
                  <th class="text-right">Horas Equivalentes</th>
                  <th class="text-right">Base (Ganado)</th>
                  <th class="text-right">Anticipos (Descuento)</th>
                  <th class="text-right">Total a Pagar</th>
                  <th class="text-center" style="width:180px">Acciones</th>
                </tr>
              </thead>

              <tbody>
                @if (isLoading()) {
                  @for (i of skeletonRows; track i) {
                    <tr>
                      <td>
                        <div class="flex items-center gap-3">
                          <app-skeleton-block variant="circle" width="38px" height="38px" />
                          <div class="flex flex-col gap-1.5">
                            <app-skeleton-block variant="text" width="130px" height="13px" />
                            <app-skeleton-block variant="text" width="80px" height="11px" />
                          </div>
                        </div>
                      </td>
                      @for (j of [1, 2, 3, 4, 5, 6]; track j) {
                        <td><app-skeleton-block variant="text" width="75%" height="13px" /></td>
                      }
                    </tr>
                  }
                } @else if (filtradas().length === 0) {
                  <tr>
                    <td colspan="7" class="py-12 text-center text-sm text-text-muted border-none">
                      @if (query()) {
                        No se encontraron instructores para "{{ query() }}".
                      } @else {
                        No hay instructores registrados para este período.
                      }
                    </td>
                  </tr>
                } @else {
                  @for (row of filtradas(); track row.instructorId) {
                    <tr>
                      <!-- Instructor -->
                      <td>
                        <div class="flex items-center gap-3">
                          <div
                            class="shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                            style="width:38px;height:38px;border-radius:50%;background:{{
                              row.avatarColor
                            }}"
                            aria-hidden="true"
                          >
                            {{ row.initials }}
                          </div>
                          <div class="min-w-0">
                            <p
                              class="text-sm font-semibold text-text-primary leading-tight truncate max-w-30 lg:max-w-50"
                            >
                              {{ row.nombre }}
                            </p>
                            <p
                              class="text-xs text-text-muted mt-0.5 truncate"
                              [pTooltip]="row.rut"
                              tooltipPosition="top"
                            >
                              {{ row.rut }}
                            </p>
                          </div>
                        </div>
                      </td>

                      <!-- Clases impartidas -->
                      <td class="text-right tabular-nums">
                        <span class="text-sm font-semibold text-text-primary">{{
                          row.practicalSessions
                        }}</span>
                        <span class="text-xs text-text-muted ml-1">{{
                          row.practicalSessions === 1 ? 'clase' : 'clases'
                        }}</span>
                      </td>

                      <!-- Horas equivalentes -->
                      <td class="text-right tabular-nums">
                        <span class="text-sm font-semibold text-brand">{{ row.totalHours }}</span>
                        <span class="text-xs text-text-muted ml-1">hrs</span>
                      </td>

                      <!-- Base ganado -->
                      <td class="text-right tabular-nums">
                        <span class="text-sm font-semibold text-success">
                          {{ formatCLP(row.totalBaseAmount) }}
                        </span>
                      </td>

                      <!-- Anticipos -->
                      <td class="text-right">
                        @if (row.totalAdvances > 0) {
                          <div class="flex flex-col items-end gap-1">
                            <span class="anticipo-box">{{ formatCLP(row.totalAdvances) }}</span>
                            <span class="text-xs font-medium tabular-nums text-error">
                              - {{ formatCLP(row.totalAdvances) }}
                            </span>
                          </div>
                        } @else {
                          <span class="text-sm text-text-muted">—</span>
                        }
                      </td>

                      <!-- Total a pagar -->
                      <td class="text-right tabular-nums">
                        <span class="text-sm font-bold text-text-primary">{{
                          formatCLP(row.finalPaymentAmount)
                        }}</span>
                      </td>

                      <!-- Acciones -->
                      <td class="text-center">
                        @if (row.status === 'paid') {
                          <div class="flex items-center justify-center gap-2">
                            <span class="btn-pagado">
                              <app-icon
                                name="check-circle"
                                [size]="13"
                                color="var(--state-success)"
                              />
                              Pagado
                            </span>
                            <button
                              class="btn-deshacer shadow-sm"
                              (click)="onDeshacer(row)"
                              [attr.aria-label]="'Deshacer pago de ' + row.nombre"
                              data-llm-action="deshacer-pago-instructor"
                            >
                              <app-icon name="rotate-ccw" [size]="11" />
                              Deshacer
                            </button>
                          </div>
                        } @else {
                          <button
                            class="btn-pagar shadow-sm"
                            (click)="abrirModal(row)"
                            [attr.aria-label]="'Registrar pago para ' + row.nombre"
                            data-llm-action="pagar-instructor"
                          >
                            <app-icon name="banknote" [size]="13" />
                            Pagar
                          </button>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>

              <!-- Fila de totales escritorio -->
              @if (!isLoading() && filtradas().length > 0) {
                <tfoot>
                  <tr>
                    <td class="text-xs font-bold text-text-secondary uppercase tracking-wide">
                      TOTALES — {{ filtradas().length }}
                      {{ filtradas().length === 1 ? 'instructor' : 'instructores' }}
                    </td>
                    <td class="text-right tabular-nums">
                      <span class="text-sm font-bold text-text-primary">{{
                        totales().clases
                      }}</span>
                      <span class="text-xs text-text-muted ml-1">{{
                        totales().clases === 1 ? 'clase' : 'clases'
                      }}</span>
                    </td>
                    <td class="text-right tabular-nums">
                      <span class="text-sm font-bold text-brand">{{ totales().horas }}</span>
                      <span class="text-xs text-text-muted ml-1">hrs</span>
                    </td>
                    <td class="text-right tabular-nums">
                      <span class="text-sm font-bold text-success">
                        {{ formatCLP(totales().base) }}
                      </span>
                    </td>
                    <td class="text-right">
                      @if (totales().anticipos > 0) {
                        <span class="anticipo-box">{{ formatCLP(totales().anticipos) }}</span>
                      } @else {
                        <span class="text-sm text-text-muted">—</span>
                      }
                    </td>
                    <td class="text-right tabular-nums">
                      <span class="text-base font-bold text-brand">{{
                        formatCLP(totales().total)
                      }}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        }

        <!-- VISTA ADAPTATIVA (Móvil o Desktop con Drawer Abierto) -->
        <div
          [class.md:hidden]="!isDrawerOpen()"
          class="flex flex-col gap-4 p-4 bg-elevated"
          [class.adaptive-grid]="isDrawerOpen()"
        >
          @if (isLoading()) {
            @for (i of skeletonRows; track i) {
              <div class="p-5 rounded-xl border border-border-muted bg-surface">
                <div class="flex items-center gap-3 mb-4">
                  <app-skeleton-block variant="circle" width="38px" height="38px" />
                  <div class="flex flex-col gap-2 flex-1">
                    <app-skeleton-block variant="text" width="60%" height="14px" />
                    <app-skeleton-block variant="text" width="40%" height="12px" />
                  </div>
                </div>
                <app-skeleton-block variant="text" width="100%" height="40px" />
              </div>
            }
          } @else if (filtradas().length === 0) {
            <div class="py-10 text-center text-sm text-text-muted">
              @if (query()) {
                No se encontraron instructores para "{{ query() }}".
              } @else {
                No hay instructores registrados para este período.
              }
            </div>
          } @else {
            @for (row of filtradas(); track row.instructorId) {
              <div class="card-mobile-liq shadow-sm">
                <!-- Header Card (Instructor info) -->
                <div class="flex justify-between items-start mb-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style="width:42px;height:42px;border-radius:50%;background:{{
                        row.avatarColor
                      }}"
                      aria-hidden="true"
                    >
                      {{ row.initials }}
                    </div>
                    <div>
                      <h3 class="text-[15px] font-bold text-text-primary leading-tight">
                        {{ row.nombre }}
                      </h3>
                      <p class="text-xs text-text-muted mt-0.5">{{ row.rut }}</p>
                    </div>
                  </div>

                  @if (row.status === 'paid') {
                    <span class="badge-liq text-success bg-success/12">
                      <app-icon name="check-circle" [size]="12" /> Pagado
                    </span>
                  } @else {
                    <span class="badge-liq text-warning bg-warning/12"> Pendiente </span>
                  }
                </div>

                <!-- Content Card (Metrics) -->
                <div class="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-elevated">
                  <div class="flex flex-col gap-1">
                    <span class="text-2xs uppercase font-bold text-text-muted"
                      >Base (Ganado)</span
                    >
                    <span class="text-[13px] font-bold text-success">
                      {{ formatCLP(row.totalBaseAmount) }}
                    </span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="text-2xs uppercase font-bold text-text-muted"
                      >Horas Equivalentes</span
                    >
                    <div class="text-[13px] font-bold tabular-nums text-brand">
                      {{ row.totalHours }}
                      <span class="font-normal text-text-muted">hrs</span>
                      <span class="text-2xs font-normal text-text-muted ml-1"
                        >({{ row.practicalSessions }}
                        {{ row.practicalSessions === 1 ? 'clase' : 'clases' }})</span
                      >
                    </div>
                  </div>
                  <div
                    class="flex flex-col gap-1 col-span-2 border-t pt-2 mt-1 border-border-muted"
                  >
                    <div class="flex justify-between items-center w-full">
                      <span class="text-2xs uppercase font-bold text-text-muted"
                        >Anticipos Emitidos</span
                      >
                      <span class="text-[13px] font-bold tabular-nums text-error">
                        {{ row.totalAdvances > 0 ? '-' + formatCLP(row.totalAdvances) : '—' }}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1 col-span-2 border-t pt-2 border-border-muted">
                    <div class="flex justify-between items-center w-full">
                      <span class="text-2xs uppercase font-black text-text-primary"
                        >A Pagar</span
                      >
                      <span class="text-lg font-black tracking-tight text-brand">
                        {{ formatCLP(row.finalPaymentAmount) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Actions Card -->
                <div class="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                  @if (row.status === 'paid') {
                    <button
                      class="btn-deshacer w-full sm:w-auto justify-center py-2.5 shadow-sm"
                      (click)="onDeshacer(row)"
                    >
                      <app-icon name="rotate-ccw" [size]="14" />
                      Deshacer Pago
                    </button>
                  } @else {
                    <button
                      class="btn-pagar w-full sm:w-auto justify-center py-2.5 text-sm shadow-sm"
                      (click)="abrirModal(row)"
                    >
                      <app-icon name="banknote" [size]="15" />
                      Registrar Pago
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Mobile Totals Summary -->
            <div class="mt-4 p-4 rounded-xl border-2 border-brand/30 bg-brand/5">
              <h4 class="text-2xs uppercase font-black tracking-widest text-text-primary mb-3">
                Resumen de Totales
              </h4>
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs text-text-muted font-medium">Bases Registradas</span>
                <span class="text-sm font-bold tabular-nums text-success">{{
                  formatCLP(totales().base)
                }}</span>
              </div>
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs text-text-muted font-medium">Anticipos a Descontar</span>
                <span class="text-sm font-bold tabular-nums text-error"
                  >- {{ formatCLP(totales().anticipos) }}</span
                >
              </div>
              <div class="flex justify-between items-center pt-2 mt-2 border-t border-brand/20">
                <span class="text-xs font-black uppercase text-text-primary">Total Final</span>
                <span class="text-lg font-black tabular-nums tracking-tight text-brand">{{
                  formatCLP(totales().total)
                }}</span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- El modal ha sido migrado a LayoutDrawer -->
    </div>
  `,
})
export class LiquidacionesContentComponent implements AfterViewInit {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  liquidaciones = input.required<LiquidacionRow[]>();
  kpis = input.required<LiquidacionesKpis>();
  isLoading = input<boolean>(false);
  isExporting = input<boolean>(false);
  mesActual = input<number>(new Date().getMonth() + 1);
  anioActual = input<number>(new Date().getFullYear());

  // ── Outputs ─────────────────────────────────────────────────────────────────
  mesAnterior = output<void>();
  mesSiguiente = output<void>();
  deshacer = output<LiquidacionRow>();
  pagar = output<LiquidacionRow>();
  exportRequested = output<'excel' | 'pdf'>();

  // ── Inputs adicionales ────────────────────────────────────────────────────
  isDrawerOpen = input<boolean>(false);

  // ── Estado UI interno ───────────────────────────────────────────────────────
  protected readonly query = signal('');
  protected readonly exportMenuOpen = signal(false);

  private readonly gsap = inject(GsapAnimationsService);
  private readonly pageRef = viewChild<ElementRef<HTMLElement>>('pageRef');

  // ── Constantes ───────────────────────────────────────────────────────────────
  protected readonly skeletonRows = Array.from({ length: 5 });

  ngAfterViewInit(): void {
    const el = this.pageRef()?.nativeElement;
    if (el) this.gsap.animateBentoGrid(el);
  }

  protected readonly heroActions = computed<SectionHeroAction[]>(() => [
    {
      id: 'export',
      label: this.isExporting() ? 'Exportando...' : 'Exportar Nómina',
      icon: this.isExporting() ? 'loader-circle' : 'download',
      loading: this.isExporting(),
      disabled: this.isExporting(),
      primary: false,
    },
  ]);

  // ── Computed ─────────────────────────────────────────────────────────────────

  protected readonly heroKpis = computed((): SectionHeroKpi[] => {
    const k = this.kpis();
    const pct =
      k.totalInstructores > 0 ? Math.round((k.totalPagados / k.totalInstructores) * 100) : 0;
    return [
      {
        id: 'nomina',
        label: 'Total Nómina',
        value: formatCLP(k.totalNomina),
        color: 'default',
        icon: 'banknote',
      },
      {
        id: 'anticipos',
        label: 'Anticipos',
        value: formatCLP(k.totalAnticipos),
        color: k.totalAnticipos > 0 ? 'error' : 'default',
        icon: 'trending-down',
      },
      {
        id: 'pagados',
        label: 'Pagados',
        value: `${k.totalPagados} / ${k.totalInstructores}`,
        color: 'success',
        icon: 'check-circle',
        trend: pct,
        trendLabel: '%',
      },
    ];
  });

  protected readonly mesLabel = computed(
    () => `${MESES[this.mesActual() - 1]} ${this.anioActual()}`,
  );

  protected readonly filtradas = computed<LiquidacionRow[]>(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.liquidaciones();
    return this.liquidaciones().filter(
      (r) => r.nombre.toLowerCase().includes(q) || r.rut.toLowerCase().includes(q),
    );
  });

  protected readonly contadores = computed(() => {
    const rows = this.liquidaciones();
    return {
      pendientes: rows.filter((r) => r.status === 'pending').length,
      pagados: rows.filter((r) => r.status === 'paid').length,
    };
  });

  protected readonly progresoPagos = computed(() => {
    const total = this.kpis().totalInstructores;
    return total > 0 ? (this.kpis().totalPagados / total) * 100 : 0;
  });

  protected readonly totales = computed(() => {
    const rows = this.filtradas();
    return {
      clases: rows.reduce((s, r) => s + r.practicalSessions, 0),
      horas: rows.reduce((s, r) => s + r.totalHours, 0),
      base: rows.reduce((s, r) => s + r.totalBaseAmount, 0),
      anticipos: rows.reduce((s, r) => s + r.totalAdvances, 0),
      total: rows.reduce((s, r) => s + r.finalPaymentAmount, 0),
    };
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  protected formatCLP(value: number): string {
    return formatCLP(value);
  }

  protected abrirModal(row: LiquidacionRow): void {
    this.pagar.emit(row);
  }

  protected onDeshacer(row: LiquidacionRow): void {
    this.deshacer.emit(row);
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'export' && !this.isExporting()) {
      this.exportMenuOpen.set(!this.exportMenuOpen());
    }
  }

  protected requestExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    this.exportRequested.emit(format);
  }
}
