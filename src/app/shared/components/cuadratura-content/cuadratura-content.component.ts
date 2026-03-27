import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { formatCLP } from '@core/utils/date.utils';
import type { IngresoRow, EgresoRow, CierrePayload } from '@core/models/ui/cuadratura.model';

/** Denominaciones para el arqueo de caja. */
interface Denominacion {
  label: string;
  valor: number;
  tipo: 'billete' | 'moneda';
  key: keyof CierrePayload;
}

const DENOMINACIONES: Denominacion[] = [
  { label: 'Billetes de $20.000', valor: 20_000, tipo: 'billete', key: 'bill20000' },
  { label: 'Billetes de $10.000', valor: 10_000, tipo: 'billete', key: 'bill10000' },
  { label: 'Billetes de $5.000', valor: 5_000, tipo: 'billete', key: 'bill5000' },
  { label: 'Billetes de $2.000', valor: 2_000, tipo: 'billete', key: 'bill2000' },
  { label: 'Billetes de $1.000', valor: 1_000, tipo: 'billete', key: 'bill1000' },
  { label: 'Monedas de $500', valor: 500, tipo: 'moneda', key: 'coin500' },
  { label: 'Monedas de $100', valor: 100, tipo: 'moneda', key: 'coin100' },
  { label: 'Monedas de $50', valor: 50, tipo: 'moneda', key: 'coin50' },
  { label: 'Monedas de $10', valor: 10, tipo: 'moneda', key: 'coin10' },
];

const BILLETES = DENOMINACIONES.filter((d) => d.tipo === 'billete');
const MONEDAS = DENOMINACIONES.filter((d) => d.tipo === 'moneda');

