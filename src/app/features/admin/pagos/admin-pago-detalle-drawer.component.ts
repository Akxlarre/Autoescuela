import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { PagosFacade } from '@core/facades/pagos.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { RegistrarPagoDrawerComponent } from './registrar-pago-drawer.component';
import { formatCLP, formatChileanDate } from '@core/utils/date.utils';

/**
 * AdminPagoDetalleDrawerComponent — Estado de cuenta de una matrícula.
 *
 * Cargado dinámicamente vía LayoutDrawerFacadeService.push() desde AdminPagosComponent.
 * Antes de abrir, el padre llama facade.seleccionarEnrollment(id) para fijar el contexto.
 *
 * Secciones:
 *   1. Ficha del alumno (nombre, RUT, email, teléfono, curso)
 *   2. 3 KPI mini-cards: Total del Curso · Total Pagado · Saldo Pendiente
 *   3. Botón "+ Registrar Pago" → abre RegistrarPagoDrawerComponent en overlay
 *   4. Tabla historial de pagos de la matrícula
 */
@Component({
  selector: 'app-admin-pago-detalle-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, RegistrarPagoDrawerComponent],
  template: `
    <div class="flex flex-col gap-5 p-1">
      <!-- ── Skeleton ──────────────────────────────────────────────────────────── -->
      @if (facade.isLoadingDetalle()) {
        <div class="flex flex-col gap-4">
          <!-- Ficha alumno skeleton -->
          <div class="card p-4 flex flex-col gap-3">
            <app-skeleton-block variant="text" width="60%" height="20px" />
            <app-skeleton-block variant="text" width="40%" height="14px" />
            <app-skeleton-block variant="text" width="50%" height="14px" />
          </div>
          <!-- KPIs skeleton -->
          <div class="grid grid-cols-3 gap-3">
            @for (i of [1, 2, 3]; track i) {
              <div class="card p-3 flex flex-col gap-2">
                <app-skeleton-block variant="text" width="70%" height="11px" />
                <app-skeleton-block variant="text" width="80%" height="20px" />
              </div>
            }
          </div>
          <!-- Historial skeleton -->
          <div class="card p-0 overflow-hidden">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="px-4 py-3 flex gap-3 items-center border-b"
                style="border-color: var(--border-muted)"
              >
                <app-skeleton-block variant="text" width="20%" height="12px" />
                <app-skeleton-block variant="text" width="30%" height="12px" />
                <app-skeleton-block variant="text" width="20%" height="12px" />
                <app-skeleton-block variant="text" width="25%" height="12px" />
              </div>
            }
          </div>
        </div>
      }

      <!-- ── Sin datos ─────────────────────────────────────────────────────────── -->
      @if (!facade.isLoadingDetalle() && !facade.estadoCuentaResumen()) {
        <div class="flex flex-col items-center gap-3 py-12 text-center">
          <app-icon name="file-x" [size]="36" color="var(--text-muted)" />
          <p class="text-sm font-medium" style="color: var(--text-primary)">
            No se encontró la matrícula
          </p>
          <p class="text-xs" style="color: var(--text-muted)">
            Es posible que haya sido eliminada o que no tengas permisos para verla.
          </p>
        </div>
      }

      <!-- ── Contenido ─────────────────────────────────────────────────────────── -->
      @if (!facade.isLoadingDetalle() && facade.estadoCuentaResumen(); as resumen) {
        <!-- 1. Ficha del alumno -->
        <div class="card p-4 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-0.5">
              <h2 class="text-base font-bold" style="color: var(--text-primary)">
                {{ resumen.alumno }}
              </h2>
              <span class="text-xs font-mono" style="color: var(--text-muted)">
                {{ resumen.rut }}
              </span>
            </div>
            <span
              class="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
              [style.background]="paymentStatusBg(resumen.paymentStatus)"
              [style.color]="paymentStatusColor(resumen.paymentStatus)"
            >
              {{ paymentStatusLabel(resumen.paymentStatus) }}
            </span>
          </div>

          <div
            class="border-t pt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-xs"
            style="border-color: var(--border-muted)"
          >
            <div class="flex items-center gap-1.5">
              <app-icon name="book-open" [size]="13" color="var(--text-muted)" />
              <span style="color: var(--text-secondary)">{{ resumen.curso }}</span>
            </div>
            @if (resumen.email) {
              <div class="flex items-center gap-1.5">
                <app-icon name="mail" [size]="13" color="var(--text-muted)" />
                <span style="color: var(--text-secondary)">{{ resumen.email }}</span>
              </div>
            }
            @if (resumen.telefono) {
              <div class="flex items-center gap-1.5">
                <app-icon name="phone" [size]="13" color="var(--text-muted)" />
                <span style="color: var(--text-secondary)">{{ resumen.telefono }}</span>
              </div>
            }
            @if (resumen.descuento > 0) {
              <div class="flex items-center gap-1.5">
                <app-icon name="tag" [size]="13" color="var(--state-success)" />
                <span style="color: var(--state-success)">
                  Descuento: {{ clp(resumen.descuento) }}
                </span>
              </div>
            }
          </div>
        </div>

        <!-- 2. KPI mini-cards -->
        <div class="grid grid-cols-3 gap-3">
          <!-- Total del Curso -->
          <div class="card p-3 flex flex-col gap-1">
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--text-muted)"
            >
              Total Curso
            </span>
            <span class="text-sm font-bold" style="color: var(--text-primary)">
              {{ clp(resumen.totalACurso) }}
            </span>
            @if (resumen.descuento > 0) {
              <span class="text-xs line-through" style="color: var(--text-muted)">
                {{ clp(resumen.basePrice) }}
              </span>
            }
          </div>

          <!-- Total Pagado -->
          <div class="card p-3 flex flex-col gap-1" style="border-color: var(--state-success)">
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--text-muted)"
            >
              Pagado
            </span>
            <span class="text-sm font-bold" style="color: var(--state-success)">
              {{ clp(resumen.totalPagado) }}
            </span>
            <span class="text-xs" style="color: var(--text-muted)">
              {{ porcentajePagado(resumen) }}% del total
            </span>
          </div>

          <!-- Saldo Pendiente -->
          <div
            class="card p-3 flex flex-col gap-1"
            [style.borderColor]="
              resumen.saldoPendiente > 0 ? 'var(--state-warning)' : 'var(--state-success)'
            "
          >
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--text-muted)"
            >
              Saldo
            </span>
            <span
              class="text-sm font-bold"
              [style.color]="
                resumen.saldoPendiente > 0 ? 'var(--state-warning)' : 'var(--state-success)'
              "
            >
              {{ resumen.saldoPendiente > 0 ? clp(resumen.saldoPendiente) : 'Al día' }}
            </span>
          </div>
        </div>

        <!-- 3. Botón Registrar Pago -->
        @if (resumen.saldoPendiente > 0) {
          <button
            class="btn-primary w-full flex items-center justify-center gap-2"
            data-llm-action="register-payment-from-detail"
            (click)="openPagoDrawer()"
          >
            <app-icon name="plus" [size]="15" />
            Registrar Pago
          </button>
        }

        <!-- 4. Historial de pagos -->
        <div class="card p-0 overflow-hidden">
          <div class="px-4 py-3 border-b" style="border-color: var(--border-muted)">
            <h3 class="text-sm font-semibold" style="color: var(--text-primary)">
              Historial de Pagos
            </h3>
          </div>

          @if (facade.estadoCuentaHistorial().length === 0) {
            <div class="px-4 py-8 flex flex-col items-center gap-2 text-center">
              <app-icon name="inbox" [size]="28" color="var(--text-muted)" />
              <p class="text-xs" style="color: var(--text-muted)">Sin pagos registrados aún.</p>
            </div>
          } @else {
            <!-- Header columnas -->
            <div
              class="px-4 py-2 grid text-xs font-semibold tracking-wide uppercase"
              style="
                grid-template-columns: 80px 1fr 90px 80px 90px 70px;
                color: var(--text-muted);
                background: var(--bg-surface);
              "
            >
              <span>Fecha</span>
              <span>Concepto</span>
              <span>Método</span>
              <span>N° Doc.</span>
              <span class="text-right">Monto</span>
              <span class="text-center">Estado</span>
            </div>

            <div class="divide-y" style="border-color: var(--border-muted)">
              @for (pago of facade.estadoCuentaHistorial(); track pago.id) {
                <div
                  class="px-4 py-3 grid items-center gap-2 text-xs"
                  style="grid-template-columns: 80px 1fr 90px 80px 90px 70px"
                >
                  <!-- Fecha -->
                  <span class="font-medium" style="color: var(--color-primary)">
                    {{ fechaCorta(pago.fecha) }}
                  </span>

                  <!-- Concepto -->
                  <span class="font-semibold truncate" style="color: var(--text-primary)">
                    {{ pago.concepto ?? '—' }}
                  </span>

                  <!-- Método -->
                  <span class="flex items-center gap-1" style="color: var(--text-secondary)">
                    <app-icon [name]="pago.metodoIcono" [size]="11" />
                    {{ pago.metodo }}
                  </span>

                  <!-- N° Documento -->
                  <span
                    class="font-mono px-1 py-0.5 rounded truncate"
                    style="
                      color: var(--text-muted);
                      background: var(--bg-surface);
                      border: 1px solid var(--border-muted);
                    "
                  >
                    {{ pago.nroDocumento ?? '—' }}
                  </span>

                  <!-- Monto -->
                  <span class="font-bold text-right" style="color: var(--text-primary)">
                    {{ clp(pago.monto) }}
                  </span>

                  <!-- Estado badge -->
                  <span
                    class="inline-flex items-center justify-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-full text-center"
                    [style.background]="estadoBg(pago.estado)"
                    [style.color]="estadoColor(pago.estado)"
                  >
                    {{ estadoLabel(pago.estado) }}
                  </span>
                </div>
              }
            </div>

            <!-- Total del historial -->
            <div
              class="px-4 py-3 flex items-center justify-between border-t"
              style="border-color: var(--border-muted); background: var(--bg-surface)"
            >
              <span class="text-xs" style="color: var(--text-muted)">
                {{ facade.estadoCuentaHistorial().length }} pago(s) registrado(s)
              </span>
              <span class="text-sm font-bold" style="color: var(--text-primary)">
                Total: {{ clp(totalHistorial()) }}
              </span>
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Drawer: Registrar Pago (overlay sobre el panel) ────────────────────── -->
    @if (facade.estadoCuentaResumen(); as resumen) {
      <app-registrar-pago-drawer
        [isOpen]="pagoDrawerOpen()"
        [enrollmentId]="resumen.enrollmentId"
        [alumnoNombre]="resumen.alumno"
        [saldoPendiente]="resumen.saldoPendiente"
        [pagadoActual]="resumen.totalPagado"
        (closed)="pagoDrawerOpen.set(false)"
        (saved)="onPagoSaved()"
      />
    }
  `,
  styles: `
    .btn-primary {
      padding: 9px 20px;
      border-radius: var(--radius-md);
      border: none;
      background: var(--ds-brand);
      color: #fff;
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      cursor: pointer;
      transition: opacity var(--duration-fast);
    }
    .btn-primary:hover {
      opacity: 0.85;
    }
  `,
})
export class AdminPagoDetalleDrawerComponent implements OnInit {
  protected readonly facade = inject(PagosFacade);

