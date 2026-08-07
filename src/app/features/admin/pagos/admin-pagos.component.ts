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
import { LayoutService } from '@core/services/ui/layout.service';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import type { AlumnoDeudor } from '@core/models/ui/pagos.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { DatePickerModule } from 'primeng/datepicker';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RegistrarPagoDrawerComponent } from './registrar-pago-drawer.component';
import { AdminPagoDetalleDrawerComponent } from './admin-pago-detalle-drawer.component';
import { PagosRecientesDrawerComponent } from './pagos-recientes-drawer.component';
import { formatCLP, toISODate } from '@core/utils/date.utils';

function toCompact(amount: number): { value: number; suffix: string } {
  if (amount >= 1_000_000) {
    return { value: parseFloat((amount / 1_000_000).toFixed(1)), suffix: 'M' };
  }
  if (amount >= 10_000) {
    return { value: parseFloat((amount / 1_000).toFixed(1)), suffix: 'K' };
  }
  return { value: amount, suffix: '' };
}

@Component({
  selector: 'app-admin-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    DatePickerModule,
    DateInputComponent,
    DialogModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    StableWidthDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout #bentoGrid>
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

      <!-- ── Alumnos con saldo pendiente (único bloque de contenido — Pagos Recientes
           y Métodos de Pago viven en un drawer, ver PagosRecientesDrawerComponent) ── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col h-full"
        [class.deudores-compact]="layoutDrawer.isOpen()"
        appCardHover
      >
        <div
          class="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-muted"
        >
          <div>
            <h2 class="font-semibold text-text-primary">Alumnos con saldo pendiente</h2>
            <p class="text-xs mt-0.5 text-text-muted">
              Alumnos con saldo por pagar. Registrar abonos para actualizar el saldo y habilitar
              clase 7 cuando corresponda.
            </p>
          </div>
          <span class="text-xs text-text-muted">
            {{ facade.alumnosConDeuda().length }} alumnos
          </span>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
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
            <div
              class="micro-label deudores-grid-cols hidden lg:grid px-6 py-2 gap-4 border-b bg-surface border-border-muted"
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
                  class="deudores-row deudores-grid-cols p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:gap-4 lg:items-center transition-colors"
                >
                  <!-- Identidad Mobile (Alumno + RUT) / Alumno Desktop -->
                  <div class="flex flex-col min-w-0">
                    <span class="item-title truncate" [title]="alumno.alumno">
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
                      <span class="text-sm text-text-primary">{{ clp(alumno.totalAPagar) }}</span>
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
                      <span class="text-sm font-bold text-warning">{{ clp(alumno.saldo) }}</span>
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
          }
        </div>

        <!-- Desktop: paginador real (mismo patrón que alumnos-list-content, 10/página).
             Mobile/tablet: "Cargar más" (maxVisibleDeudores() no-null). -->
        @if (isDesktopTier()) {
          @if (totalPaginasDeudores() > 1) {
            <div
              class="shrink-0 px-6 py-3 flex items-center justify-between border-t border-border-muted"
            >
              <span class="text-xs text-text-muted">{{ rangoDeudoresMostrando() }}</span>
              <div class="flex gap-2">
                <button
                  class="btn-secondary text-sm"
                  [disabled]="paginaDeudoresActual() <= 1"
                  (click)="paginaDeudoresAnterior()"
                  data-llm-action="pagina-anterior-deudores"
                >
                  Anterior
                </button>
                <button
                  class="btn-secondary text-sm"
                  [disabled]="paginaDeudoresActual() >= totalPaginasDeudores()"
                  (click)="paginaDeudoresSiguiente()"
                  data-llm-action="pagina-siguiente-deudores"
                >
                  Siguiente
                </button>
              </div>
            </div>
          }
        } @else if (remainingDeudores() > 0) {
          <div
            class="shrink-0 px-6 py-3 flex items-center justify-center border-t border-border-muted"
          >
            <button
              type="button"
              class="pagination-btn"
              (click)="loadMoreDeudores()"
              data-llm-action="cargar-mas-deudores"
            >
              Cargar más ({{ remainingDeudores() }} restantes)
            </button>
          </div>
        }
      </div>

      @if (facade.error()) {
        <div
          class="bento-banner card p-4 flex items-center gap-3 border-error bg-error/8"
          appCardHover
        >
          <app-icon name="alert-circle" [size]="18" color="var(--state-error)" />
          <p class="text-sm text-error">{{ facade.error() }}</p>
        </div>
      }
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
      appendTo="body"
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
          <p class="micro-label">Período del reporte</p>
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
            [appStableWidth]="facade.isGeneratingReport()"
            (click)="onGenerarReporte()"
            data-llm-action="generate-payment-report"
          >
            @if (facade.isGeneratingReport()) {
              <app-icon name="loader-circle" [size]="14" class="animate-spin" />
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
      /* Da más espacio a Alumno (nombre completo) y menos a RUT, que es de ancho fijo. */
      .deudores-grid-cols {
        grid-template-columns: 2fr 0.8fr 1fr 1fr 1fr 1.2fr;
      }
    `,
  ],
})
export class AdminPagosComponent implements AfterViewInit {
  protected readonly facade = inject(PagosFacade);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly layoutService = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly heroActions: SectionHeroAction[] = [
    {
      id: 'view-pagos-recientes',
      label: 'Pagos Recientes',
      icon: 'receipt',
      primary: false,
    },
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

  // ── Densidad adaptativa: Deudores (fix-132-m / ASG-b-076) ────────────────────
  // Desktop: paginador real (10/página, mismo patrón que alumnos-list-content).
  // Tablet/mobile: presupuesto + "Cargar más" — mismo patrón que admin-secretarias.
  protected readonly isDesktopTier = computed(() => this.layoutService.tier() === 'desktop');

  private static readonly DEUDORES_STEP = 5;
  protected readonly mobileShownDeudores = signal(AdminPagosComponent.DEUDORES_STEP);

  protected readonly maxVisibleDeudores = computed(() =>
    this.isDesktopTier() ? null : this.mobileShownDeudores(),
  );

  private static readonly DEUDORES_PAGE_SIZE = 10;
  protected readonly paginaDeudoresActual = signal(1);

  protected readonly totalPaginasDeudores = computed(() =>
    Math.max(
      1,
      Math.ceil(this.facade.alumnosConDeuda().length / AdminPagosComponent.DEUDORES_PAGE_SIZE),
    ),
  );

  protected readonly rangoDeudoresMostrando = computed(() => {
    const total = this.facade.alumnosConDeuda().length;
    if (total === 0) return '';
    const start = (this.paginaDeudoresActual() - 1) * AdminPagosComponent.DEUDORES_PAGE_SIZE + 1;
    const end = Math.min(
      this.paginaDeudoresActual() * AdminPagosComponent.DEUDORES_PAGE_SIZE,
      total,
    );
    return `Mostrando ${start}-${end} de ${total} alumnos`;
  });

  protected readonly deudoresVisibles = computed<AlumnoDeudor[]>(() => {
    const todos = this.facade.alumnosConDeuda();
    if (this.isDesktopTier()) {
      const start = (this.paginaDeudoresActual() - 1) * AdminPagosComponent.DEUDORES_PAGE_SIZE;
      return todos.slice(start, start + AdminPagosComponent.DEUDORES_PAGE_SIZE);
    }
    return sliceByBudget(todos, this.maxVisibleDeudores());
  });

  protected readonly remainingDeudores = computed(() => {
    const max = this.maxVisibleDeudores();
    if (max === null) return 0;
    return Math.max(0, this.facade.alumnosConDeuda().length - max);
  });

  protected loadMoreDeudores(): void {
    this.mobileShownDeudores.update((n) => n + AdminPagosComponent.DEUDORES_STEP);
  }

  protected paginaDeudoresAnterior(): void {
    if (this.paginaDeudoresActual() > 1) this.paginaDeudoresActual.update((p) => p - 1);
  }

  protected paginaDeudoresSiguiente(): void {
    if (this.paginaDeudoresActual() < this.totalPaginasDeudores())
      this.paginaDeudoresActual.update((p) => p + 1);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  constructor() {
    this.destroyRef.onDestroy(() => this.facade.destroyRealtime());

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
    } else if (actionId === 'view-pagos-recientes') {
      this.layoutDrawer.open(PagosRecientesDrawerComponent, 'Pagos Recientes', 'receipt');
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
