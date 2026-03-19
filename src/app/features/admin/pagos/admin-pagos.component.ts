import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { PagosFacade } from '@core/facades/pagos.facade';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { formatCLP, formatChileanDate } from '@core/utils/date.utils';

/** Convierte un monto CLP a representación compacta (K / M) para KPI cards. */
function toCompact(amount: number): { value: number; suffix: string } {
  if (amount >= 1_000_000) {
    return { value: parseFloat((amount / 1_000_000).toFixed(2)), suffix: 'M' };
  }
  return { value: Math.round(amount / 1_000), suffix: 'K' };
}

const POR_PAGINA = 5;

@Component({
  selector: 'app-admin-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiCardVariantComponent, SkeletonBlockComponent, IconComponent],
  template: `
    <div class="p-6 flex flex-col gap-6">
      <!-- ── Cabecera ──────────────────────────────────────────────────────────── -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold" style="color: var(--text-primary)">
            Gestión de Pagos
          </h1>
          <p class="text-sm mt-0.5" style="color: var(--color-primary)">
            Registro y seguimiento de pagos
          </p>
        </div>
        <button
          class="btn-primary flex items-center gap-2 shrink-0"
          data-llm-action="register-payment"
        >
          <app-icon name="plus" [size]="16" />
          Registrar Pago
        </button>
      </div>

      <!-- ── KPI Grid ─────────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <app-kpi-card-variant
          label="Ingresos Hoy"
          [value]="ingresosHoyDisplay().value"
          [loading]="facade.isLoading()"
          icon="dollar-sign"
          prefix="$"
          [suffix]="ingresosHoyDisplay().suffix"
          [subValue]="clp(facade.ingresosHoy())"
        />
        <app-kpi-card-variant
          label="Ingresos Mes"
          [value]="ingresosMesDisplay().value"
          [loading]="facade.isLoading()"
          icon="trending-up"
          prefix="$"
          [suffix]="ingresosMesDisplay().suffix"
          [subValue]="clp(facade.ingresosMes())"
        />
        <app-kpi-card-variant
          label="Pagos Pendientes"
          [value]="pagosPendientesDisplay().value"
          [loading]="facade.isLoading()"
          icon="alert-circle"
          prefix="$"
          [suffix]="pagosPendientesDisplay().suffix"
          [subValue]="facade.totalDeudores() + ' alumnos'"
          color="warning"
        />
        <app-kpi-card-variant
          label="Boletas Emitidas"
          [value]="facade.boletasMes()"
          [loading]="facade.isLoading()"
          icon="receipt"
          subValue="Este mes"
        />
      </div>

      <!-- ── Alumnos con saldo pendiente ────────────────────────────────────── -->
      <div class="card p-0 overflow-hidden">
        <div
          class="flex items-center justify-between px-6 py-4 border-b"
          style="border-color: var(--border-muted)"
        >
          <div>
            <h2 class="text-base font-semibold" style="color: var(--text-primary)">
              Alumnos con saldo pendiente
            </h2>
            <p class="text-xs mt-0.5" style="color: var(--color-primary)">
              Alumnos con saldo por pagar. Registrar abonos para actualizar el saldo y habilitar
              clase 7 cuando corresponda.
            </p>
          </div>
          <button
            class="text-sm font-medium flex items-center gap-1"
            style="color: var(--text-secondary)"
            data-llm-action="view-full-account-status"
          >
            Ver estado de cuenta completo
            <app-icon name="arrow-right" [size]="14" />
          </button>
        </div>

        @if (facade.isLoading()) {
          <div class="divide-y" style="border-color: var(--border-muted)">
            @for (row of [1, 2, 3, 4]; track row) {
              <div class="px-6 py-4 grid grid-cols-6 gap-4 items-center">
                <app-skeleton-block variant="text" width="80%" height="14px" />
                <app-skeleton-block variant="text" width="70%" height="14px" />
                <app-skeleton-block variant="text" width="60%" height="14px" />
                <app-skeleton-block variant="text" width="60%" height="14px" />
                <app-skeleton-block variant="text" width="60%" height="14px" />
                <div class="flex gap-2 justify-end">
                  <app-skeleton-block variant="rect" width="80px" height="28px" />
                  <app-skeleton-block variant="rect" width="120px" height="28px" />
                </div>
              </div>
            }
          </div>
        } @else if (facade.alumnosConDeuda().length === 0) {
          <div class="px-6 py-10 flex flex-col items-center gap-2 text-center">
            <app-icon name="check-circle" [size]="32" color="var(--state-success)" />
            <p class="text-sm font-medium" style="color: var(--text-primary)">
              ¡Sin saldos pendientes!
            </p>
            <p class="text-xs" style="color: var(--text-muted)">
              Todos los alumnos están al día con sus pagos.
            </p>
          </div>
        } @else {
          <div
            class="px-6 py-2 grid grid-cols-6 gap-4 text-xs font-semibold tracking-wide uppercase"
            style="color: var(--text-muted); background: var(--bg-surface)"
          >
            <span>Alumno</span>
            <span>RUT</span>
            <span class="text-right">Total a Pagar</span>
            <span class="text-right">Pagado</span>
            <span class="text-right">Saldo</span>
            <span class="text-right">Acciones</span>
          </div>
          <div class="divide-y" style="border-color: var(--border-muted)">
            @for (alumno of facade.alumnosConDeuda(); track alumno.enrollmentId) {
              <div class="px-6 py-4 grid grid-cols-6 gap-4 items-center">
                <span class="text-sm font-semibold" style="color: var(--text-primary)">
                  {{ alumno.alumno }}
                </span>
                <span class="text-sm" style="color: var(--color-primary)">
                  {{ alumno.rut }}
                </span>
                <span class="text-sm text-right" style="color: var(--text-primary)">
                  {{ clp(alumno.totalAPagar) }}
                </span>
                <span class="text-sm text-right font-medium" style="color: var(--state-success)">
                  {{ clp(alumno.pagado) }}
                </span>
                <span class="text-sm text-right font-semibold" style="color: var(--state-warning)">
                  {{ clp(alumno.saldo) }}
                </span>
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="text-xs font-medium"
                    style="color: var(--text-secondary)"
                    [attr.data-llm-action]="'view-detail-enrollment-' + alumno.enrollmentId"
                  >
                    Ver detalle
                  </button>
                  <button
                    class="btn-primary text-xs px-3 py-1.5"
                    [attr.data-llm-action]="'register-payment-enrollment-' + alumno.enrollmentId"
                  >
                    Registrar pago
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- ── Barra de búsqueda + filtros ───────────────────────────────────── -->
      <div class="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Buscar por alumno o N° boleta..."
          class="flex-1 min-w-48 text-sm px-4 py-2.5 rounded-lg"
          style="
            background: var(--bg-surface);
            border: 1px solid var(--border-muted);
            color: var(--text-primary);
            outline: none;
          "
          data-llm-description="Search input for filtering payments by student name or receipt number"
          (input)="onSearch($event)"
        />
        <select
          class="text-sm px-3 py-2.5 rounded-lg"
          style="
            background: var(--bg-surface);
            border: 1px solid var(--border-muted);
            color: var(--text-primary);
          "
          (change)="onFiltroEstado($event)"
        >
          <option value="todos">Todos los estados</option>
          <option value="completado">Completado</option>
          <option value="pendiente">Pendiente</option>
        </select>
        <select
          class="text-sm px-3 py-2.5 rounded-lg"
          style="
            background: var(--bg-surface);
            border: 1px solid var(--border-muted);
            color: var(--text-primary);
          "
          (change)="onFiltroMetodo($event)"
        >
          <option value="todos">Todos los métodos</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Débito/Crédito">Débito/Crédito</option>
          <option value="WebPay">WebPay</option>
          <option value="Mixto">Mixto</option>
        </select>
      </div>

      <!-- ── Layout dos columnas: Pagos Recientes | Sidebar ────────────────── -->
      <div class="grid grid-cols-3 gap-6 items-start">
        <!-- ─ Pagos Recientes (2/3) ─────────────────────────────────────────── -->
        <div class="col-span-2 card p-0 overflow-hidden">
          <div class="px-6 py-4 border-b" style="border-color: var(--border-muted)">
            <h2 class="text-base font-semibold" style="color: var(--text-primary)">
              Pagos Recientes
            </h2>
          </div>

          @if (facade.isLoading()) {
            <div class="divide-y" style="border-color: var(--border-muted)">
              @for (row of [1, 2, 3, 4, 5]; track row) {
                <div class="px-6 py-4 grid grid-cols-7 gap-3 items-center">
                  <app-skeleton-block variant="text" width="80%" height="12px" />
                  <app-skeleton-block variant="text" width="90%" height="12px" />
                  <app-skeleton-block variant="text" width="70%" height="12px" />
                  <app-skeleton-block variant="text" width="60%" height="12px" />
                  <app-skeleton-block variant="text" width="80%" height="12px" />
                  <app-skeleton-block variant="text" width="70%" height="12px" />
                  <app-skeleton-block variant="rect" width="80px" height="22px" />
                </div>
              }
            </div>
          } @else if (pagosVisibles().length === 0) {
            <div class="px-6 py-10 flex flex-col items-center gap-2 text-center">
              <app-icon name="search" [size]="28" color="var(--text-muted)" />
              <p class="text-sm" style="color: var(--text-muted)">
                No se encontraron pagos con los filtros seleccionados.
              </p>
            </div>
          } @else {
            <!-- Header columnas -->
            <div
              class="px-6 py-2 grid grid-cols-7 gap-3 text-xs font-semibold tracking-wide uppercase"
              style="color: var(--text-muted); background: var(--bg-surface)"
            >
              <span>Fecha</span>
              <span>Alumno</span>
              <span>Concepto</span>
              <span class="text-right">Monto</span>
              <span>Método</span>
              <span>N° Documento</span>
              <span class="text-center">Estado</span>
            </div>

            <div class="divide-y" style="border-color: var(--border-muted)">
              @for (pago of pagosVisibles(); track pago.id) {
                <div class="px-6 py-3.5 grid grid-cols-7 gap-3 items-center">
                  <!-- Fecha -->
                  <span class="text-xs font-medium" style="color: var(--color-primary)">
                    {{ fechaCorta(pago.fecha) }}
                  </span>

                  <!-- Alumno -->
                  <span class="text-sm font-semibold truncate" style="color: var(--text-primary)">
                    {{ pago.alumno }}
                  </span>

                  <!-- Concepto -->
                  <span class="text-xs truncate" style="color: var(--text-secondary)">
                    {{ pago.concepto ?? '—' }}
                  </span>

                  <!-- Monto -->
                  <span class="text-sm font-bold text-right" style="color: var(--text-primary)">
                    {{ clp(pago.monto) }}
                  </span>

                  <!-- Método con ícono -->
                  <span
                    class="flex items-center gap-1.5 text-xs"
                    style="color: var(--text-secondary)"
                  >
                    <app-icon [name]="pago.metodoIcono" [size]="13" />
                    {{ pago.metodo }}
                  </span>

                  <!-- N° Documento -->
                  <span
                    class="text-xs font-mono px-1.5 py-0.5 rounded"
                    style="
                      color: var(--text-muted);
                      background: var(--bg-surface);
                      border: 1px solid var(--border-muted);
                    "
                  >
                    {{ pago.nroDocumento ?? '—' }}
                  </span>

                  <!-- Estado badge -->
                  <span
                    class="inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mx-auto"
                    [style.background]="estadoBg(pago.estado)"
                    [style.color]="estadoColor(pago.estado)"
                  >
                    @if (pago.estado === 'completado') {
                      <app-icon name="check" [size]="10" />
                    }
                    {{ estadoLabel(pago.estado) }}
                  </span>
                </div>
              }
            </div>

            <!-- Footer: paginación -->
            <div
              class="px-6 py-3 flex items-center justify-between border-t"
              style="border-color: var(--border-muted)"
            >
              <span class="text-xs" style="color: var(--color-primary)">
                {{ rangoMostrando() }}
              </span>
              <div class="flex gap-2">
                <button
                  class="text-sm px-4 py-1.5 rounded-lg border font-medium"
                  style="
                    border-color: var(--border-muted);
                    color: var(--text-primary);
                    background: var(--bg-surface);
                  "
                  [disabled]="paginaActual() <= 1"
                  [style.opacity]="paginaActual() <= 1 ? '0.4' : '1'"
                  (click)="paginaAnterior()"
                  data-llm-action="pagos-recientes-prev-page"
                >
                  Anterior
                </button>
                <button
                  class="text-sm px-4 py-1.5 rounded-lg border font-medium"
                  style="
                    border-color: var(--border-muted);
                    color: var(--text-primary);
                    background: var(--bg-surface);
                  "
                  [disabled]="paginaActual() >= totalPaginas()"
                  [style.opacity]="paginaActual() >= totalPaginas() ? '0.4' : '1'"
                  (click)="paginaSiguiente()"
                  data-llm-action="pagos-recientes-next-page"
                >
                  Siguiente
                </button>
              </div>
            </div>
          }
        </div>

        <!-- ─ Sidebar derecho (1/3) ──────────────────────────────────────────── -->
        <div class="col-span-1 flex flex-col gap-4">
          <!-- Métodos de Pago del Mes -->
          <div class="card p-5 flex flex-col gap-4">
            <h3 class="text-sm font-semibold" style="color: var(--text-primary)">
              Métodos de Pago ({{ mesActual() }})
            </h3>

            @if (facade.isLoading()) {
              @for (i of [1, 2, 3]; track i) {
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="60%" height="12px" />
                  <app-skeleton-block variant="rect" width="100%" height="6px" />
                </div>
              }
            } @else if (facade.metodosPagoMes().length === 0) {
              <p class="text-xs text-center py-2" style="color: var(--text-muted)">
                Sin pagos registrados este mes.
              </p>
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
                    <span class="text-xs font-semibold" style="color: var(--text-primary)">
                      {{ metodo.porcentaje }}%
                    </span>
                  </div>
                  <!-- Barra de progreso -->
                  <div
                    class="h-1.5 rounded-full overflow-hidden"
                    style="background: var(--border-muted)"
                  >
                    <div
                      class="h-full rounded-full"
                      [style.width.%]="metodo.porcentaje"
                      [style.background]="metodo.color"
                    ></div>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Accesos Rápidos -->
          <div class="card p-5 flex flex-col gap-3">
            <h3 class="text-sm font-semibold" style="color: var(--text-primary)">
              Accesos Rápidos
            </h3>
            <button
              class="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium text-left btn-primary"
              data-llm-action="quick-register-payment"
            >
              <app-icon name="plus" [size]="16" />
              Registrar Pago
            </button>
            <button
              class="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium text-left"
              style="
                background: var(--bg-surface);
                border: 1px solid var(--border-muted);
                color: var(--text-primary);
              "
              data-llm-action="view-pending-payments"
            >
              <app-icon name="clock" [size]="16" color="var(--text-secondary)" />
              Ver Pendientes
            </button>
            <button
              class="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium text-left"
              style="
                background: var(--bg-surface);
                border: 1px solid var(--border-muted);
                color: var(--text-primary);
              "
              data-llm-action="generate-payment-report"
            >
              <app-icon name="file-text" [size]="16" color="var(--text-secondary)" />
              Generar Reporte
            </button>
          </div>

          <!-- Recordatorio -->
          <div
            class="card p-4 flex flex-col gap-1"
            style="border-color: var(--color-primary); border-left-width: 3px"
          >
            <div class="flex items-center gap-2">
              <app-icon name="info" [size]="15" color="var(--color-primary)" />
              <span class="text-sm font-semibold" style="color: var(--color-primary)">
                Recordatorio
              </span>
            </div>
            <p class="text-xs pl-5" style="color: var(--color-primary)">
              Revisa los pagos pendientes de boleta esta semana.
            </p>
            <button
              class="text-xs pl-5 mt-0.5 font-medium text-left"
              style="color: var(--color-primary)"
              data-llm-action="view-payments-without-receipt"
            >
              Ver lista →
            </button>
          </div>
        </div>
      </div>

      <!-- Error global -->
      @if (facade.error()) {
        <div
          class="card p-4 flex items-center gap-3"
          style="border-color: var(--state-error); background: color-mix(in srgb, var(--state-error) 8%, transparent)"
        >
          <app-icon name="alert-circle" [size]="18" color="var(--state-error)" />
          <p class="text-sm" style="color: var(--state-error)">{{ facade.error() }}</p>
        </div>
      }
    </div>
  `,
})
export class AdminPagosComponent implements OnInit {
  protected readonly facade = inject(PagosFacade);
  private readonly destroyRef = inject(DestroyRef);

