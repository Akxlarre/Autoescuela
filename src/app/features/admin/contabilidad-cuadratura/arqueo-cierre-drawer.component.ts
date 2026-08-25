import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { formatCLP } from '@core/utils/date.utils';

const BILLETES = [
  { key: 'bill20000', label: '$20.000' },
  { key: 'bill10000', label: '$10.000' },
  { key: 'bill5000', label: '$5.000' },
  { key: 'bill2000', label: '$2.000' },
  { key: 'bill1000', label: '$1.000' },
] as const;

const MONEDAS = [
  { key: 'coin500', label: '$500' },
  { key: 'coin100', label: '$100' },
  { key: 'coin50', label: '$50' },
  { key: 'coin10', label: '$10' },
] as const;

/**
 * ArqueoCierreDrawerComponent — spec 0004-i.
 *
 * Antes vivía inline como columna sticky (`.bento-tall`) dentro de cuadratura-content.
 * Se movió a Drawer porque el contador de billetes/monedas, al activarse, agrandaba
 * dramáticamente esa columna de ancho fijo, rompiendo el layout de la página (bug real
 * encontrado probando el render actual, no cosmético). El botón "Cerrar Caja" NO vive
 * acá — se movió al Hero de cuadratura-content, fuera de este Drawer.
 *
 * Renderizado vía `LayoutDrawerFacadeService.open()` como NgComponentOutlet — no es hijo de
 * cuadratura-content, por eso inyecta `CuadraturaFacade` directo (mismo patrón que
 * `RegistrarEgresoDrawerComponent`) en vez de recibir inputs.
 */
