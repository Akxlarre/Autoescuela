import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { PagosFacade } from '@core/facades/pagos.facade';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { formatCLP } from '@core/utils/date.utils';

/** Convierte un monto CLP a representación compacta para la KPI card (K / M). */
function toCompact(amount: number): { value: number; suffix: string } {
  if (amount >= 1_000_000) {
    return { value: parseFloat((amount / 1_000_000).toFixed(2)), suffix: 'M' };
  }
  return { value: Math.round(amount / 1_000), suffix: 'K' };
}

@Component({
  selector: 'app-admin-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiCardVariantComponent, SkeletonBlockComponent, IconComponent],
  template: `
    <!-- ── Cabecera ──────────────────────────────────────────────────────────── -->
    <div class="p-6 flex flex-col gap-6">
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

      <!-- ── KPI Grid ──────────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Ingresos Hoy -->
        <app-kpi-card-variant
          label="Ingresos Hoy"
          [value]="ingresosHoyDisplay().value"
          [loading]="facade.isLoading()"
          icon="dollar-sign"
          prefix="$"
          [suffix]="ingresosHoyDisplay().suffix"
          [subValue]="formatCLP(facade.ingresosHoy())"
        />

        <!-- Ingresos Mes -->
        <app-kpi-card-variant
          label="Ingresos Mes"
          [value]="ingresosMesDisplay().value"
          [loading]="facade.isLoading()"
          icon="trending-up"
          prefix="$"
          [suffix]="ingresosMesDisplay().suffix"
          [subValue]="formatCLP(facade.ingresosMes())"
        />

        <!-- Pagos Pendientes -->
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

        <!-- Boletas Emitidas -->
        <app-kpi-card-variant
          label="Boletas Emitidas"
          [value]="facade.boletasMes()"
          [loading]="facade.isLoading()"
          icon="receipt"
          subValue="Este mes"
        />
      </div>

      <!-- ── Tabla: Alumnos con saldo pendiente ──────────────────────────────── -->
      <div class="card p-0 overflow-hidden">
        <!-- Card Header -->
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

        <!-- Tabla -->
        @if (facade.isLoading()) {
          <!-- Skeleton rows -->
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
          <div class="px-6 py-12 flex flex-col items-center gap-2 text-center">
            <app-icon name="check-circle" [size]="32" color="var(--state-success)" />
            <p class="text-sm font-medium" style="color: var(--text-primary)">
              ¡Sin saldos pendientes!
            </p>
            <p class="text-xs" style="color: var(--text-muted)">
              Todos los alumnos están al día con sus pagos.
            </p>
          </div>
        } @else {
          <!-- Header de columnas -->
          <div
            class="px-6 py-2 grid grid-cols-6 gap-4 text-xs font-semibold tracking-wide"
            style="color: var(--text-muted); background: var(--bg-surface)"
          >
            <span>ALUMNO</span>
            <span>RUT</span>
            <span class="text-right">TOTAL A PAGAR</span>
            <span class="text-right">PAGADO</span>
            <span class="text-right">SALDO</span>
            <span class="text-right">ACCIONES</span>
          </div>

          <!-- Filas de deudores -->
          <div class="divide-y" style="border-color: var(--border-muted)">
            @for (alumno of facade.alumnosConDeuda(); track alumno.enrollmentId) {
              <div class="px-6 py-4 grid grid-cols-6 gap-4 items-center">
                <!-- Alumno -->
                <span class="text-sm font-semibold" style="color: var(--text-primary)">
                  {{ alumno.alumno }}
                </span>

                <!-- RUT -->
                <span class="text-sm" style="color: var(--color-primary)">
                  {{ alumno.rut }}
                </span>

                <!-- Total a Pagar -->
                <span class="text-sm text-right" style="color: var(--text-primary)">
                  {{ formatCLP(alumno.totalAPagar) }}
                </span>

                <!-- Pagado -->
                <span class="text-sm text-right font-medium" style="color: var(--state-success)">
                  {{ formatCLP(alumno.pagado) }}
                </span>

                <!-- Saldo -->
                <span class="text-sm text-right font-semibold" style="color: var(--state-warning)">
                  {{ formatCLP(alumno.saldo) }}
                </span>

                <!-- Acciones -->
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

      <!-- Error global -->
      @if (facade.error()) {
        <div
          class="card p-4 flex items-center gap-3"
          style="border-color: var(--state-error); background: var(--state-error-bg)"
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

  // Función pura expuesta al template para formatear CLP
  protected readonly formatCLP = formatCLP;

  // Computed: valores compactos (K/M) para el display principal de los KPI cards
  protected readonly ingresosHoyDisplay = computed(() => toCompact(this.facade.ingresosHoy()));
  protected readonly ingresosMesDisplay = computed(() => toCompact(this.facade.ingresosMes()));
  protected readonly pagosPendientesDisplay = computed(() =>
    toCompact(this.facade.pagosPendientesTotales()),
  );

  ngOnInit(): void {
    this.facade.initialize();
  }
}