@Component({
  selector: 'app-cuadratura-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-4 px-6 pt-6 pb-2">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold" style="color: var(--text-primary)">Cuadratura Diaria</h1>
        @if (cajaYaCerrada()) {
          <span
            class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style="background: color-mix(in srgb, var(--state-error) 12%, transparent); color: var(--state-error)"
          >
            <span class="w-1.5 h-1.5 rounded-full" style="background: var(--state-error)"></span>
            Caja Cerrada
          </span>
        } @else {
          <span
            class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style="background: color-mix(in srgb, var(--state-success) 12%, transparent); color: var(--state-success)"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              style="background: var(--state-success); animation: pulse 2s infinite"
            ></span>
            Caja Abierta
          </span>
        }
      </div>
      <div class="flex items-center gap-3">
        <span
          class="text-sm font-medium px-3 py-2 rounded-lg"
          style="background: var(--bg-surface); border: 1px solid var(--border-muted); color: var(--text-primary)"
        >
          {{ fechaHoy() }}
        </span>
        <button
          class="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg"
          style="background: var(--bg-surface); border: 1px solid var(--border-muted); color: var(--text-primary)"
          data-llm-action="ver-historial-cuadratura"
          aria-label="Ver historial de cierres de caja"
        >
          <app-icon name="clock" [size]="15" />
          Ver Historial
        </button>
        <button
          class="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg"
          style="background: var(--bg-surface); border: 1px solid var(--border-muted); color: var(--text-primary)"
          data-llm-action="exportar-cuadratura-excel"
          aria-label="Exportar cuadratura a Excel"
        >
          <app-icon name="download" [size]="15" />
          Exportar a Excel
        </button>
      </div>
    </div>

    <!-- ── Cuerpo principal ───────────────────────────────────────────────── -->
    <div class="grid grid-cols-3 gap-6 p-6 pb-28 items-start">
      <!-- ─ Columna izquierda (2/3): Registro de Ingresos ─────────────────── -->
      <div class="col-span-2 flex flex-col gap-6">
        <div class="card p-0 overflow-hidden">
          <!-- Header tabla -->
          <div
            class="flex items-start justify-between px-6 py-4 border-b"
            style="border-color: var(--border-muted)"
          >
            <div>
              <h2 class="text-sm font-semibold" style="color: var(--text-primary)">
                Registro de Ingresos
              </h2>
              <p class="text-xs mt-0.5" style="color: var(--color-primary)">
                Detalle de boletas y pagos recibidos en el día.
              </p>
            </div>
            <button
              class="btn-primary flex items-center gap-2 text-sm shrink-0"
              data-llm-action="agregar-ingreso-cuadratura"
              [disabled]="cajaYaCerrada()"
              [style.opacity]="cajaYaCerrada() ? '0.5' : '1'"
              aria-label="Agregar nuevo ingreso"
              (click)="abrirIngreso.emit()"
            >
              <app-icon name="plus" [size]="14" />
              Agregar Ingreso
            </button>
          </div>

          <!-- Columnas header -->
          <div
            class="px-6 py-2 grid text-xs font-semibold tracking-wide uppercase"
            style="
              grid-template-columns: 80px 1fr 90px 90px 90px 90px 100px 36px;
              color: var(--text-muted);
              background: var(--bg-surface);
            "
          >
            <span>N° Boleta</span>
            <span>Glosa / Alumno</span>
            <span class="text-right">Clase B</span>
            <span class="text-right">Clase A</span>
            <span class="text-right">Sensom.</span>
            <span class="text-right">Otros</span>
            <span class="text-right">Total</span>
            <span></span>
          </div>

          <!-- Filas -->
          @if (isLoading()) {
            <div class="divide-y" style="border-color: var(--border-muted)">
              @for (row of [1, 2, 3]; track row) {
                <div
                  class="px-6 py-3 grid gap-3 items-center"
                  style="grid-template-columns: 80px 1fr 90px 90px 90px 90px 100px 36px"
                >
                  <app-skeleton-block variant="text" width="60px" height="12px" />
                  <app-skeleton-block variant="text" width="80%" height="12px" />
                  <app-skeleton-block variant="text" width="70%" height="12px" />
                  <app-skeleton-block variant="text" width="70%" height="12px" />
                  <app-skeleton-block variant="text" width="70%" height="12px" />
                  <app-skeleton-block variant="text" width="70%" height="12px" />
                  <app-skeleton-block variant="text" width="80%" height="12px" />
                  <div></div>
                </div>
              }
            </div>
          } @else if (pagosHoy().length === 0) {
            <div class="px-6 py-10 flex flex-col items-center gap-2 text-center">
              <app-icon name="inbox" [size]="28" color="var(--text-muted)" />
              <p class="text-sm" style="color: var(--text-muted)">
                No hay ingresos registrados hoy.
              </p>
            </div>
          } @else {
            <div class="divide-y" style="border-color: var(--border-muted)">
              @for (fila of pagosHoy(); track fila.id) {
                <div
                  class="px-6 py-3 grid gap-3 items-center"
                  style="grid-template-columns: 80px 1fr 90px 90px 90px 90px 100px 36px"
                >
                  <span class="text-xs font-mono font-semibold" style="color: var(--color-primary)">
                    {{ fila.nBoleta ?? '—' }}
                  </span>
                  <span class="text-sm font-medium truncate" style="color: var(--text-primary)">
                    {{ fila.glosa }}
                  </span>
                  <span class="text-sm text-right" style="color: var(--text-secondary)">
                    {{ fila.claseB > 0 ? fila.claseB.toLocaleString('es-CL') : 0 }}
                  </span>
                  <span class="text-sm text-right" style="color: var(--text-secondary)">
                    {{ fila.claseA > 0 ? fila.claseA.toLocaleString('es-CL') : 0 }}
                  </span>
                  <span class="text-sm text-right" style="color: var(--text-secondary)">
                    {{ fila.sence > 0 ? fila.sence.toLocaleString('es-CL') : 0 }}
                  </span>
                  <span class="text-sm text-right" style="color: var(--text-secondary)">
                    {{ fila.otros > 0 ? fila.otros.toLocaleString('es-CL') : 0 }}
                  </span>
                  <span class="text-sm text-right font-bold" style="color: var(--text-primary)">
                    {{ clp(fila.total) }}
                  </span>
                  <button
                    class="flex items-center justify-center w-7 h-7 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
                    style="color: var(--state-error)"
                    [disabled]="cajaYaCerrada()"
                    [attr.aria-label]="'Eliminar ingreso ' + (fila.nBoleta ?? fila.id)"
                    [attr.data-llm-action]="'eliminar-ingreso-' + fila.id"
                    (click)="onEliminarIngreso(fila, $event)"
                  >
                    <app-icon name="trash-2" [size]="14" />
                  </button>
                </div>
              }
            </div>

            <!-- Footer total -->
            <div
              class="px-6 py-3 flex items-center justify-end gap-3 border-t"
              style="border-color: var(--border-muted); background: var(--bg-surface)"
            >
              <span
                class="text-xs font-semibold uppercase tracking-wide"
                style="color: var(--text-muted)"
              >
                Total Ingresos del Día:
              </span>
              <span class="text-base font-bold" style="color: var(--color-primary)">
                {{ clp(totalIngresosHoy()) }}
              </span>
            </div>
          }
        </div>
      </div>

      <!-- ─ Columna derecha (1/3): Egresos + Arqueo ───────────────────────── -->
      <div class="col-span-1 flex flex-col gap-5">
        <!-- Egresos / Retiros -->
        <div class="card p-0 overflow-hidden">
          <div
            class="flex items-center justify-between px-5 py-3.5 border-b"
            style="border-color: var(--border-muted)"
          >
            <h2 class="text-sm font-semibold" style="color: var(--text-primary)">
              Egresos / Retiros
            </h2>
            <button
              class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg"
              style="background: var(--bg-surface); border: 1px solid var(--border-muted); color: var(--text-primary)"
              data-llm-action="agregar-egreso-cuadratura"
              [disabled]="cajaYaCerrada()"
              [style.opacity]="cajaYaCerrada() ? '0.5' : '1'"
              aria-label="Agregar egreso"
              (click)="abrirEgreso.emit()"
            >
              <app-icon name="plus" [size]="12" />
              Egreso
            </button>
          </div>

          <!-- Header cols -->
          <div
            class="px-5 py-2 grid grid-cols-[1fr_80px_24px] gap-3 text-xs font-semibold uppercase tracking-wide"
            style="color: var(--text-muted); background: var(--bg-surface)"
          >
            <span>Glosa / Motivo</span>
            <span class="text-right">Monto</span>
            <span></span>
          </div>

          @if (isLoading()) {
            <div class="divide-y" style="border-color: var(--border-muted)">
              @for (i of [1, 2]; track i) {
                <div class="px-5 py-3 grid grid-cols-[1fr_80px_24px] gap-3 items-center">
                  <app-skeleton-block variant="text" width="80%" height="12px" />
                  <app-skeleton-block variant="text" width="60px" height="12px" />
                  <div></div>
                </div>
              }
            </div>
          } @else if (gastosHoy().length === 0) {
            <div class="px-5 py-6 text-center">
              <p class="text-xs" style="color: var(--text-muted)">Sin egresos registrados.</p>
            </div>
          } @else {
            <div class="divide-y" style="border-color: var(--border-muted)">
              @for (egreso of gastosHoy(); track egreso.id + egreso.tipo) {
                <div class="px-5 py-3 grid grid-cols-[1fr_80px_24px] gap-3 items-center">
                  <span class="text-xs truncate" style="color: var(--text-primary)">
                    {{ egreso.descripcion }}
                  </span>
                  <span class="text-xs text-right font-medium" style="color: var(--text-primary)">
                    {{ egreso.monto.toLocaleString('es-CL') }}
                  </span>
                  <button
                    class="opacity-40 hover:opacity-100 transition-opacity"
                    style="color: var(--state-error)"
                    [disabled]="cajaYaCerrada()"
                    [attr.data-llm-action]="'eliminar-egreso-' + egreso.tipo + '-' + egreso.id"
                    [attr.aria-label]="'Eliminar egreso ' + egreso.descripcion"
                    (click)="onEliminarEgreso(egreso, $event)"
                  >
                    <app-icon name="x" [size]="13" />
                  </button>
                </div>
              }
            </div>
          }

          <!-- Total egresos -->
          <div
            class="px-5 py-3 flex items-center justify-between border-t"
            style="border-color: var(--border-muted); background: var(--bg-surface)"
          >
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--text-muted)"
            >
              Total Egresos:
            </span>
            <span class="text-sm font-bold" style="color: var(--state-warning)">
              {{ clp(totalEgresosHoy()) }}
            </span>
          </div>
        </div>

        <!-- Arqueo de Caja Física -->
        <div class="card p-0 overflow-hidden" style="border-top: 2px solid var(--ds-brand)">
          <div class="px-5 py-3.5 border-b" style="border-color: var(--border-muted)">
            <h2 class="text-sm font-semibold" style="color: var(--text-primary)">
              Arqueo de Caja Física
            </h2>
            <p class="text-xs mt-0.5" style="color: var(--text-muted)">
              Ingrese la cantidad de billetes y monedas.
            </p>
          </div>

          <!-- Grid billetes/monedas -->
          <div class="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3">
            <!-- Header columnas -->
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--text-muted)"
            >
              Billetes
            </span>
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--text-muted)"
            >
              Monedas
            </span>

            <!-- Filas paralelas: billete | moneda -->
            @for (i of [0, 1, 2, 3, 4]; track i) {
              <!-- Billete -->
              <div class="flex items-center gap-2">
                <span class="text-xs flex-1 truncate" style="color: var(--text-secondary)">
                  {{ billetes()[i].label.replace('Billetes de ', '') }}
                </span>
                <span class="text-xs" style="color: var(--text-muted)">×</span>
                <input
                  type="number"
                  min="0"
                  class="w-14 text-xs text-right px-2 py-1 rounded"
                  style="
                    background: var(--bg-surface);
                    border: 1px solid var(--border-muted);
                    color: var(--text-primary);
                    outline: none;
                  "
                  [value]="cantidades()[billetes()[i].key]"
                  [disabled]="cajaYaCerrada()"
                  [attr.data-llm-description]="
                    'Cantidad de ' + billetes()[i].label + ' para arqueo de caja'
                  "
                  (input)="onCantidadChange(billetes()[i].key, $event)"
                  (focus)="selectAll($event)"
                />
              </div>

              <!-- Moneda (solo 5 primeras, la última fila del billete no tiene moneda) -->
              @if (i < monedas().length) {
                <div class="flex items-center gap-2">
                  <span class="text-xs flex-1 truncate" style="color: var(--text-secondary)">
                    {{ monedas()[i].label.replace('Monedas de ', '') }}
                  </span>
                  <span class="text-xs" style="color: var(--text-muted)">×</span>
                  <input
                    type="number"
                    min="0"
                    class="w-14 text-xs text-right px-2 py-1 rounded"
                    style="
                      background: var(--bg-surface);
                      border: 1px solid var(--border-muted);
                      color: var(--text-primary);
                      outline: none;
                    "
                    [value]="cantidades()[monedas()[i].key]"
                    [disabled]="cajaYaCerrada()"
                    [attr.data-llm-description]="
                      'Cantidad de ' + monedas()[i].label + ' para arqueo de caja'
                    "
                    (input)="onCantidadChange(monedas()[i].key, $event)"
                    (focus)="selectAll($event)"
                  />
                </div>
              } @else {
                <div></div>
              }
            }
          </div>

          <!-- Justificación del descuadre -->
          <div class="px-5 pb-4 flex flex-col gap-2">
            @if (diferencia() !== 0) {
              <label class="text-xs font-semibold" style="color: var(--state-warning)">
                Justificación del descuadre
              </label>
            } @else {
              <label class="text-xs font-semibold" style="color: var(--text-muted)">
                Notas / Observaciones
              </label>
            }
            <textarea
              rows="3"
              class="text-xs px-3 py-2 rounded-lg resize-y"
              style="
                background: var(--bg-surface);
                border: 1px solid var(--border-muted);
                color: var(--text-primary);
                outline: none;
                min-height: 64px;
              "
              placeholder="Ingrese el motivo de la diferencia en caja..."
              [disabled]="cajaYaCerrada()"
              [value]="notas()"
              data-llm-description="Campo de texto para justificar diferencias en el arqueo de caja"
              (input)="notas.set(getInputValue($event))"
            ></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Barra inferior fija ─────────────────────────────────────────────── -->
    <div
      class="fixed bottom-0 right-0 z-20 flex items-center gap-0 border-t"
      style="
        left: var(--sidebar-width, 260px);
        background: var(--bg-surface);
        border-color: var(--border-muted);
        padding: 14px 24px;
      "
    >
      <!-- KPIs de resumen -->
      <div class="flex flex-1 items-center gap-8 overflow-x-auto">
        <!-- Ingresos Sistema -->
        <div class="flex flex-col items-center gap-0.5 min-w-0 shrink-0">
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--text-muted)"
          >
            Ingresos Sistema
          </span>
          <span class="text-lg font-bold" style="color: var(--color-primary)">
            {{ clp(totalIngresosHoy()) }}
          </span>
        </div>

        <span class="text-xl font-light" style="color: var(--border-muted)">−</span>

        <!-- Egresos Sistema -->
        <div class="flex flex-col items-center gap-0.5 min-w-0 shrink-0">
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--text-muted)"
          >
            Egresos Sistema
          </span>
          <span class="text-lg font-bold" style="color: var(--state-warning)">
            {{ clp(totalEgresosHoy()) }}
          </span>
        </div>

        <span class="text-xl font-light" style="color: var(--border-muted)">=</span>

        <!-- Debe Haber en Caja -->
        <div class="flex flex-col items-center gap-0.5 min-w-0 shrink-0">
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--text-muted)"
          >
            Debe Haber en Caja
          </span>
          <span class="text-lg font-bold" style="color: var(--text-primary)">
            {{ clp(saldoTeorico()) }}
          </span>
        </div>

        <div class="h-8 w-px shrink-0 mx-2" style="background: var(--border-muted)"></div>

        <!-- Efectivo Arqueo -->
        <div class="flex flex-col items-center gap-0.5 min-w-0 shrink-0">
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--text-muted)"
          >
            Efectivo Arqueo
          </span>
          <span class="text-lg font-bold" style="color: var(--state-success)">
            {{ clp(totalArqueo()) }}
          </span>
        </div>

        <!-- Diferencia -->
        <div class="flex flex-col items-center gap-0.5 min-w-0 shrink-0">
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--text-muted)"
          >
            Diferencia
          </span>
          <span class="text-lg font-bold" [style.color]="colorDiferencia()">
            {{ clp(diferencia()) }}
          </span>
        </div>
      </div>

      <!-- Botón guardar -->
      <button
        class="flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-lg shrink-0 ml-6 transition-opacity"
        [class.btn-primary]="!cajaYaCerrada()"
        [style.background]="cajaYaCerrada() ? 'var(--bg-surface)' : ''"
        [style.border]="cajaYaCerrada() ? '1px solid var(--border-muted)' : ''"
        [style.color]="cajaYaCerrada() ? 'var(--text-muted)' : ''"
        [disabled]="cajaYaCerrada() || isSaving()"
        [style.opacity]="cajaYaCerrada() || isSaving() ? '0.6' : '1'"
        data-llm-action="cerrar-caja-guardar"
        aria-label="Cerrar caja y guardar cierre del día"
        (click)="onGuardarCierre()"
      >
        @if (isSaving()) {
          <app-icon name="loader" [size]="16" />
          Guardando...
        } @else if (cajaYaCerrada()) {
          <app-icon name="lock" [size]="16" />
          Caja Cerrada
        } @else {
          <app-icon name="lock" [size]="16" />
          Cerrar Caja y Guardar
        }
      </button>
    </div>
  `,
})
export class CuadraturaContentComponent {
  // ── Inputs (datos del facade, pasados por el smart component) ─────────────
  readonly pagosHoy = input.required<IngresoRow[]>();
  readonly gastosHoy = input.required<EgresoRow[]>();
  readonly fondoInicial = input<number>(50_000);
  readonly totalIngresosHoy = input.required<number>();
  readonly totalEgresosHoy = input.required<number>();
  readonly saldoTeorico = input.required<number>();
  readonly cajaYaCerrada = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  readonly isSaving = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly guardarCierre = output<CierrePayload>();
  readonly abrirIngreso = output<void>();
  readonly abrirEgreso = output<void>();
  readonly eliminarIngreso = output<IngresoRow>();
  readonly eliminarEgreso = output<EgresoRow>();

  // ── Estado interno del arqueo ─────────────────────────────────────────────
  protected readonly cantidades = signal<Record<string, number>>({
    bill20000: 0,
    bill10000: 0,
    bill5000: 0,
    bill2000: 0,
    bill1000: 0,
    coin500: 0,
    coin100: 0,
    coin50: 0,
    coin10: 0,
  });

  protected readonly notas = signal<string>('');

  // ── Constantes ────────────────────────────────────────────────────────────
  protected readonly billetes = signal(BILLETES);
  protected readonly monedas = signal(MONEDAS);

  // ── Computed ──────────────────────────────────────────────────────────────
  protected readonly totalArqueo = computed(() => {
    const c = this.cantidades();
    return (
      c['bill20000'] * 20_000 +
      c['bill10000'] * 10_000 +
      c['bill5000'] * 5_000 +
      c['bill2000'] * 2_000 +
      c['bill1000'] * 1_000 +
      c['coin500'] * 500 +
      c['coin100'] * 100 +
      c['coin50'] * 50 +
      c['coin10'] * 10
    );
  });

  protected readonly diferencia = computed(() => this.totalArqueo() - this.saldoTeorico());

  protected readonly colorDiferencia = computed(() => {
    const d = this.diferencia();
    if (d === 0) return 'var(--state-success)';
    if (d < 0) return 'var(--state-error)';
    return 'var(--state-warning)';
  });

  protected readonly fechaHoy = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  });

  // ── Helpers de template ───────────────────────────────────────────────────
  protected readonly clp = formatCLP;

  protected onCantidadChange(key: string, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.cantidades.update((prev) => ({ ...prev, [key]: isNaN(val) || val < 0 ? 0 : val }));
  }

  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected getInputValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected onEliminarIngreso(fila: IngresoRow, event: Event): void {
    event.stopPropagation();
    const confirmado = window.confirm(
      '¿Estás seguro de que deseas eliminar este movimiento?\nEsta acción no se puede deshacer y los saldos se recalcularán.',
    );
    if (confirmado) {
      this.eliminarIngreso.emit(fila);
    }
  }

  protected onEliminarEgreso(egreso: EgresoRow, event: Event): void {
    event.stopPropagation();
    const confirmado = window.confirm(
      '¿Estás seguro de que deseas eliminar este egreso?\nEsta acción no se puede deshacer.',
    );
    if (confirmado) {
      this.eliminarEgreso.emit(egreso);
    }
  }

  protected onGuardarCierre(): void {
    const c = this.cantidades();
    this.guardarCierre.emit({
      bill20000: c['bill20000'],
      bill10000: c['bill10000'],
      bill5000: c['bill5000'],
      bill2000: c['bill2000'],
      bill1000: c['bill1000'],
      coin500: c['coin500'],
      coin100: c['coin100'],
      coin50: c['coin50'],
      coin10: c['coin10'],
      notes: this.notas(),
      arqueoTotal: this.totalArqueo(),
    });
  }
}