  protected readonly pagoDrawerOpen = signal(false);
  protected readonly clp = formatCLP;

  ngOnInit(): void {
    const eid = this.facade.enrollmentSeleccionado();
    if (eid !== null) {
      this.facade.cargarEstadoCuenta(eid);
    }
  }

  protected openPagoDrawer(): void {
    this.pagoDrawerOpen.set(true);
  }

  protected onPagoSaved(): void {
    // Recargar el detalle tras un pago exitoso
    const eid = this.facade.enrollmentSeleccionado();
    if (eid !== null) {
      this.facade.cargarEstadoCuenta(eid);
    }
  }

  protected fechaCorta(fecha: string | null): string {
    if (!fecha) return '—';
    return formatChileanDate(fecha, { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  protected porcentajePagado(resumen: { totalPagado: number; totalACurso: number }): number {
    if (resumen.totalACurso <= 0) return 0;
    return Math.round((resumen.totalPagado / resumen.totalACurso) * 100);
  }

  protected totalHistorial(): number {
    return this.facade.estadoCuentaHistorial().reduce((acc, p) => acc + p.monto, 0);
  }

  protected paymentStatusLabel(status: string | null): string {
    switch (status) {
      case 'paid':
        return 'Pagado';
      case 'partial':
        return 'Parcial';
      case 'pending':
        return 'Pendiente';
      default:
        return status ?? '—';
    }
  }

  protected paymentStatusBg(status: string | null): string {
    switch (status) {
      case 'paid':
        return 'color-mix(in srgb, var(--state-success) 15%, transparent)';
      case 'partial':
        return 'color-mix(in srgb, var(--state-warning) 15%, transparent)';
      default:
        return 'color-mix(in srgb, var(--text-muted) 10%, transparent)';
    }
  }

  protected paymentStatusColor(status: string | null): string {
    switch (status) {
      case 'paid':
        return 'var(--state-success)';
      case 'partial':
        return 'var(--state-warning)';
      default:
        return 'var(--text-muted)';
    }
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
        return 'OK';
      case 'pendiente':
        return 'Pend.';
      default:
        return estado ?? '—';
    }
  }
}
