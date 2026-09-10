import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type { EgresoFormData } from '@core/models/ui/cuadratura.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

/**
 * RegistrarEgresoDrawerComponent — Panel lateral para registrar un egreso/retiro.
 *
 * Renderizado vía `LayoutDrawerFacadeService.open()` como NgComponentOutlet.
 * Reutilizable: se abre desde la página de Cuadratura y desde el atajo del dashboard.
 *
 * fix-243-m — cada tipo de egreso ahora exige la asociación de la que sale su sede:
 * - `combustible` → vehículo obligatorio (sede = `vehicle.branchId`; si el vehículo es una
 *   fila legacy sin sede, aparece el campo Sede como fallback).
 * - `anticipo` → instructor obligatorio. El guardado NO pasa por `CuadraturaFacade` sino
 *   por `AnticiposFacade.registrarAnticipo()` (necesita `instructor_id`; la tabla no tiene
 *   `branch_id`, la sede se deriva del instructor).
 * - `gasto` → campo Sede obligatorio (no hay de dónde derivarla).
 *
 * Sin esto, un egreso registrado con el admin en "Todas las sedes" quedaba con
 * `branch_id: null` — invisible en toda cuadratura por sede (DG-082).
 */
@Component({
  selector: 'app-registrar-egreso-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
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
            <!-- Tipo de egreso (label + select) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="35%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <!-- Monto (label + input) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="30%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <!-- Descripción / Motivo (label + input) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="45%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <!-- Fecha (label + display box) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="20%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          <!-- ── Cuerpo con formulario ─────────────────────────────────────── -->
          <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
            <!-- Tipo de egreso -->
            <div class="flex flex-col gap-1.5">
              <label for="egr-tipo" class="field-label">
                TIPO DE EGRESO <span class="text-error">*</span>
              </label>
              <p-select
                inputId="egr-tipo"
                formControlName="tipo"
                [options]="tipoOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar tipo..."
                styleClass="w-full"
                data-llm-description="Selector del tipo de egreso: combustible, gastos varios o anticipo a instructor"
                [class.field-input--error]="isInvalid('tipo')"
              />
              @if (isInvalid('tipo')) {
                <span class="field-error">Seleccione un tipo de egreso.</span>
              }
            </div>

            <!-- Vehículo / Patente (obligatorio para Combustible: de él sale la sede) -->
            @if (isCombustible()) {
              <div
                class="flex flex-col gap-1.5 rounded-lg p-3"
                [style.background]="'var(--color-primary-muted)'"
              >
                <label for="egr-vehiculo" class="field-label">
                  VEHÍCULO / PATENTE <span class="text-error">*</span>
                </label>
                <p-select
                  inputId="egr-vehiculo"
                  formControlName="vehiculoId"
                  [options]="vehicleOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleccionar vehículo..."
                  styleClass="w-full"
                  data-llm-description="Selector del vehículo asociado al egreso de combustible; determina la sede del egreso"
                  [class.field-input--error]="isInvalid('vehiculoId')"
                />
                @if (isInvalid('vehiculoId')) {
                  <span class="field-error">Seleccione el vehículo del egreso.</span>
                }
              </div>
            }

            <!-- Instructor (obligatorio para Anticipo: de él sale la sede) -->
            @if (isAnticipo()) {
              <div class="flex flex-col gap-1.5">
                <label for="egr-instructor" class="field-label">
                  INSTRUCTOR <span class="text-error">*</span>
                </label>
                <p-select
                  inputId="egr-instructor"
                  formControlName="instructorId"
                  [options]="instructorOptions()"
                  optionLabel="nombre"
                  optionValue="id"
                  placeholder="Seleccionar instructor..."
                  styleClass="w-full"
                  data-llm-description="Selector del instructor al que se registra el anticipo; determina la sede del egreso"
                  [class.field-input--error]="isInvalid('instructorId')"
                />
                @if (isInvalid('instructorId')) {
                  <span class="field-error">Seleccione un instructor.</span>
                }
              </div>
            }

            <!-- Sede (solo admin; solo cuando la sede no se puede derivar) -->
            @if (showSedeField()) {
              <div class="flex flex-col gap-1.5">
                <label for="egr-sede" class="field-label">
                  SEDE <span class="text-error">*</span>
                </label>
                <p-select
                  inputId="egr-sede"
                  formControlName="branchId"
                  [options]="branchOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleccionar sede..."
                  styleClass="w-full"
                  data-llm-description="Sede a la que se imputa el egreso"
                  [class.field-input--error]="isInvalid('branchId')"
                />
                @if (isInvalid('branchId')) {
                  <span class="field-error">Seleccione la sede del egreso.</span>
                }
              </div>
            }

            <!-- Monto -->
            <div class="flex flex-col gap-1.5">
              <label for="egr-monto" class="field-label">
                MONTO (CLP) <span class="text-error">*</span>
              </label>
              <div class="input-prefix-wrapper">
                <span class="input-prefix">$</span>
                <input
                  id="egr-monto"
                  type="number"
                  min="1"
                  formControlName="monto"
                  class="field-input field-input--prefixed"
                  placeholder="0"
                  data-llm-description="Monto del egreso en pesos chilenos"
                  [class.field-input--error]="isInvalid('monto')"
                />
              </div>
              @if (form.get('monto')?.hasError('required') && form.get('monto')?.touched) {
                <span class="field-error">Ingrese el monto.</span>
              } @else if (form.get('monto')?.hasError('min') && form.get('monto')?.touched) {
                <span class="field-error">El monto debe ser mayor a 0.</span>
              }
            </div>

            <!-- Método de Pago -->
            <div class="flex flex-col gap-1.5">
              <label for="egr-metodo-pago" class="field-label">
                MÉTODO DE PAGO <span class="text-error">*</span>
              </label>
              <p-select
                inputId="egr-metodo-pago"
                formControlName="metodoPago"
                [options]="metodoPagoOptions"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
                data-llm-description="Método con el que se pagó el egreso: determina si resta del efectivo del arqueo de caja"
              />
            </div>

            <!-- Descripción / Motivo -->
            <div class="flex flex-col gap-1.5">
              <label for="egr-descripcion" class="field-label">
                {{ tipoLabel() }} <span class="text-error">*</span>
              </label>
              <input
                id="egr-descripcion"
                type="text"
                formControlName="descripcion"
                class="field-input"
                [placeholder]="tipoPlaceholder()"
                data-llm-description="Descripción o motivo del egreso"
                [class.field-input--error]="isInvalid('descripcion')"
              />
              @if (isInvalid('descripcion')) {
                <span class="field-error">Ingrese una descripción o motivo.</span>
              }
            </div>

            <!-- Fecha (display-only) -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label">FECHA</label>
              <div
                class="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg bg-surface border border-border-muted text-text-muted"
              >
                <app-icon name="calendar" [size]="14" />
                {{ fechaHoy() }}
                <span class="text-xs ml-auto">(Hoy — no modificable)</span>
              </div>
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

      <!-- ── Footer fijo ─────────────────────────────────────────────── -->
      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-secondary"
          [disabled]="isSaving()"
          data-llm-action="cancelar-egreso-cuadratura"
          (click)="onCancel()"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex items-center justify-center gap-2"
          [disabled]="form.invalid || isSaving()"
          [appStableWidth]="isSaving()"
          data-llm-action="guardar-egreso-cuadratura"
          (click)="onSubmit()"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="14" class="animate-spin" />
            Guardando...
          } @else {
            <app-icon name="check" [size]="14" />
            Guardar Egreso
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
  styles: `
    /* ── Fields ── */
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
    .field-select {
      appearance: auto;
      cursor: pointer;
    }

    /* ── Prefix wrapper ── */
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

    /* ── Field error ── */
    .field-error {
      font-size: var(--text-xs);
      color: var(--state-error);
    }
  `,
})
export class RegistrarEgresoDrawerComponent {
  private readonly sanitizer = inject(ErrorSanitizerService);
  readonly tipoOptions = [
    { label: 'Combustible', value: 'combustible' },
    { label: 'Gastos Varios', value: 'gasto' },
    { label: 'Anticipo a Instructor', value: 'anticipo' },
  ];
  readonly metodoPagoOptions = [
    { label: 'Efectivo', value: 'efectivo' },
    { label: 'Transferencia', value: 'transferencia' },
    { label: 'Tarjeta', value: 'tarjeta' },
  ];

