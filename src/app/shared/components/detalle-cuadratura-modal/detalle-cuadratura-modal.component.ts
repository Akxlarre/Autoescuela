import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface DenominacionRow {
  label: string;
  valor: number;
  qty: number;
  subtotal: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function parseDateLabel(fecha: string): string {
  const [yyyy, mm, dd] = fecha.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-detalle-cuadratura-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (cierre()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40"
        style="background: rgba(0,0,0,0.45); backdrop-filter: blur(2px)"
        aria-hidden="true"
        (click)="closed.emit()"
      ></div>

      <!-- Panel -->
      <div
        class="fixed z-50 flex flex-col overflow-hidden"
        style="
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(560px, calc(100vw - 32px));
          max-height: calc(100vh - 64px);
          background: var(--bg-surface);
          border: 1px solid var(--border-muted);
          border-radius: var(--radius-lg, 12px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.22);
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-modal-title"
      >
        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style="border-color: var(--border-muted)"
        >
          <div class="flex items-center gap-3">
            <app-icon name="calculator" [size]="18" color="var(--ds-brand)" />
            <div>
              <h2 id="detalle-modal-title" class="text-base font-semibold text-primary">
                Detalle de Cuadratura — {{ fechaLabel() }}
              </h2>
              <p class="text-xs text-muted mt-0.5">Cierre de caja registrado</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (cierre()!.estadoDiferencia === 'balanced') {
              <span
                class="text-xs font-semibold px-2.5 py-1 rounded-full"
                style="background: color-mix(in srgb, var(--color-success) 15%, transparent); color: var(--color-success)"
                >Cuadrado</span
              >
            } @else if (cierre()!.estadoDiferencia === 'shortage') {
              <span
                class="text-xs font-semibold px-2.5 py-1 rounded-full"
                style="background: color-mix(in srgb, var(--color-error) 12%, transparent); color: var(--color-error)"
                >Descuadre</span
              >
            } @else {
              <span
                class="text-xs font-semibold px-2.5 py-1 rounded-full"
                style="background: color-mix(in srgb, var(--color-warning) 12%, transparent); color: var(--color-warning)"
                >Sobrante</span
              >
            }
            <button
              class="p-1.5 rounded-lg transition-colors cursor-pointer"
              style="color: var(--text-muted)"
              (click)="closed.emit()"
              aria-label="Cerrar modal"
            >
              <app-icon name="x" [size]="16" />
            </button>
          </div>
        </div>

        <!-- ── Cuerpo scrolleable ─────────────────────────────────────────── -->
        <div class="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">
          <!-- Sección 1: Resumen -->
          <section>
            <h3 class="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
              Resumen
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Cajero</p>
                <p class="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <app-icon name="user" [size]="13" color="var(--text-muted)" />
                  {{ cierre()!.cajero }}
                </p>
              </div>
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Fondo Inicial</p>
                <p class="text-sm font-semibold text-primary">
                  {{ formatAmt(cierre()!.fondoInicial) }}
                </p>
              </div>
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Saldo Sistema</p>
                <p class="text-sm font-semibold text-primary">
                  {{ formatAmt(cierre()!.saldoSistema) }}
                </p>
              </div>
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Saldo Físico</p>
                <p class="text-sm font-semibold text-primary">
                  {{ formatAmt(cierre()!.saldoFisico) }}
                </p>
              </div>
              <div
                class="col-span-2 rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Diferencia</p>
                <p
                  class="text-sm font-bold"
                  [style.color]="
                    cierre()!.estadoDiferencia === 'shortage'
                      ? 'var(--color-error)'
                      : cierre()!.estadoDiferencia === 'surplus'
                        ? 'var(--color-warning)'
                        : 'var(--color-success)'
                  "
                >
                  {{ formatDiff(cierre()!.diferencia) }}
                </p>
              </div>
            </div>
          </section>

          <!-- Sección 2: Arqueo físico (solo denominaciones > 0) -->
          @if (denominaciones().length > 0) {
            <section>
              <h3 class="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
                Arqueo Físico
              </h3>
              <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--border-color)">
                <table class="w-full text-sm" role="table">
                  <thead>
                    <tr
                      style="background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-color)"
                    >
                      <th class="px-4 py-2 text-left text-xs font-semibold text-secondary">
                        Denominación
                      </th>
                      <th class="px-4 py-2 text-center text-xs font-semibold text-secondary">
                        Cantidad
                      </th>
                      <th class="px-4 py-2 text-right text-xs font-semibold text-secondary">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (den of denominaciones(); track den.label; let even = $even) {
                      <tr
                        [style.background]="
                          even ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)'
                        "
                      >
                        <td class="px-4 py-2 text-secondary">{{ den.label }}</td>
                        <td class="px-4 py-2 text-center font-semibold text-primary tabular-nums">
                          {{ den.qty }}
                        </td>
                        <td class="px-4 py-2 text-right text-primary tabular-nums">
                          {{ formatAmt(den.subtotal) }}
                        </td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr
                      class="border-t"
                      style="background: var(--bg-surface-elevated); border-color: var(--border-color)"
                    >
                      <td class="px-4 py-2 text-xs font-semibold text-secondary" colspan="2">
                        Total arqueo
                      </td>
                      <td class="px-4 py-2 text-right font-bold text-primary tabular-nums">
                        {{ formatAmt(cierre()!.saldoFisico) }}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          }

          <!-- Sección 3: Notas -->
          @if (cierre()!.notes) {
            <section>
              <h3 class="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
                Notas
              </h3>
              <div
                class="rounded-lg px-4 py-3 text-sm text-secondary"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); white-space: pre-wrap"
              >
                {{ cierre()!.notes }}
              </div>
            </section>
          }
        </div>

        <!-- ── Footer ─────────────────────────────────────────────────────── -->
        <div
          class="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0"
          style="border-color: var(--border-muted)"
        >
          <button
            class="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors"
            style="background: var(--bg-surface-elevated); border: 1px solid var(--border-muted); color: var(--text-secondary)"
            (click)="imprimir()"
            data-llm-action="imprimir-detalle-cuadratura"
            aria-label="Imprimir detalle"
          >
            <app-icon name="printer" [size]="15" />
            Imprimir
          </button>
          <button
            class="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg cursor-pointer"
            (click)="closed.emit()"
            data-llm-action="cerrar-detalle-cuadratura"
            aria-label="Cerrar modal"
          >
            <app-icon name="check" [size]="15" />
            Cerrar
          </button>
        </div>
      </div>
    }
  `,
})
export class DetalleCuadraturaModalComponent {
  cierre = input<HistorialCierre | null>(null);
  closed = output<void>();

  protected readonly fechaLabel = computed(() => {
    const c = this.cierre();
    return c ? parseDateLabel(c.fecha) : '';
  });

  protected readonly denominaciones = computed<DenominacionRow[]>(() => {
    const c = this.cierre();
    if (!c) return [];

    const todas: DenominacionRow[] = [
      {
        label: 'Billetes de $20.000',
        valor: 20_000,
        qty: c.qtyBill20000,
        subtotal: 20_000 * c.qtyBill20000,
      },
      {
        label: 'Billetes de $10.000',
        valor: 10_000,
        qty: c.qtyBill10000,
        subtotal: 10_000 * c.qtyBill10000,
      },
      {
        label: 'Billetes de $5.000',
        valor: 5_000,
        qty: c.qtyBill5000,
        subtotal: 5_000 * c.qtyBill5000,
      },
      {
        label: 'Billetes de $2.000',
        valor: 2_000,
        qty: c.qtyBill2000,
        subtotal: 2_000 * c.qtyBill2000,
      },
      {
        label: 'Billetes de $1.000',
        valor: 1_000,
        qty: c.qtyBill1000,
        subtotal: 1_000 * c.qtyBill1000,
      },
      { label: 'Monedas de $500', valor: 500, qty: c.qtyCoin500, subtotal: 500 * c.qtyCoin500 },
      { label: 'Monedas de $100', valor: 100, qty: c.qtyCoin100, subtotal: 100 * c.qtyCoin100 },
      { label: 'Monedas de $50', valor: 50, qty: c.qtyCoin50, subtotal: 50 * c.qtyCoin50 },
      { label: 'Monedas de $10', valor: 10, qty: c.qtyCoin10, subtotal: 10 * c.qtyCoin10 },
    ];

    return todas.filter((d) => d.qty > 0);
  });

  protected formatAmt(value: number): string {
    return formatCLP(value);
  }

  protected formatDiff(diff: number): string {
    const formatted = formatCLP(diff);
    if (diff > 0) return `+ ${formatted}`;
    if (diff < 0) return `- ${formatted}`;
    return formatted;
  }

  protected imprimir(): void {
    window.print();
  }
}
