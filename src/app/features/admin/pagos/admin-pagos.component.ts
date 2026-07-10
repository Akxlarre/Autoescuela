import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { PagosFacade } from '@core/facades/pagos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { AlumnoDeudor } from '@core/models/ui/pagos.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RegistrarPagoDrawerComponent } from './registrar-pago-drawer.component';
import { AdminPagoDetalleDrawerComponent } from './admin-pago-detalle-drawer.component';
import { formatCLP, formatChileanDate, toISODate } from '@core/utils/date.utils';

function toCompact(amount: number): { value: number; suffix: string } {
  if (amount >= 1_000_000) {
    return { value: parseFloat((amount / 1_000_000).toFixed(1)), suffix: 'M' };
  }
  if (amount >= 10_000) {
    return { value: parseFloat((amount / 1_000).toFixed(1)), suffix: 'K' };
  }
  return { value: amount, suffix: '' };
}

const POR_PAGINA = 5;

@Component({
  selector: 'app-admin-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    SelectModule,
    DatePickerModule,
    DateInputComponent,
    DialogModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BadgeComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Cabecera ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Gestión de Pagos"
        subtitle="Registro y seguimiento financiero"
        icon="wallet"
        [actions]="heroActions"
        [chips]="heroChips()"
        [kpis]="heroKpis()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── Contenido principal ─────────────────────────────────────────────── -->
      <div class="bento-banner">
        <div class="flex flex-col gap-6">
          <!-- ── Alumnos con saldo pendiente ────────────────────────────────────── -->
          <div
            class="card p-0 overflow-hidden"
            [class.deudores-compact]="layoutDrawer.isOpen()"
            appCardHover
          >
            <div class="flex items-center justify-between px-6 py-4 border-b border-border-muted">
              <div>
                <h2 class="font-semibold text-text-primary">
                  Alumnos con saldo pendiente
                </h2>
                <p class="text-xs mt-0.5 text-text-muted">
                  Alumnos con saldo por pagar. Registrar abonos para actualizar el saldo y habilitar
                  clase 7 cuando corresponda.
                </p>
              </div>
              <span class="text-xs text-text-muted">
                {{ rangoDeudoresMostrando() }}
              </span>
            </div>

            @if (facade.isLoading()) {
              <div class="rows-divider">
                @for (row of [1, 2, 3, 4]; track row) {
                  <div
                    class="p-4 lg:px-6 lg:py-4 flex flex-col gap-3 lg:grid lg:grid-cols-6 lg:gap-4 lg:items-center"
                  >
                    <div class="lg:col-span-2 flex flex-col gap-1">
                      <app-skeleton-block variant="text" width="80%" height="14px" />
                      <app-skeleton-block
                        variant="text"
                        width="50%"
                        height="10px"
                        class="lg:hidden"
                      />
                    </div>
                    <app-skeleton-block
                      variant="text"
                      width="60%"
                      height="14px"
                      class="hidden lg:block"
                    />
                    <div class="grid grid-cols-3 gap-2 lg:contents mt-2 lg:mt-0">
                      <app-skeleton-block variant="text" width="60%" height="14px" />
                      <app-skeleton-block variant="text" width="60%" height="14px" />
                      <app-skeleton-block variant="text" width="60%" height="14px" />
                    </div>
                    <div class="flex gap-2 justify-end mt-2 lg:mt-0">
                      <app-skeleton-block variant="rect" width="80px" height="28px" />
                      <app-skeleton-block variant="rect" width="100px" height="28px" />
                    </div>
                  </div>
                }
              </div>
            } @else if (facade.alumnosConDeuda().length === 0) {
              <div class="px-6 py-10 flex flex-col items-center gap-2 text-center">
                <app-icon name="check-circle" [size]="32" color="var(--state-success)" />
                <p class="text-sm font-medium text-text-primary">¡Sin saldos pendientes!</p>
                <p class="text-xs text-text-muted">Todos los alumnos están al día con sus pagos.</p>
              </div>
            } @else {
              <div>
                <div
                  class="hidden lg:grid px-6 py-2 grid-cols-6 gap-4 text-xs font-semibold tracking-wide uppercase border-b text-text-muted bg-surface border-border-muted"
                >
                  <span>Alumno</span>
                  <span class="dc-rut">RUT</span>
                  <span class="text-right dc-total">Total a Pagar</span>
                  <span class="text-right dc-pagado">Pagado</span>
                  <span class="text-right">Saldo</span>
                  <span class="text-right">Acciones</span>
                </div>
                <div class="rows-divider">
                  @for (alumno of deudoresVisibles(); track alumno.enrollmentId) {
                    <div
                      class="deudores-row p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-6 lg:gap-4 lg:items-center transition-colors"
                    >
                      <!-- Identidad Mobile (Alumno + RUT) / Alumno Desktop -->
                      <div class="flex flex-col min-w-0">
                        <span class="text-sm font-semibold truncate text-text-primary">
                          {{ alumno.alumno }}
                        </span>
                        <!-- RUT Mobile only -->
                        <span class="text-xs lg:hidden mt-0.5 text-text-secondary">
                          RUT: {{ alumno.rut }}
                        </span>
                      </div>

                      <!-- RUT Desktop only -->
                      <span class="hidden lg:block text-sm text-text-secondary dc-rut">
                        {{ alumno.rut }}
                      </span>

                      <!-- Finanzas -->
                      <div
                        class="finance-mobile-bg grid grid-cols-3 gap-2 lg:contents mt-3 lg:mt-0 p-3 lg:p-0 rounded-lg lg:rounded-none"
                      >
                        <div class="flex flex-col lg:block text-center lg:text-right dc-total">
                          <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                            >Total</span
                          >
                          <span class="text-sm text-text-primary">{{
                            clp(alumno.totalAPagar)
                          }}</span>
                        </div>
                        <div class="flex flex-col lg:block text-center lg:text-right dc-pagado">
                          <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                            >Pagado</span
                          >
                          <span
                            class="text-sm font-medium"
                            [style.color]="
                              alumno.pagado > 0 ? 'var(--state-success)' : 'var(--text-muted)'
                            "
                            >{{ clp(alumno.pagado) }}</span
                          >
                        </div>
                        <div class="flex flex-col lg:block text-center lg:text-right">
                          <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                            >Saldo</span
                          >
                          <span class="text-sm font-bold text-warning">{{
                            clp(alumno.saldo)
                          }}</span>
                        </div>
                      </div>

                      <!-- Acciones -->
                      <div class="flex items-center gap-2 mt-4 lg:mt-0 lg:justify-end">
                        <button
                          class="btn-ghost text-xs flex-1 lg:flex-none justify-center px-3 py-1.5"
                          data-llm-action="view-student-payment-detail"
                          (click)="openDetalle(alumno.enrollmentId)"
                        >
                          Ver detalle
                        </button>
                        <button
                          class="btn-primary text-xs flex-1 lg:flex-none justify-center px-3 py-1.5"
                          data-llm-action="register-student-payment"
                          (click)="openDrawer(alumno.enrollmentId)"
                        >
                          Registrar pago
                        </button>
                      </div>
                    </div>
                  }
                </div>
                @if (totalPaginasDeudores() > 1) {
                  <div
                    class="px-6 py-3 flex items-center justify-between border-t border-border-muted"
                  >
                    <span class="text-xs text-text-muted">
                      {{ rangoDeudoresMostrando() }} alumnos
                    </span>
                    <div class="flex gap-2">
                      <button
                        class="btn-secondary text-sm"
                        [disabled]="paginaDeudoresActual() <= 1"
                        (click)="paginaDeudoresAnterior()"
                      >
                        Anterior
                      </button>
                      <button
                        class="btn-secondary text-sm"
                        [disabled]="paginaDeudoresActual() >= totalPaginasDeudores()"
                        (click)="paginaDeudoresSiguiente()"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- ── Layout: Pagos Recientes | Sidebar ────────────────── -->
          <div
            class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:col-span-12 items-start"
            [class.force-compact]="layoutDrawer.isOpen()"
          >
            <!-- ─ Pagos Recientes (lg:col-span-8) ─────────────────────────────────────────── -->
            <div class="lg:col-span-8 card p-0 overflow-hidden" appCardHover>
              <div
                class="p-4 lg:px-6 lg:py-4 flex flex-col gap-4 border-b border-border-muted bg-surface"
              >
                <h2 class="font-semibold text-text-primary">Pagos Recientes</h2>

                <!-- ── Barra de búsqueda + filtros (Integrada como Toolbar) ── -->
                <div class="flex flex-col xl:flex-row gap-3 w-full">
                  <!-- Input de búsqueda -->
                  <div class="relative flex-1">
                    <div
                      class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                    >
                      <app-icon name="search" [size]="16" color="var(--text-muted)" />
                    </div>
                    <input
                      type="search"
                      placeholder="Buscar por alumno o N° boleta..."
                      class="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg transition-colors focus:outline-none bg-base hover:border-text-muted focus:border-brand border border-border-muted text-text-primary"
                      (input)="onSearch($event)"
                    />
                  </div>

                  <div class="flex flex-col sm:flex-row gap-3">
                    <p-select
                      [options]="estadoOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Todos los estados"
                      [ngModel]="filtroEstado()"
                      (ngModelChange)="filtroEstado.set($event)"
                      styleClass="w-full sm:w-44"
                      data-llm-description="filter payments by status"
                    />
                    <p-select
                      [options]="metodoOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Todos los métodos"
                      [ngModel]="filtroMetodo()"
                      (ngModelChange)="filtroMetodo.set($event)"
                      styleClass="w-full sm:w-48"
                      data-llm-description="filter payments by payment method"
                    />
                  </div>
                </div>
              </div>

              @if (facade.isLoading()) {
                <div class="rows-divider">
                  @for (row of [1, 2, 3, 4, 5]; track row) {
                    <div
                      class="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-7 gap-3 lg:items-center"
                    >
                      <div class="flex justify-between items-center lg:contents">
                        <app-skeleton-block variant="text" width="60%" height="14px" />
                        <app-skeleton-block
                          variant="rect"
                          width="60px"
                          height="20px"
                          class="lg:hidden"
                        />
                      </div>
                      <div class="flex flex-col lg:contents gap-1 lg:gap-0">
                        <app-skeleton-block variant="text" width="90%" height="14px" />
                        <app-skeleton-block variant="text" width="70%" height="12px" />
                      </div>
                      <div
                        class="grid grid-cols-2 lg:contents mt-2 lg:mt-0 pt-2 lg:pt-0 border-t lg:border-none border-border-muted"
                      >
                        <app-skeleton-block variant="text" width="70%" height="12px" />
                        <app-skeleton-block variant="text" width="80%" height="12px" />
                        <app-skeleton-block
                          variant="text"
                          width="80%"
                          height="12px"
                          class="col-span-2 lg:col-span-1 mt-1 lg:mt-0 lg:justify-self-center"
                        />
                      </div>
                      <app-skeleton-block
                        variant="rect"
                        width="80px"
                        height="22px"
                        class="hidden lg:block justify-self-center"
                      />
                    </div>
                  }
                </div>
              } @else if (pagosVisibles().length === 0) {
                <div class="px-6 py-10 flex flex-col items-center gap-2 text-center">
                  <app-icon name="search" [size]="28" color="var(--text-muted)" />
                  <p class="text-sm text-text-muted">
                    No se encontraron pagos con los filtros seleccionados.
                  </p>
                </div>
              } @else {
                <div
                  class="hidden lg:grid px-6 py-2 grid-cols-7 gap-3 text-xs font-semibold tracking-wide uppercase border-b text-text-muted bg-surface border-border-muted"
                >
                  <span>Fecha</span>
                  <span>Alumno</span>
                  <span>Concepto</span>
                  <span class="text-right">Monto</span>
                  <span>Método</span>
                  <span>N° Documento</span>
                  <span class="text-center">Estado</span>
                </div>

                <div class="rows-divider">
                  @for (pago of pagosVisibles(); track pago.id) {
                    <div
                      class="p-4 lg:px-6 lg:py-3.5 flex flex-col lg:grid lg:grid-cols-7 gap-3 lg:items-center hover:bg-[color-mix(in_srgb,var(--bg-surface)_60%,transparent)] transition-colors"
                    >
                      <div class="flex items-center justify-between lg:contents">
                        <span class="text-xs font-medium text-brand">
                          {{ fechaCorta(pago.fecha) }}
                        </span>
                        <app-badge [variant]="estadoVariant(pago.estado)" class="lg:hidden">
                          @if (pago.estado === 'completado') {
                            <app-icon name="check" [size]="10" />
                          }
                          {{ estadoLabel(pago.estado) }}
                        </app-badge>
                      </div>
                      <div class="flex flex-col lg:contents min-w-0">
                        <span class="text-sm font-semibold truncate text-text-primary">
                          {{ pago.alumno }}
                        </span>
                        <span
                          class="text-xs truncate lg:text-text-secondary mt-0.5 lg:mt-0 text-text-muted"
                        >
                          {{ pago.concepto ?? '—' }}
                        </span>
                      </div>
                      <div
                        class="flex flex-col lg:contents mt-2 lg:mt-0 pt-2 lg:pt-0 border-t lg:border-none border-border-muted"
                      >
                        <div class="flex justify-between items-center lg:contents">
                          <span class="text-xs uppercase font-bold lg:hidden text-text-muted"
                            >Monto</span
                          >
                          <span class="text-sm font-bold lg:text-right text-text-primary">
                            {{ clp(pago.monto) }}
                          </span>
                        </div>
                        <div class="flex items-center justify-between lg:contents mt-2 lg:mt-0">
                          <span class="flex items-center gap-1.5 text-xs text-text-secondary">
                            <app-icon [name]="pago.metodoIcono" [size]="13" />
                            {{ pago.metodo }}
                          </span>
                          <span
                            class="text-2xs lg:text-xs font-mono px-1.5 py-0.5 rounded text-text-muted bg-surface border border-border-muted"
                          >
                            {{ pago.nroDocumento ?? '—' }}
                          </span>
                        </div>
                      </div>
                      <div class="hidden lg:flex justify-center">
                        <app-badge [variant]="estadoVariant(pago.estado)">
                          @if (pago.estado === 'completado') {
                            <app-icon name="check" [size]="10" />
                          }
                          {{ estadoLabel(pago.estado) }}
                        </app-badge>
                      </div>
                    </div>
                  }
                </div>

                <div
                  class="px-6 py-3 flex items-center justify-between border-t border-border-muted"
                >
                  <span class="text-xs text-brand">
                    {{ rangoMostrando() }}
                  </span>
                  <div class="flex gap-2">
                    <button
                      class="btn-outline"
                      [disabled]="paginaActual() <= 1"
                      (click)="paginaAnterior()"
                    >
                      Anterior
                    </button>
                    <button
                      class="btn-outline"
                      [disabled]="paginaActual() >= totalPaginas()"
                      (click)="paginaSiguiente()"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              }
            </div>

            <div class="lg:col-span-4 flex flex-col gap-4">
              <div class="card p-5 flex flex-col gap-4" appCardHover>
                <h3 class="text-sm font-semibold text-text-primary">
                  Métodos de Pago ({{ mesActual() }})
                </h3>

                @if (facade.isLoading()) {
                  @for (i of [1, 2, 3]; track i) {
                    <div class="flex flex-col gap-1.5">
                      <app-skeleton-block variant="text" width="60%" height="12px" />
                      <app-skeleton-block variant="rect" width="100%" height="6px" />
                    </div>
                  }
                } @else {
                  @for (metodo of facade.metodosPagoMes(); track metodo.metodo) {
                    <div class="flex flex-col gap-1.5">
                      <div class="flex items-center justify-between">
                        <span
                          class="flex items-center gap-1.5 text-xs font-medium"
                          [style.color]="metodo.color"
                        >
                          <app-icon [name]="metodo.icono" [size]="12" />
                          {{ metodo.metodo }}
                        </span>
                        <span class="text-xs font-semibold text-text-primary"
                          >{{ metodo.porcentaje }}%</span
                        >
                      </div>
                      <div class="h-1.5 rounded-full overflow-hidden bg-border-muted">
                        <div
                          class="h-full rounded-full"
                          [style.width.%]="metodo.porcentaje"
                          [style.background]="metodo.color"
                        ></div>
                      </div>
                    </div>
                  } @empty {
                    <div class="flex flex-col items-center gap-1.5 py-4 text-center">
                      <app-icon name="pie-chart" [size]="22" color="var(--text-muted)" />
                      <p class="text-xs text-text-muted">Sin pagos registrados este mes.</p>
                    </div>
                  }
                }
              </div>
            </div>
          </div>

          @if (facade.error()) {
            <div class="card p-4 flex items-center gap-3 border-error bg-error/8" appCardHover>
              <app-icon name="alert-circle" [size]="18" color="var(--state-error)" />
              <p class="text-sm text-error">{{ facade.error() }}</p>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- ── Modal: Configurar Reporte de Pagos ─────────────────────────────────── -->
    <p-dialog
      header="Configurar Reporte de Pagos"
      [visible]="showReportModal()"
      (visibleChange)="showReportModal.set($event)"
      [modal]="true"
      [closable]="true"
      [dismissableMask]="false"
      [style]="{ width: '560px' }"
      [contentStyle]="{ padding: '0.75rem 1.5rem 1.25rem' }"
    >
      <div class="flex flex-col gap-4">
        <!-- Sede: tomada del selector del topbar, sin opción de cambio aquí -->
        <div
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-brand/8 border border-brand/18"
        >
          <app-icon name="building-2" [size]="15" color="var(--color-primary)" />
          <span class="text-xs text-text-muted">Sede</span>
          <span class="text-sm font-semibold text-brand">{{
            branchFacade.selectedBranchLabel()
          }}</span>
        </div>

        <!-- Rango de fechas (inline — evita overlay que cierra al hacer scroll) -->
        <div class="flex flex-col gap-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Período del reporte
          </p>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-text-secondary">Desde</label>
              <app-date-input
                [inline]="true"
                [value]="reportStartDateIso"
                (valueChange)="setReportStartDateIso($event)"
                [max]="reportEndDateIso"
                data-llm-description="Fecha de inicio del período del reporte"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-text-secondary">Hasta</label>
              <app-date-input
                [inline]="true"
                [value]="reportEndDateIso"
                (valueChange)="setReportEndDateIso($event)"
                [min]="reportStartDateIso"
                [max]="todayIso"
                data-llm-description="Fecha de fin del período del reporte"
              />
            </div>
          </div>
          <!-- Resumen textual de fechas seleccionadas -->
          <div
            class="flex items-center justify-center gap-3 px-3 py-2 rounded-lg text-sm bg-brand/6"
          >
            <span class="text-text-muted">Desde</span>
            <span class="font-semibold text-text-primary">{{
              reportStartDate | date: 'dd/MM/yyyy'
            }}</span>
            <app-icon name="arrow-right" [size]="13" color="var(--text-muted)" />
            <span class="text-text-muted">Hasta</span>
            <span class="font-semibold text-text-primary">{{
              reportEndDate | date: 'dd/MM/yyyy'
            }}</span>
          </div>
        </div>

        <!-- Descripción del contenido -->
        <div
          class="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs text-text-muted bg-text-muted/6"
        >
          <app-icon name="file-text" [size]="13" />
          <span
            >Incluye pagos del período, KPIs de recaudación y resumen de saldos pendientes
            actuales.</span
          >
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="flex justify-end gap-2 px-6 py-4">
          <button
            class="btn-secondary"
            (click)="showReportModal.set(false)"
            [disabled]="facade.isGeneratingReport()"
          >
            Cancelar
          </button>
          <button
            class="btn-primary"
            [disabled]="!reportStartDate || !reportEndDate || facade.isGeneratingReport()"
            (click)="onGenerarReporte()"
            data-llm-action="generate-payment-report"
          >
            @if (facade.isGeneratingReport()) {
              <app-icon name="loader" [size]="14" class="animate-spin" />
              Generando...
            } @else {
              <app-icon name="download" [size]="14" />
              Generar PDF
            }
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .rows-divider > * + * {
        border-top: 1px solid var(--border-muted);
      }
      .deudores-row:hover {
        background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
      }
      .finance-mobile-bg {
        background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
      }
      @media (min-width: 1024px) {
        .finance-mobile-bg {
          background: transparent;
        }
      }
      .force-compact .hidden.lg\\:grid {
        display: none !important;
      }
      .force-compact .lg\\:hidden {
        display: block !important;
      }
      .force-compact .lg\\:grid-cols-6,
      .force-compact .lg\\:grid-cols-7,
      .force-compact .lg\\:grid-cols-12 {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 1rem !important;
      }
      .force-compact .lg\\:contents {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        border-top: 1px solid var(--border-muted) !important;
        padding-top: 0.5rem !important;
        width: 100% !important;
      }
      .force-compact .lg\\:text-right,
      .force-compact .lg\\:text-center {
        text-align: left !important;
      }
      .deudores-compact .hidden.lg\\:grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto auto !important;
      }
      .deudores-compact .deudores-row {
        grid-template-columns: minmax(0, 1fr) auto auto !important;
      }
      .deudores-compact .dc-rut,
      .deudores-compact .dc-total,
      .deudores-compact .dc-pagado {
        display: none !important;
      }
    `,
  ],
})
export class AdminPagosComponent implements AfterViewInit {
  protected readonly facade = inject(PagosFacade);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly heroActions: SectionHeroAction[] = [
    {
      id: 'generate-report',
      label: 'Generar Reporte',
      icon: 'file-text',
      primary: false,
    },
    {
      id: 'register-payment',
      label: 'Registrar Pago',
      icon: 'plus',
      primary: true,
    },
  ];

  readonly heroChips = computed(() => {
    return [
      { label: `${this.facade.boletasMes()} boletas emitidas`, style: 'default' as const },
      { label: `${this.facade.totalDeudores()} con deuda`, style: 'default' as const },
    ];
  });

  // Funciones puras expuestas al template
  protected readonly clp = formatCLP;

  // ── Computed: display values KPI (K / M) ─────────────────────────────────────
  protected readonly ingresosHoyDisplay = computed(() => toCompact(this.facade.ingresosHoy()));
  protected readonly ingresosMesDisplay = computed(() => toCompact(this.facade.ingresosMes()));
  protected readonly pagosPendientesDisplay = computed(() =>
    toCompact(this.facade.pagosPendientesTotales()),
  );

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'ingresos-hoy',
      label: 'Ingresos Hoy',
      value: this.ingresosHoyDisplay().value,
      prefix: '$',
      suffix: this.ingresosHoyDisplay().suffix,
      icon: 'dollar-sign',
    },
    {
      id: 'ingresos-mes',
      label: 'Ingresos Mes',
      value: this.ingresosMesDisplay().value,
      prefix: '$',
      suffix: this.ingresosMesDisplay().suffix,
      icon: 'trending-up',
    },
    {
      id: 'pendientes',
      label: 'Pagos Pendientes',
      value: this.pagosPendientesDisplay().value,
      prefix: '$',
      suffix: this.pagosPendientesDisplay().suffix,
      icon: 'alert-circle',
      color: 'warning',
    },
    {
      id: 'boletas',
      label: 'Boletas Emitidas',
      value: this.facade.boletasMes(),
      icon: 'receipt',
    },
  ]);

  // ── Estado modal: reporte ────────────────────────────────────────────────────
  protected readonly showReportModal = signal(false);
  protected reportStartDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  protected reportEndDate: Date = new Date();

  protected get reportStartDateIso(): string {
    return toISODate(this.reportStartDate);
  }
  protected setReportStartDateIso(v: string) {
    if (!v) return;
    const p = v.split('-');
    this.reportStartDate = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  }
  protected get reportEndDateIso(): string {
    return toISODate(this.reportEndDate);
  }
  protected setReportEndDateIso(v: string) {
    if (!v) return;
    const p = v.split('-');
    this.reportEndDate = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  }
  protected get todayIso(): string {
    return toISODate(this.today);
  }
  protected readonly today = new Date();

  // ── Estado local: búsqueda / filtros / paginación ────────────────────────────
  protected readonly searchQuery = signal('');
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly filtroMetodo = signal<string | null>(null);

  readonly estadoOptions = [
    { label: 'Completado', value: 'completado' },
    { label: 'Pendiente', value: 'pendiente' },
  ];

  readonly metodoOptions = [
    { label: 'Transferencia', value: 'Transferencia' },
    { label: 'Efectivo', value: 'Efectivo' },
    { label: 'Débito/Crédito', value: 'Débito/Crédito' },
    { label: 'WebPay', value: 'WebPay' },
    { label: 'Mixto', value: 'Mixto' },
  ];
  protected readonly paginaDeudoresActual = signal(1);

  protected readonly deudoresVisibles = computed(() => {
    const start = (this.paginaDeudoresActual() - 1) * POR_PAGINA;
    return this.facade.alumnosConDeuda().slice(start, start + POR_PAGINA);
  });

  protected readonly totalPaginasDeudores = computed(() =>
    Math.max(1, Math.ceil(this.facade.alumnosConDeuda().length / POR_PAGINA)),
  );

  protected readonly rangoDeudoresMostrando = computed(() => {
    const total = this.facade.alumnosConDeuda().length;
    if (total === 0) return '';
    const start = (this.paginaDeudoresActual() - 1) * POR_PAGINA + 1;
    const end = Math.min(this.paginaDeudoresActual() * POR_PAGINA, total);
    return `${start}-${end} de ${total}`;
  });

  protected readonly paginaActual = signal(1);

  // ── Computed: tabla filtrada y paginada ──────────────────────────────────────
  protected readonly pagosFiltrados = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const estado = this.filtroEstado();
    const metodo = this.filtroMetodo();

    return this.facade.pagosRecientes().filter((p) => {
      const matchSearch =
        !q ||
        p.alumno.toLowerCase().includes(q) ||
        (p.nroDocumento ?? '').toLowerCase().includes(q);
      const matchEstado = !estado || p.estado === estado;
      const matchMetodo = !metodo || p.metodo === metodo;
      return matchSearch && matchEstado && matchMetodo;
    });
  });

  protected readonly totalFiltrados = computed(() => this.pagosFiltrados().length);

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalFiltrados() / POR_PAGINA)),
  );

  protected readonly pagosVisibles = computed(() => {
    const start = (this.paginaActual() - 1) * POR_PAGINA;
    return this.pagosFiltrados().slice(start, start + POR_PAGINA);
  });

  protected readonly rangoMostrando = computed(() => {
    const total = this.totalFiltrados();
    if (total === 0) return 'Sin resultados';
    const start = (this.paginaActual() - 1) * POR_PAGINA + 1;
    const end = Math.min(this.paginaActual() * POR_PAGINA, total);
    return `Mostrando ${start}-${end} de ${total} pagos`;
  });

  protected readonly mesActual = computed(() => {
    const now = new Date();
    const mes = now.toLocaleDateString('es-Cl', { month: 'long' });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'register-payment') {
      this.openDrawer(null);
    } else if (actionId === 'generate-report') {
      this.showReportModal.set(true);
    }
  }

  protected async onGenerarReporte(): Promise<void> {
    await this.facade.generarReporte({
      startDate: toISODate(this.reportStartDate),
      endDate: toISODate(this.reportEndDate),
      branchId: this.branchFacade.selectedBranchId(),
    });
    this.showReportModal.set(false);
  }

  // ── Handlers de búsqueda / filtros ───────────────────────────────────────────

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.paginaActual.set(1);
  }

  // ── Paginación ───────────────────────────────────────────────────────────────

  protected paginaDeudoresAnterior(): void {
    if (this.paginaDeudoresActual() > 1) this.paginaDeudoresActual.update((p) => p - 1);
  }

  protected paginaDeudoresSiguiente(): void {
    if (this.paginaDeudoresActual() < this.totalPaginasDeudores())
      this.paginaDeudoresActual.update((p) => p + 1);
  }

  protected paginaAnterior(): void {
    if (this.paginaActual() > 1) this.paginaActual.update((p) => p - 1);
  }

  protected paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) this.paginaActual.update((p) => p + 1);
  }

  // ── Helpers de display ───────────────────────────────────────────────────────

  protected fechaCorta(fecha: string | null): string {
    if (!fecha) return '—';
    return formatChileanDate(fecha, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected estadoVariant(estado: string | null): 'success' | 'warning' | 'neutral' {
    switch (estado) {
      case 'completado':
        return 'success';
      case 'pendiente':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  protected estadoLabel(estado: string | null): string {
    switch (estado) {
      case 'completado':
        return 'Completado';
      case 'pendiente':
        return 'Pendiente';
      default:
        return estado ?? '—';
    }
  }

  // ── Drawer: abrir / guardar ───────────────────────────────────────────────────

  protected openDetalle(enrollmentId: number): void {
    this.facade.seleccionarEnrollment(enrollmentId);
    this.layoutDrawer.open(AdminPagoDetalleDrawerComponent, 'Estado de Cuenta', 'file-text');
  }

  protected openDrawer(enrollmentId: number | null): void {
    void this.facade.seleccionarParaPago(enrollmentId);
    this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card');
  }
}