  // ── Injections ───────────────────────────────────────────────────────────────
  protected readonly facade = inject(CuadraturaFacade);
  private readonly flotaFacade = inject(FlotaFacade);
  private readonly anticiposFacade = inject(AnticiposFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly auth = inject(AuthFacade);
  private readonly fb = inject(FormBuilder);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado local ─────────────────────────────────────────────────────────────
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  // ── Formulario reactivo ──────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    tipo: ['', Validators.required],
    monto: [null as number | null, [Validators.required, Validators.min(1)]],
    descripcion: ['', [Validators.required, Validators.minLength(3)]],
    /** Obligatorio solo para `combustible` — de él sale la sede (`expenses.vehicle_id`). */
    vehiculoId: [null as number | null],
    /** Obligatorio solo para `anticipo` — enruta a `AnticiposFacade.registrarAnticipo()`. */
    instructorId: [null as number | null],
    /** Obligatorio para `gasto`, y para `combustible` si el vehículo es legacy sin sede. */
    branchId: [null as number | null],
    metodoPago: ['efectivo' as 'efectivo' | 'transferencia' | 'tarjeta', Validators.required],
  });

  // ── Señales derivadas del formulario ────────────────────────────────────────
  private readonly tipoValue = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });
  private readonly vehiculoIdValue = toSignal(this.form.controls.vehiculoId.valueChanges, {
    initialValue: this.form.controls.vehiculoId.value,
  });

  // ── Vehículos (selector "Vehículo / Patente" con instructor asignado) ────────
  protected readonly vehicleOptions = computed(() =>
    this.flotaFacade.vehicles().map((v) => ({
      label: `${v.brand} ${v.model} - ${v.licensePlate} (${
        v.instructorName ? `Asignado a: ${v.instructorName}` : 'Sin instructor asignado'
      })`,
      value: v.id,
    })),
  );

  protected readonly instructorOptions = computed(() => this.anticiposFacade.instructores());

  protected readonly branchOptions = computed(() =>
    this.branchFacade.branches().map((b) => ({ label: b.name, value: b.id })),
  );

  constructor() {
    void this.flotaFacade.initialize();
    void this.anticiposFacade.initialize();

    // Preset de tipo (ej: "combustible" desde el atajo del dashboard) — se consume una sola vez.
    const preset = this.facade.egresoTipoPreset();
    if (preset) {
      this.form.patchValue({ tipo: preset });
      this.facade.egresoTipoPreset.set(null);
    }

    // Validadores dinámicos según el tipo + prefill de la sede activa. Se resuelve por
    // suscripción (no `effect()`) para que corra sincrónicamente en cada cambio del form,
    // sin depender de un ciclo de detección de cambios.
    merge(this.form.controls.tipo.valueChanges, this.form.controls.vehiculoId.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.syncValidators());
    this.syncValidators();
  }

  /** Ajusta qué campos son obligatorios según el tipo, y precarga la sede activa. */
  private syncValidators(): void {
    const tipo = this.form.controls.tipo.value;
    const combustible = tipo === 'combustible';
    const anticipo = tipo === 'anticipo';

    const vehicle = this.selectedVehicle();
    const combustibleSinSede = combustible && !!vehicle && vehicle.branchId == null;
    const needsSede = this.isAdminLike() && (tipo === 'gasto' || combustibleSinSede);

    this.setRequired(this.form.controls.vehiculoId, combustible);
    this.setRequired(this.form.controls.instructorId, anticipo);
    this.setRequired(this.form.controls.branchId, needsSede);

    if (needsSede && this.form.controls.branchId.value == null) {
      const active = this.forcedBranchId();
      if (active != null) {
        this.form.controls.branchId.setValue(active, { emitEvent: false });
      }
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  protected readonly isCombustible = computed(() => this.tipoValue() === 'combustible');
  protected readonly isAnticipo = computed(() => this.tipoValue() === 'anticipo');
  protected readonly isGasto = computed(() => this.tipoValue() === 'gasto');

  /** Admin (o secretaria con acceso a ambas sedes) → puede elegir sede; secretaria → no. */
  private readonly isAdminLike = computed(() => {
    const u = this.auth.currentUser();
    return u?.role === 'admin' || !!u?.canAccessBothBranches;
  });

  /** Sede impuesta a una secretaria, o el selector activo del admin (`null` = Todas las sedes). */
  private readonly forcedBranchId = computed<number | null>(() => {
    const u = this.auth.currentUser();
    return resolveBranchScope(
      u?.role,
      u?.branchId,
      this.branchFacade.selectedBranchId(),
      u?.canAccessBothBranches,
    );
  });

  private readonly selectedVehicle = computed(
    () => this.flotaFacade.vehicles().find((v) => v.id === this.vehiculoIdValue()) ?? null,
  );

  /** Vehículo elegido que es una fila legacy sin sede asignada (`branchId` null). */
  private readonly vehicleHasNoBranch = computed(() => {
    const v = this.selectedVehicle();
    return !!v && v.branchId == null;
  });

  /**
   * El campo Sede se muestra solo al admin y solo cuando la sede no se puede derivar:
   * - `gasto` → siempre (no hay asociación de la cual sacarla)
   * - `combustible` → solo si el vehículo elegido no tiene sede (fila legacy)
   * - `anticipo` → nunca (sale del instructor)
   */
  protected readonly showSedeField = computed(
    () =>
      this.isAdminLike() && (this.isGasto() || (this.isCombustible() && this.vehicleHasNoBranch())),
  );

  protected readonly tipoLabel = computed(() => {
    const tipo = this.tipoValue();
    if (tipo === 'anticipo') return 'Motivo del anticipo';
    if (tipo === 'combustible') return 'Detalle (ej: patente, litros)';
    return 'Descripción / Motivo';
  });

  protected readonly tipoPlaceholder = computed(() => {
    const tipo = this.tipoValue();
    if (tipo === 'anticipo') return 'Ej: Anticipo por combustible...';
    if (tipo === 'combustible') return 'Ej: Carga camioneta ABC-123...';
    return 'Ej: Compra insumos oficina...';
  });

  protected readonly fechaHoy = computed(() =>
    new Date().toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );

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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      const raw = this.form.getRawValue();
      const tipo = raw.tipo as EgresoFormData['tipo'];
      const metodoPago = raw.metodoPago ?? 'efectivo';

      let ok = false;

      if (tipo === 'anticipo') {
        // El anticipo NO pasa por CuadraturaFacade: necesita instructor_id y la lógica de
        // notificación al instructor que ya vive en AnticiposFacade.
        ok = await this.anticiposFacade.registrarAnticipo({
          instructorId: Number(raw.instructorId),
          date: this.fechaHoyISO(),
          amount: Number(raw.monto),
          reason: '',
          description: raw.descripcion ?? '',
          paymentMethod: metodoPago,
        });
        if (ok) await this.facade.refresh();
      } else {
        const branchId =
          tipo === 'combustible'
            ? (this.selectedVehicle()?.branchId ?? raw.branchId ?? this.forcedBranchId())
            : (raw.branchId ?? this.forcedBranchId());

        const datos: EgresoFormData = {
          tipo,
          monto: Number(raw.monto),
          descripcion: raw.descripcion ?? '',
          vehiculoId: raw.vehiculoId ?? null,
          branchId: branchId ?? null,
          metodoPago,
        };
        ok = await this.facade.registrarEgreso(datos);
      }

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

  private setRequired(ctrl: AbstractControl, required: boolean): void {
    ctrl.setValidators(required ? [Validators.required] : []);
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  private fechaHoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