@Component({
  selector: 'app-arqueo-cierre-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, DrawerFormComponent],
  template: `
    <app-drawer-form>
      <div class="flex flex-col gap-5">
        <p class="text-compact text-text-muted">
          Conciliación entre lo esperado por el sistema y el efectivo declarado.
        </p>

        <!-- Fondo de Apertura -->
        <div class="flex flex-col gap-1.5">
          <label for="fondo-apertura" class="field-label">Fondo de Apertura</label>
          <div class="input-prefix-wrapper">
            <span class="input-prefix">$</span>
            <input
              id="fondo-apertura"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              class="field-input field-input--prefixed"
              [value]="facade.fondoInicial() || ''"
              placeholder="0"
              [disabled]="facade.cajaYaCerrada()"
              (input)="onFondoChange($event)"
              (focus)="selectAll($event)"
              data-llm-description="Monto de efectivo con el que abre la caja el día de hoy"
            />
          </div>
        </div>

        <!-- Resumen -->
        <div class="flex flex-col gap-2.5 p-4 rounded-xl bg-brand/5 border border-brand/10">
          <div
            class="flex items-center justify-between text-compact font-semibold text-text-secondary"
          >
            <span>Ingresos en Efectivo</span>
            <span class="tabular-nums text-brand">{{ clp(facade.ingresosEfectivoHoy()) }}</span>
          </div>
          <div
            class="flex items-center justify-between text-compact font-semibold text-text-secondary"
          >
            <span>Egresos en Efectivo (-)</span>
            <span class="tabular-nums text-warning">{{
              clp(facade.totalEgresosEfectivoHoy())
            }}</span>
          </div>
          <div class="mt-1 pt-3 border-t border-brand/10 flex items-center justify-between">
            <span class="micro-label text-brand">Debe Haber en Caja</span>
            <span class="text-lg font-black text-text-primary tabular-nums tracking-tight">
              {{ clp(facade.saldoTeoricoEfectivo()) }}
            </span>
          </div>
        </div>

        <!-- Toggle: Realizar arqueo de efectivo físico -->
        <div class="flex items-center justify-between gap-4 py-2">
          <div class="flex flex-col gap-0.5">
            <span class="text-compact font-semibold text-text-primary"
              >Realizar arqueo de efectivo físico</span
            >
            <span class="text-2xs text-text-muted"
              >Contar billetes y monedas para cierre presencial</span
            >
          </div>
          <button
            type="button"
            role="switch"
            [attr.aria-checked]="facade.realizarArqueo()"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 disabled:opacity-40"
            [style.background]="facade.realizarArqueo() ? 'var(--ds-brand)' : 'var(--border-muted)'"
            [disabled]="facade.cajaYaCerrada()"
            (click)="facade.realizarArqueo.update((v) => !v)"
            data-llm-action="toggle-arqueo-efectivo"
          >
            <span
              class="inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out"
              [style.transform]="facade.realizarArqueo() ? 'translateX(20px)' : 'translateX(2px)'"
            ></span>
          </button>
        </div>

        <!-- Contador de billetes y monedas — solo si el arqueo está activo -->
        @if (facade.realizarArqueo()) {
          <div class="grid grid-cols-1 gap-y-4">
            <div class="flex flex-col gap-3">
              <div
                class="flex items-center justify-between border-b border-border-muted/50 pb-2 mb-1"
              >
                <span class="micro-label">Billetes</span>
                <app-icon
                  name="banknote"
                  [size]="14"
                  color="var(--text-muted)"
                  class="opacity-50"
                />
              </div>
              @for (billete of billetes; track billete.key) {
                <div class="flex items-center justify-between group">
                  <span class="text-compact font-semibold text-text-secondary">{{
                    billete.label
                  }}</span>
                  <div class="flex items-center gap-2.5">
                    <span class="text-2xs text-text-muted font-bold opacity-50">×</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      autocomplete="off"
                      class="w-19 h-9 text-sm font-black text-right px-3 py-1 rounded-xl bg-subtle border border-border-muted focus:bg-surface focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all tabular-nums hover:border-text-muted"
                      [value]="facade.cantidades()[billete.key] || ''"
                      placeholder="0"
                      [disabled]="facade.cajaYaCerrada()"
                      (input)="onCantidadChange(billete.key, $event)"
                      (focus)="selectAll($event)"
                    />
                  </div>
                </div>
              }
            </div>

            <div class="flex flex-col gap-3">
              <div
                class="flex items-center justify-between border-b border-border-muted/50 pb-2 mb-1"
              >
                <span class="micro-label">Monedas</span>
                <app-icon name="circle" [size]="14" color="var(--text-muted)" class="opacity-50" />
              </div>
              @for (moneda of monedas; track moneda.key) {
                <div class="flex items-center justify-between group">
                  <span class="text-compact font-semibold text-text-secondary">{{
                    moneda.label
                  }}</span>
                  <div class="flex items-center gap-2.5">
                    <span class="text-2xs text-text-muted font-bold opacity-50">×</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      autocomplete="off"
                      class="w-19 h-9 text-sm font-black text-right px-3 py-1 rounded-xl bg-subtle border border-border-muted focus:bg-surface focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all tabular-nums hover:border-text-muted"
                      [value]="facade.cantidades()[moneda.key] || ''"
                      placeholder="0"
                      [disabled]="facade.cajaYaCerrada()"
                      (input)="onCantidadChange(moneda.key, $event)"
                      (focus)="selectAll($event)"
                    />
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Diferencia -->
          <div
            class="p-4 rounded-xl transition-colors flex flex-col gap-3"
            [style.background]="
              'color-mix(in srgb, ' + facade.colorDiferenciaArqueo() + ' 8%, transparent)'
            "
            aria-live="polite"
          >
            <div class="flex items-center justify-between">
              <span class="micro-label">Total Físico Arqueado</span>
              <span
                class="text-base font-black tabular-nums"
                [style.color]="
                  facade.totalArqueo() > 0 ? 'var(--text-primary)' : 'var(--text-muted)'
                "
              >
                {{ clp(facade.totalArqueo()) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span
                class="text-compact font-black uppercase tracking-widest"
                [style.color]="facade.colorDiferenciaArqueo()"
              >
                Diferencia
              </span>
              <span
                class="text-xl font-black tabular-nums tracking-tighter"
                [style.color]="facade.colorDiferenciaArqueo()"
              >
                {{ facade.diferenciaArqueo() > 0 ? '+' : '' }}{{ clp(facade.diferenciaArqueo()) }}
              </span>
            </div>
          </div>

          <!-- Justificación -->
          <div class="flex flex-col gap-2.5">
            <label
              class="micro-label"
              [style.color]="
                facade.diferenciaArqueo() !== 0 ? 'var(--state-warning)' : 'var(--text-muted)'
              "
            >
              {{
                facade.diferenciaArqueo() !== 0
                  ? 'Justificación Obligatoria'
                  : 'Observaciones (Opcional)'
              }}
            </label>
            <textarea
              rows="2"
              class="w-full text-compact px-4 py-3.5 rounded-xl resize-none bg-surface border border-border-muted focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-shadow placeholder:text-text-muted/60"
              placeholder="Ej: Faltan $500 por vuelto mal dado..."
              [disabled]="facade.cajaYaCerrada()"
              [value]="facade.notasArqueo()"
              (input)="facade.notasArqueo.set(getInputValue($event))"
            ></textarea>
          </div>
        }
      </div>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-primary"
          data-llm-action="cerrar-drawer-arqueo"
          (click)="layoutDrawer.close()"
        >
          Listo
        </button>
      </ng-container>
    </app-drawer-form>
  `,
  styles: `
    .field-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      letter-spacing: 0.06em;
      color: var(--ds-brand);
    }
    .field-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
    }
    .field-input--prefixed {
      padding-left: 28px;
    }
    .input-prefix-wrapper {
      position: relative;
    }
    .input-prefix {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-muted);
      pointer-events: none;
    }
  `,
})
export class ArqueoCierreDrawerComponent {
  protected readonly facade = inject(CuadraturaFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly billetes = BILLETES;
  protected readonly monedas = MONEDAS;
  protected readonly clp = formatCLP;

  protected onFondoChange(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    const fondo = raw === '' ? 0 : parseInt(raw, 10) || 0;
    this.facade.fondoInicial.set(fondo);
  }

  protected onCantidadChange(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '');
    if (sanitized !== input.value) input.value = sanitized;
    const val = sanitized === '' ? 0 : parseInt(sanitized, 10);
    this.facade.cantidades.update((prev) => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  }

  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected getInputValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }
}