  // Funciones puras expuestas al template
  protected readonly clp = formatCLP;

  // ── Computed: display values KPI (K / M) ─────────────────────────────────────
  protected readonly ingresosHoyDisplay = computed(() => toCompact(this.facade.ingresosHoy()));
  protected readonly ingresosMesDisplay = computed(() => toCompact(this.facade.ingresosMes()));
  protected readonly pagosPendientesDisplay = computed(() =>
    toCompact(this.facade.pagosPendientesTotales()),
  );

  // ── Estado local: búsqueda / filtros / paginación ────────────────────────────
  protected readonly searchQuery = signal('');
  protected readonly filtroEstado = signal('todos');
  protected readonly filtroMetodo = signal('todos');
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
      const matchEstado = estado === 'todos' || p.estado === estado;
      const matchMetodo = metodo === 'todos' || p.metodo === metodo;
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
    const mes = now.toLocaleDateString('es-CL', { month: 'long' });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.facade.initialize();
  }

  // ── Handlers de búsqueda / filtros ───────────────────────────────────────────

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.paginaActual.set(1);
  }

  protected onFiltroEstado(event: Event): void {
    this.filtroEstado.set((event.target as HTMLSelectElement).value);
    this.paginaActual.set(1);
  }

  protected onFiltroMetodo(event: Event): void {
    this.filtroMetodo.set((event.target as HTMLSelectElement).value);
    this.paginaActual.set(1);
  }

  // ── Paginación ───────────────────────────────────────────────────────────────

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

  protected estadoBg(estado: string | null): string {
    switch (estado) {
      case 'completado':
        return 'color-mix(in srgb, var(--state-success) 15%, transparent)';
      case 'pendiente':
        return 'color-mix(in srgb, var(--state-warning) 15%, transparent)';
      default:
        return 'color-mix(in srgb, var(--text-muted) 10%, transparent)';
    }
  }

  protected estadoColor(estado: string | null): string {
    switch (estado) {
      case 'completado':
        return 'var(--state-success)';
      case 'pendiente':
        return 'var(--state-warning)';
      default:
        return 'var(--text-muted)';
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
}
