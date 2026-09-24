import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { PagosFacade } from '@core/facades/pagos.facade';
import { AuthFacade } from '@core/facades/auth.facade';
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
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RegistrarPagoDrawerComponent } from '../../admin/pagos/registrar-pago-drawer.component';
import { AdminPagoDetalleDrawerComponent } from '../../admin/pagos/admin-pago-detalle-drawer.component';
import { PagosRecientesDrawerComponent } from '../../admin/pagos/pagos-recientes-drawer.component';
import { formatCLP, formatChileanDate, toISODate } from '@core/utils/date.utils';

function toCompact(amount: number): { value: number; suffix: string } {
  if (amount >= 1_000_000)
    return { value: parseFloat((amount / 1_000_000).toFixed(1)), suffix: 'M' };
  if (amount >= 10_000) return { value: parseFloat((amount / 1_000).toFixed(1)), suffix: 'K' };
  return { value: amount, suffix: '' };
}

@Component({
  selector: 'app-secretaria-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    DatePickerModule,
    DateInputComponent,
    SelectModule,
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
            {{ deudoresFiltrados().length }} de {{ facade.alumnosConDeuda().length }} alumnos
          </span>
        </div>

        <!-- ── Filtros (fix-248-m / ASG-m-005) — client-side sobre alumnosConDeuda() ── -->
        <div
          class="shrink-0 flex flex-col sm:flex-row gap-3 px-6 py-3 border-b border-border-muted"
        >
          <app-date-input
            [id]="'secretaria-pagos-filtro-desde'"
            [value]="filtroFechaDesde()"
            (valueChange)="setFiltroFechaDesde($event)"
            placeholder="Matrícula desde"
            [max]="filtroFechaHasta()"
            data-llm-description="filter debtors by enrollment date, start of range"
          />
          <app-date-input
            [id]="'secretaria-pagos-filtro-hasta'"
            [value]="filtroFechaHasta()"
            (valueChange)="setFiltroFechaHasta($event)"
            placeholder="Matrícula hasta"
            [min]="filtroFechaDesde()"
            data-llm-description="filter debtors by enrollment date, end of range"
          />
          <p-select
            [options]="cursoOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los cursos"
            [ngModel]="filtroCurso()"
            (ngModelChange)="setFiltroCurso($event)"
            styleClass="w-full sm:w-48"
            data-llm-description="filter debtors by course type, class B or professional"
          />
          @if (hayFiltrosActivos()) {
            <button
              type="button"
              class="btn-ghost shrink-0"
              (click)="limpiarFiltros()"
              data-llm-action="clear-debtor-filters"
            >
              <app-icon name="x" [size]="14" />
              Limpiar filtros
            </button>
          }
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
              <span class="dc-fecha">Fecha Matrícula</span>
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
                  <div class="flex flex-col min-w-0">
                    <span class="item-title truncate" [title]="alumno.alumno">{{
                      alumno.alumno
                    }}</span>
                    <span class="text-xs lg:hidden mt-0.5 text-text-secondary"
                      >RUT: {{ alumno.rut }} · {{ fechaCorta(alumno.fechaMatricula) }}</span
                    >
                  </div>
                  <span class="hidden lg:block text-sm text-text-secondary dc-rut">{{
                    alumno.rut
                  }}</span>
                  <span class="hidden lg:block text-sm text-text-secondary dc-fecha">{{
                    fechaCorta(alumno.fechaMatricula)
                  }}</span>
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
                  <div
                    class="deudores-acciones flex items-center gap-2 mt-4 lg:mt-0 lg:justify-end"
                  >
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

    <!-- Modal: Configurar Reporte de Pagos -->
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
        <div class="flex flex-col gap-2">
          <p class="micro-label">Período del reporte</p>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-text-secondary">Desde</label>
              <app-date-input
                [id]="'secretaria-pagos-reporte-desde'"
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
                [id]="'secretaria-pagos-reporte-hasta'"
                [inline]="true"
                [value]="reportEndDateIso"
                (valueChange)="setReportEndDateIso($event)"
                [min]="reportStartDateIso"
                [max]="todayIso"
                data-llm-description="Fecha de fin del período del reporte"
              />
            </div>
          </div>
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
      /* fix-249-m: anchos fijos (no "auto") para Saldo y Acciones — "auto" se mide por el
         contenido de CADA fila (cada .deudores-row es su propio grid container), así que el
         header (mide "Saldo"/"Acciones", texto corto) y las filas (miden nombre+monto+botones,
         más anchas) resolvían columnas de distinto ancho en píxeles y quedaban desalineados.
         El drawer deja ~310px de contenido: Acciones apila los 2 botones (deja de necesitar
         ~200px lado a lado) para que 85px+110px+gaps quepan y aún sobre espacio para Alumno. */
      .deudores-compact .hidden.lg\\:grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 85px 110px !important;
      }
      .deudores-compact .deudores-row {
        grid-template-columns: minmax(0, 1fr) 85px 110px !important;
      }
      .deudores-compact .deudores-acciones {
        flex-direction: column;
        align-items: stretch;
        gap: 0.25rem;
        margin-top: 0 !important;
      }
      /* La grilla compacta deja 3 columnas: hay que esconder las 3 celdas sobrantes, o se
         desbordan (fix-209-m). Va junto con la regla de arriba, nunca sola. */
      .deudores-compact .dc-rut,
      .deudores-compact .dc-fecha,
      .deudores-compact .dc-total,
      .deudores-compact .dc-pagado {
        display: none !important;
      }
      /* Da más espacio a Alumno (nombre completo) y menos a RUT, que es de ancho fijo.
         Incluye columna Fecha Matrícula (fix-248-m), siempre visible.
         Acciones usa minmax(210px, auto) (fix-249-m): "Ver detalle" + "Registrar pago"
         (flex-none, no encogen) suman ~200px — con menos que eso, el flex con justify-end
         desborda hacia la IZQUIERDA (fuera de su propia celda) y se superpone con Saldo. */
      .deudores-grid-cols {
        grid-template-columns: 1.6fr 0.8fr 0.9fr 1fr 1fr 1fr minmax(210px, auto);
      }
    `,
  ],
})
export class SecretariaPagosComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(PagosFacade);
  private readonly authFacade = inject(AuthFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly layoutService = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly heroActions: SectionHeroAction[] = [
    { id: 'view-pagos-recientes', label: 'Pagos Recientes', icon: 'receipt', primary: false },
    { id: 'generate-report', label: 'Generar Reporte', icon: 'file-text', primary: false },
    { id: 'register-payment', label: 'Registrar Pago', icon: 'plus', primary: true },
  ];

  readonly heroChips = computed(() => [
    { label: `${this.facade.boletasMes()} boletas emitidas`, style: 'default' as const },
    { label: `${this.facade.totalDeudores()} con deuda`, style: 'default' as const },
  ]);

  protected readonly clp = formatCLP;

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
    { id: 'boletas', label: 'Boletas Emitidas', value: this.facade.boletasMes(), icon: 'receipt' },
  ]);

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

  // ── Filtros de deudores (fix-248-m / ASG-m-005) ──────────────────────────────
  // Client-side sobre alumnosConDeuda() — mismo patrón que
  // PagosRecientesDrawerComponent.pagosFiltrados(). Se aplican ANTES de paginar/recortar.
  // Sin filtro de sede: la secretaria está anclada a una sola sede (currentUser().branchId).
  protected readonly filtroFechaDesde = signal('');
  protected readonly filtroFechaHasta = signal('');
  protected readonly filtroCurso = signal<string | null>(null);

  protected readonly cursoOptions = [
    { label: 'Todos los cursos', value: null },
    { label: 'Clase B', value: 'class_b' },
    { label: 'Profesional', value: 'professional' },
  ];

  protected readonly deudoresFiltrados = computed<AlumnoDeudor[]>(() => {
    const desde = this.filtroFechaDesde();
    const hasta = this.filtroFechaHasta();
    const curso = this.filtroCurso();

    return this.facade.alumnosConDeuda().filter((d) => {
      const fecha = d.fechaMatricula?.slice(0, 10) ?? null;
      const matchDesde = !desde || (fecha !== null && fecha >= desde);
      const matchHasta = !hasta || (fecha !== null && fecha <= hasta);
      const matchCurso = !curso || d.cursoTipo === curso;
      return matchDesde && matchHasta && matchCurso;
    });
  });

  // Cada setter vuelve a la página 1 — evita quedar en una página fuera de rango
  // (vacía) si el resultado filtrado tiene menos páginas que la actual.
  protected setFiltroFechaDesde(value: string): void {
    this.filtroFechaDesde.set(value);
    this.paginaDeudoresActual.set(1);
  }

  protected setFiltroFechaHasta(value: string): void {
    this.filtroFechaHasta.set(value);
    this.paginaDeudoresActual.set(1);
  }

  protected setFiltroCurso(value: string | null): void {
    this.filtroCurso.set(value);
    this.paginaDeudoresActual.set(1);
  }

  protected readonly hayFiltrosActivos = computed(
    () =>
      this.filtroFechaDesde() !== '' ||
      this.filtroFechaHasta() !== '' ||
      this.filtroCurso() !== null,
  );

  protected limpiarFiltros(): void {
    this.filtroFechaDesde.set('');
    this.filtroFechaHasta.set('');
    this.filtroCurso.set(null);
    this.paginaDeudoresActual.set(1);
  }

  protected fechaCorta(fecha: string | null): string {
    if (!fecha) return '—';
    return formatChileanDate(fecha, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Densidad adaptativa: Deudores (fix-132-m / ASG-b-076) ────────────────────
  // Desktop: paginador real (10/página, mismo patrón que alumnos-list-content).
  // Tablet/mobile: presupuesto + "Cargar más" — mismo patrón que admin-secretarias.
  protected readonly isDesktopTier = computed(() => this.layoutService.tier() === 'desktop');

  private static readonly DEUDORES_STEP = 5;
  protected readonly mobileShownDeudores = signal(SecretariaPagosComponent.DEUDORES_STEP);

  protected readonly maxVisibleDeudores = computed(() =>
    this.isDesktopTier() ? null : this.mobileShownDeudores(),
  );

  private static readonly DEUDORES_PAGE_SIZE = 10;
  protected readonly paginaDeudoresActual = signal(1);

  protected readonly totalPaginasDeudores = computed(() =>
    Math.max(
      1,
      Math.ceil(this.deudoresFiltrados().length / SecretariaPagosComponent.DEUDORES_PAGE_SIZE),
    ),
  );

  protected readonly rangoDeudoresMostrando = computed(() => {
    const total = this.deudoresFiltrados().length;
    if (total === 0) return '';
    const start =
      (this.paginaDeudoresActual() - 1) * SecretariaPagosComponent.DEUDORES_PAGE_SIZE + 1;
    const end = Math.min(
      this.paginaDeudoresActual() * SecretariaPagosComponent.DEUDORES_PAGE_SIZE,
      total,
    );
    return `Mostrando ${start}-${end} de ${total} alumnos`;
  });

  protected readonly deudoresVisibles = computed<AlumnoDeudor[]>(() => {
    const todos = this.deudoresFiltrados();
    if (this.isDesktopTier()) {
      const start = (this.paginaDeudoresActual() - 1) * SecretariaPagosComponent.DEUDORES_PAGE_SIZE;
      return todos.slice(start, start + SecretariaPagosComponent.DEUDORES_PAGE_SIZE);
    }
    return sliceByBudget(todos, this.maxVisibleDeudores());
  });

  protected readonly remainingDeudores = computed(() => {
    const max = this.maxVisibleDeudores();
    if (max === null) return 0;
    return Math.max(0, this.deudoresFiltrados().length - max);
  });

  protected loadMoreDeudores(): void {
    this.mobileShownDeudores.update((n) => n + SecretariaPagosComponent.DEUDORES_STEP);
  }

  protected paginaDeudoresAnterior(): void {
    if (this.paginaDeudoresActual() > 1) this.paginaDeudoresActual.update((p) => p - 1);
  }

  protected paginaDeudoresSiguiente(): void {
    if (this.paginaDeudoresActual() < this.totalPaginasDeudores())
      this.paginaDeudoresActual.update((p) => p + 1);
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.facade.destroyRealtime());
    void this.facade.initialize();
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'register-payment') this.openDrawer(null);
    else if (actionId === 'generate-report') this.showReportModal.set(true);
    else if (actionId === 'view-pagos-recientes') {
      this.layoutDrawer.open(PagosRecientesDrawerComponent, 'Pagos Recientes', 'receipt');
    }
  }

  protected async onGenerarReporte(): Promise<void> {
    await this.facade.generarReporte({
      startDate: toISODate(this.reportStartDate),
      endDate: toISODate(this.reportEndDate),
      branchId: this.authFacade.currentUser()?.branchId ?? null,
    });
    this.showReportModal.set(false);
  }

  protected openDetalle(enrollmentId: number): void {
    this.facade.seleccionarEnrollment(enrollmentId);
    this.layoutDrawer.open(AdminPagoDetalleDrawerComponent, 'Estado de Cuenta', 'file-text');
  }

  protected openDrawer(enrollmentId: number | null): void {
    void this.facade.seleccionarParaPago(enrollmentId);
    this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card');
  }
}
