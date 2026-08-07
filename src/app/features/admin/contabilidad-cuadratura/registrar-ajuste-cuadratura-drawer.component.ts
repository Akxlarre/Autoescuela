import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HistorialCuadraturasFacade } from '@core/facades/historial-cuadraturas.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import type { AjusteFormData } from '@core/models/ui/cuadratura-adjustment.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

/**
 * RegistrarAjusteCuadraturaDrawerComponent — Panel lateral para registrar un ajuste
 * sobre una cuadratura YA CERRADA (spec 0002-i).
 *
 * Distinto de `RegistrarEgresoDrawerComponent` (fix-006-i, día en curso): este drawer
 * corrige un cierre pasado sin sobrescribir el arqueo original — ver AC5 de la spec.
 * Renderizado vía `LayoutDrawerFacadeService.open()` como NgComponentOutlet. Inyecta
 * `HistorialCuadraturasFacade` directamente para persistir y refrescar el detalle.
 */
@Component({
  selector: 'app-registrar-ajuste-cuadratura-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    IconComponent,
    SelectModule,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
    StableWidthDirective,
  ],
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-5">
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="35%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="30%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="45%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
            <!-- Tipo de ajuste -->
            <div class="flex flex-col gap-1.5">
              <label for="ajuste-tipo" class="field-label">
                TIPO DE AJUSTE <span class="text-error">*</span>
              </label>
              <p-select
                formControlName="tipo"
                [options]="tipoOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar tipo..."
                styleClass="w-full"
                data-llm-description="Selector del tipo de ajuste: gasto olvidado (crea un gasto real) o corrección manual (solo ajusta el total)"
                [class.field-input--error]="isInvalid('tipo')"
              />
              @if (isInvalid('tipo')) {
                <span class="field-error">Seleccione un tipo de ajuste.</span>
              }
            </div>

            <!-- Aviso de fecha efectiva -->
            <div class="flex items-start gap-2 p-3 rounded-lg bg-warning/8">
              <app-icon name="info" [size]="15" color="var(--state-warning)" />
              <p class="text-sm text-text-secondary">
                Este ajuste se sumará a la cuadratura del <strong>{{ fechaCierre() }}</strong
                >, no a la de hoy.
              </p>
            </div>

            <!-- Categoría + Vehículo/Patente (solo si es Gasto olvidado) -->
            @if (isGastoOlvidado()) {
              <div class="flex flex-col gap-1.5">
                <label for="ajuste-categoria" class="field-label">
                  CATEGORÍA <span class="text-error">*</span>
                </label>
                <p-select
                  formControlName="categoria"
                  [options]="categoriaOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleccionar categoría..."
                  styleClass="w-full"
                  data-llm-description="Categoría del gasto olvidado que este ajuste registra"
                  [class.field-input--error]="isInvalid('categoria')"
                />
                @if (isInvalid('categoria')) {
                  <span class="field-error">Seleccione una categoría.</span>
                }
              </div>

              <div
                class="flex flex-col gap-1.5 rounded-lg"
                [class.p-3]="isCombustible()"
                [style.background]="isCombustible() ? 'var(--color-primary-muted)' : null"
              >
                <label for="ajuste-vehiculo" class="field-label">VEHÍCULO / PATENTE</label>
                <p-select
                  formControlName="vehiculoId"
                  [options]="vehicleOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleccionar vehículo (opcional)..."
                  styleClass="w-full"
                  [showClear]="true"
                  data-llm-description="Selector del vehículo asociado al gasto olvidado, muestra el instructor asignado"
                />
              </div>
            }

            <!-- Efecto en el total (solo Corrección manual — un Gasto olvidado siempre resta) -->
            @if (!isGastoOlvidado()) {
              <div class="flex flex-col gap-1.5">
                <label class="field-label">
                  EFECTO EN EL TOTAL VIGENTE <span class="text-error">*</span>
                </label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="efecto-btn"
                    [class.efecto-btn--active-resta]="form.get('efecto')?.value === 'reduce'"
                    data-llm-action="ajuste-efecto-reduce"
                    (click)="form.patchValue({ efecto: 'reduce' })"
                  >
                    <app-icon name="minus" [size]="14" />
                    Resta (faltó dinero)
                  </button>
                  <button
                    type="button"
                    class="efecto-btn"
                    [class.efecto-btn--active-suma]="form.get('efecto')?.value === 'aumenta'"
                    data-llm-action="ajuste-efecto-aumenta"
                    (click)="form.patchValue({ efecto: 'aumenta' })"
                  >
                    <app-icon name="plus" [size]="14" />
                    Suma (sobró dinero)
                  </button>
                </div>
                @if (isInvalid('efecto')) {
                  <span class="field-error">Elija si el ajuste suma o resta.</span>
                }
              </div>
            }

            <!-- Monto -->
            <div class="flex flex-col gap-1.5">
              <label for="ajuste-monto" class="field-label">
                {{ isGastoOlvidado() ? 'MONTO A DESCONTAR (CLP)' : 'MONTO (CLP)' }}
                <span class="text-error">*</span>
              </label>
              <div class="input-prefix-wrapper">
                <span class="input-prefix">$</span>
                <input
                  id="ajuste-monto"
                  type="number"
                  min="1"
                  formControlName="monto"
                  class="field-input field-input--prefixed"
                  placeholder="0"
                  [attr.data-llm-description]="
                    isGastoOlvidado()
                      ? 'Monto que se resta del total vigente por el gasto olvidado'
                      : 'Monto de la corrección manual, en pesos chilenos'
                  "
                  [class.field-input--error]="isInvalid('monto')"
                />
              </div>
              @if (form.get('monto')?.hasError('required') && form.get('monto')?.touched) {
                <span class="field-error">Ingrese el monto.</span>
              } @else if (form.get('monto')?.hasError('min') && form.get('monto')?.touched) {
                <span class="field-error">El monto debe ser mayor a 0.</span>
              } @else if (montoConSigno(); as preview) {
                <span
                  class="text-xs font-bold tabular-nums"
                  [class.text-error]="preview < 0"
                  [class.text-success]="preview > 0"
                >
                  El total vigente cambiará en {{ preview >= 0 ? '+' : '' }}{{ preview | number }}
                </span>
              }
            </div>

            <!-- Motivo -->
            <div class="flex flex-col gap-1.5">
              <label for="ajuste-motivo" class="field-label">
                MOTIVO <span class="text-error">*</span>
              </label>
              <input
                id="ajuste-motivo"
                type="text"
                formControlName="motivo"
                class="field-input"
                placeholder="Ej: Carga de combustible olvidada el día del cierre..."
                data-llm-description="Motivo del ajuste — queda registrado de forma inmutable"
                [class.field-input--error]="isInvalid('motivo')"
              />
              @if (isInvalid('motivo')) {
                <span class="field-error">Ingrese un motivo.</span>
              }
            </div>

            <!-- Error global -->
            @if (saveError()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-error/8">
                <app-icon name="circle-alert" [size]="15" color="var(--state-error)" />
                <p class="text-sm text-error">{{ saveError() }}</p>
              </div>
            }
          </form>
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-secondary"
          [disabled]="isSaving()"
          data-llm-action="cancelar-ajuste-cuadratura"
          (click)="onCancel()"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex items-center justify-center gap-2"
          [disabled]="form.invalid || isSaving()"
          [appStableWidth]="isSaving()"
          data-llm-action="registrar-ajuste-cuadratura"
          (click)="onSubmit()"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="14" class="animate-spin" />
            Guardando...
          } @else {
            <app-icon name="check" [size]="14" />
            Registrar Ajuste
          }
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
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      transition:
        border-color var(--duration-fast),
        box-shadow var(--duration-fast);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }
    .field-input--error {
      border-color: var(--state-error) !important;
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

    .field-error {
      font-size: var(--text-xs);
      color: var(--state-error);
    }

    .efecto-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .efecto-btn--active-resta {
      border-color: var(--state-error);
      background: color-mix(in srgb, var(--state-error) 8%, transparent);
      color: var(--state-error);
    }
    .efecto-btn--active-suma {
      border-color: var(--state-success);
      background: color-mix(in srgb, var(--state-success) 8%, transparent);
      color: var(--state-success);
    }
  `,
})
export class RegistrarAjusteCuadraturaDrawerComponent {
  private readonly sanitizer = inject(ErrorSanitizerService);

  readonly tipoOptions = [
    { label: 'Gasto olvidado', value: 'gasto_olvidado' },
    { label: 'Corrección manual', value: 'correccion_manual' },
  ];

  readonly categoriaOptions = [
    { label: 'Combustible', value: 'combustible' },
    { label: 'Gasto Varios', value: 'gasto' },
  ];

  // ── Injections ───────────────────────────────────────────────────────────────
  protected readonly facade = inject(HistorialCuadraturasFacade);
  private readonly flotaFacade = inject(FlotaFacade);
  private readonly fb = inject(FormBuilder);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado local ─────────────────────────────────────────────────────────────
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  // ── Formulario reactivo ──────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    tipo: ['', Validators.required],
    categoria: [''],
    vehiculoId: [null as number | null],
    // Solo aplica a "correccion_manual" — un "gasto_olvidado" siempre resta (ver
    // isGastoOlvidado()/onSubmit()). Requerido dinámicamente para el otro caso.
    efecto: ['' as 'aumenta' | 'reduce' | ''],
    monto: [null as number | null, [Validators.required, Validators.min(1)]],
    motivo: ['', [Validators.required, Validators.minLength(3)]],
  });

  // Signals derivados de valueChanges (NO leer form.get('x').value dentro de un
  // computed(): un computed() sin señales-productoras reales no se re-evalúa tras
  // el primer read — cachea para siempre. Hallazgo de test, 2026-08-06.
  private readonly tipoValue = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });
  private readonly categoriaValue = toSignal(this.form.controls.categoria.valueChanges, {
    initialValue: this.form.controls.categoria.value,
  });
  private readonly montoValue = toSignal(this.form.controls.monto.valueChanges, {
    initialValue: this.form.controls.monto.value,
  });
  private readonly efectoValue = toSignal(this.form.controls.efecto.valueChanges, {
    initialValue: this.form.controls.efecto.value,
  });

  constructor() {
    void this.flotaFacade.initialize();
  }

  // ── Vehículos (mismo patrón que RegistrarEgresoDrawerComponent, fix-006-i) ───
  protected readonly vehicleOptions = computed(() =>
    this.flotaFacade.vehicles().map((v) => ({
      label: `${v.brand} ${v.model} - ${v.licensePlate} (${
        v.instructorName ? `Asignado a: ${v.instructorName}` : 'Sin instructor asignado'
      })`,
      value: v.id,
    })),
  );

  // ── Computed ─────────────────────────────────────────────────────────────────
  protected readonly isGastoOlvidado = computed(() => this.tipoValue() === 'gasto_olvidado');
  protected readonly isCombustible = computed(() => this.categoriaValue() === 'combustible');

  /**
   * Preview con signo del efecto sobre el total vigente — resuelve la confusión
   * de si el ajuste suma o resta (feedback de usuario, 2026-08-06). `null` mientras
   * falte el monto o (en corrección manual) todavía no se eligió el efecto.
   */
  protected readonly montoConSigno = computed((): number | null => {
    const raw = this.montoValue();
    if (!raw) return null;
    const abs = Math.abs(Number(raw));
    if (this.isGastoOlvidado()) return -abs;
    const efecto = this.efectoValue();
    if (efecto === 'aumenta') return abs;
    if (efecto === 'reduce') return -abs;
    return null;
  });

  protected readonly fechaCierre = computed(() => {
    const cierre = this.facade.cierreSeleccionado();
    if (!cierre) return '—';
    const [yyyy, mm, dd] = cierre.fecha.split('-');
    return `${dd}/${mm}/${yyyy}`;
  });

  // ── Helpers de template ──────────────────────────────────────────────────────
  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected onCancel(): void {
    this.layoutDrawer.close();
  }

  protected async onSubmit(): Promise<void> {
    if (this.isGastoOlvidado()) {
      this.form.get('categoria')?.addValidators(Validators.required);
      this.form.get('categoria')?.updateValueAndValidity();
    } else {
      // "Corrección manual" exige elegir explícitamente el efecto (suma/resta) —
      // sin default implícito, para no adivinar la intención del admin.
      this.form.get('efecto')?.addValidators(Validators.required);
      this.form.get('efecto')?.updateValueAndValidity();
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      const { tipo, categoria, vehiculoId, motivo } = this.form.getRawValue();
      const esGastoOlvidado = tipo === 'gasto_olvidado';
      const montoConSigno = this.montoConSigno();
      const datos: AjusteFormData = {
        tipo: tipo as 'gasto_olvidado' | 'correccion_manual',
        // Signo ya resuelto por montoConSigno(): gasto olvidado siempre negativo;
        // corrección manual según el toggle "Resta"/"Suma" elegido explícitamente.
        monto: montoConSigno ?? 0,
        motivo: motivo ?? '',
        categoria: esGastoOlvidado ? (categoria ?? undefined) : undefined,
        vehiculoId: esGastoOlvidado ? (vehiculoId ?? null) : null,
      };

      const ok = await this.facade.registrarAjuste(datos);
      if (ok) {
        this.layoutDrawer.close();
      }
    } catch (err) {
      this.saveError.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al guardar. Intenta de nuevo.',
      );
    } finally {
      this.isSaving.set(false);
    }
  }
}
