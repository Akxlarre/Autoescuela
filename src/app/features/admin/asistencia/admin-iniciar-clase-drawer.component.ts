import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { kmWarning, odometerFontTier } from '@core/utils/odometer.utils';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { StaleSessionError } from '@core/utils/class-b-session.utils';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import type { ClasePracticaRow, VehicleOption } from '@core/models/ui/asistencia-clase-b.model';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import { RegistrarPagoDrawerComponent } from '@features/admin/pagos/registrar-pago-drawer.component';
import { formatCLP } from '@core/utils/date.utils';

@Component({
  selector: 'app-admin-iniciar-clase-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    FormsModule,
    ReactiveFormsModule,
    SelectModule,
    IconComponent,
    AlertCardComponent,
    DrawerFormComponent,
  ],
  template: `
    @if (facade.selectedPractica(); as cls) {
      <app-drawer-form>
        <!-- Ticket resumen -->
        <div
          class="relative overflow-hidden rounded-xl border border-border-default bg-surface p-5 mb-6"
        >
          <div
            class="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-bl-full pointer-events-none -mr-6 -mt-6"
          ></div>
          <div class="flex items-center gap-3 relative z-10">
            <div
              class="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex flex-col items-center justify-center shrink-0"
            >
              <span class="text-2xs uppercase tracking-wider font-bold text-brand leading-tight"
                >Clase</span
              >
              <span class="text-lg font-display font-bold text-brand leading-none">{{
                cls.classNumber ?? '—'
              }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="font-semibold text-text-primary truncate"
                [pTooltip]="cls.alumnoName ?? 'Sin alumno'"
                tooltipPosition="top"
              >
                {{ cls.alumnoName ?? 'Sin alumno' }}
              </p>
              <p class="text-xs text-text-muted mt-0.5">
                {{ cls.horaInicio }} · {{ cls.instructorName }}
                @if (selectedVehicle(); as v) {
                  · {{ v.plate }}
                  @if (v.brand || v.model) {
                    ({{ v.brand ?? '' }} {{ v.model ?? '' }})
                  }
                } @else if (cls.vehiclePlate) {
                  · {{ cls.vehiclePlate }}
                  @if (cls.vehicleBrand || cls.vehicleModel) {
                    ({{ cls.vehicleBrand ?? '' }} {{ cls.vehicleModel ?? '' }})
                  }
                }
              </p>
            </div>
          </div>
        </div>

        @if (error()) {
          <app-alert-card title="Error" severity="error" class="mb-4">
            {{ error() }}
          </app-alert-card>
        }

        <!-- Spec 0010-i: la clase 7+ exige el segundo pago (o una habilitación sin pago) -->
        @if (estadoPago(); as pago) {
          @if (pago.estado === 'bloqueada') {
            <div
              class="mb-6 rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col gap-3"
              role="alert"
              data-llm-description="Clase bloqueada por pago pendiente de la segunda parte"
            >
              <div class="flex items-start gap-3">
                <app-icon name="lock" [size]="18" class="text-error shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <p class="item-title m-0">Bloqueada: pago pendiente {{ clp(pago.saldo) }}</p>
                  <p class="text-xs text-text-secondary mt-1 mb-0">
                    Desde la clase 7 el alumno debe tener pagada la segunda parte.
                  </p>
                </div>
              </div>

              @if (mostrarMotivo()) {
                <div class="flex flex-col gap-1.5">
                  <label for="motivo-sin-pago" class="field-label"
                    >Motivo para habilitar sin pago</label
                  >
                  <textarea
                    id="motivo-sin-pago"
                    rows="3"
                    class="field-input"
                    placeholder="Ej. Paga el viernes, acordado con el admin"
                    [value]="motivo()"
                    (input)="onMotivoInput($event)"
                    data-llm-description="Motivo obligatorio para habilitar sin pago las clases 7 a 12 del alumno"
                  ></textarea>
                  <div class="flex gap-2 justify-end">
                    <button
                      type="button"
                      class="btn-secondary"
                      [disabled]="facade.isSaving()"
                      (click)="cancelarMotivo()"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      class="btn-primary flex items-center gap-2"
                      [disabled]="!motivoValido() || facade.isSaving()"
                      (click)="onHabilitarSinPago(cls)"
                      data-llm-action="confirmar-habilitar-clase-sin-pago"
                    >
                      @if (facade.isSaving()) {
                        <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                      }
                      Habilitar sin pago
                    </button>
                  </div>
                </div>
              } @else {
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn-primary flex items-center gap-2"
                    (click)="onRegistrarPago(cls)"
                    data-llm-action="registrar-pago-desde-iniciar-clase"
                  >
                    <app-icon name="credit-card" [size]="16" />
                    Registrar pago
                  </button>
                  <button
                    type="button"
                    class="btn-secondary flex items-center gap-2"
                    (click)="mostrarMotivo.set(true)"
                    data-llm-action="habilitar-clase-sin-pago"
                  >
                    <app-icon name="unlock" [size]="16" />
                    Habilitar sin pago
                  </button>
                </div>
              }
            </div>
          } @else if (pago.estado === 'habilitada_sin_pago') {
            <div
              class="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-4 flex flex-wrap items-center justify-between gap-3"
              role="status"
              data-llm-description="Clase habilitada sin pago: el alumno sigue con deuda"
            >
              <div class="flex items-center gap-2 min-w-0">
                <app-icon name="triangle-alert" [size]="16" class="text-warning shrink-0" />
                <p class="text-sm text-text-primary m-0">
                  Habilitada sin pago — debe {{ clp(pago.saldo) }}
                </p>
              </div>
              <button
                type="button"
                class="btn-secondary flex items-center gap-2"
                (click)="onRegistrarPago(cls)"
                data-llm-action="registrar-pago-desde-iniciar-clase"
              >
                <app-icon name="credit-card" [size]="16" />
                Registrar pago
              </button>
            </div>
          }
        }

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit(cls)"
          class="flex flex-col gap-6"
          [class.hidden]="bloqueada()"
        >
          <!-- Selector de vehículo -->
          @if (facade.vehiclesPorSede().length > 0) {
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                Vehículo
              </label>
              <p-select
                [ngModel]="selectedVehicleId()"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="onVehicleSelectChange($event)"
                [options]="vehicleOptions()"
                optionLabel="label"
                optionValue="id"
                styleClass="w-full"
                data-llm-description="Selector de vehículo para la clase práctica"
              />
            </div>
          }

          <!-- Formulario odómetro -->
          <div
            class="rounded-2xl border-2 p-8 flex flex-col items-center transition-colors"
            [class.border-border-default]="
              form.get('kmStart')?.valid || !form.get('kmStart')?.touched
            "
            [class.border-error]="form.get('kmStart')?.invalid && form.get('kmStart')?.touched"
          >
            <div
              class="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-5 ring-1 ring-brand/20"
            >
              <app-icon name="gauge" [size]="28" />
            </div>
            <label
              class="text-xs font-bold text-text-secondary uppercase tracking-widest mb-3"
              for="kmStartAdmin"
            >
              Kilometraje Actual
            </label>
            <div
              class="flex items-center gap-3 bg-subtle rounded-2xl border border-border-default/60 px-6 py-3"
            >
              <input
                id="kmStartAdmin"
                type="number"
                formControlName="kmStart"
                max="999999"
                class="bg-transparent! border-none! outline-none! shadow-none! ring-0! font-display font-black text-text-primary text-center p-0 w-36 placeholder:text-border-strong tracking-tighter tabular-nums m-0 focus:bg-transparent! transition-all duration-150"
                [class.text-5xl]="kmFontTier() === '5xl'"
                [class.text-4xl]="kmFontTier() === '4xl'"
                [class.text-3xl]="kmFontTier() === '3xl'"
                placeholder="0"
                data-llm-description="Odómetro inicial del vehículo para iniciar clase práctica"
              />
              <span class="text-2xl font-bold text-text-muted select-none mt-1">km</span>
            </div>
            @if (form.get('kmStart')?.invalid && form.get('kmStart')?.touched) {
              <div
                class="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error/10 text-error text-xs font-medium"
              >
                <app-icon name="alert-circle" [size]="13" />
                @if (form.get('kmStart')?.hasError('max')) {
                  <span>El valor máximo es 999.999 km</span>
                } @else {
                  <span>Ingrese un valor válido</span>
                }
              </div>
            } @else {
              <p class="text-xs text-text-muted mt-3 opacity-70">
                Verifique el panel del vehículo antes de arrancar.
              </p>
            }
            <!-- fix-375-m: aviso, no bloquea (el odómetro real manda) -->
            @if (startKmWarning(); as warning) {
              <div
                class="mt-3 flex items-start gap-1.5 px-3 py-1.5 rounded-md bg-warning/10 text-warning text-xs font-medium"
                role="status"
                data-llm-description="Aviso de kilometraje de salida sospechoso"
              >
                <app-icon name="alert-triangle" [size]="13" class="shrink-0 mt-px" />
                <span>{{ warning }}</span>
              </div>
            }
          </div>
        </form>

        <!-- fix-374-m: registrar la inasistencia sin salir del Dashboard -->
        @if (canMarkAbsent()) {
          <div
            class="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border-default p-4"
          >
            <p class="text-xs text-text-secondary m-0">¿El alumno no llegó?</p>
            <button
              type="button"
              class="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer text-error border-error bg-error/10"
              [disabled]="isSubmitting()"
              (click)="onMarkAbsent(cls)"
              data-llm-action="mark-ausente-desde-iniciar"
            >
              <app-icon name="x-circle" [size]="12" />
              Marcar ausente
            </button>
          </div>
        }

        <ng-container ngProjectAs="[drawer-form-footer]">
          <button
            type="button"
            class="btn-secondary flex-1"
            [disabled]="isSubmitting()"
            (click)="layoutDrawer.close()"
          >
            Cancelar
          </button>
          @if (!bloqueada()) {
            <button
              type="button"
              class="btn-primary flex-1 flex items-center justify-center gap-2"
              [disabled]="form.invalid || isSubmitting()"
              (click)="onSubmit(cls)"
              data-llm-action="admin-start-class"
            >
              @if (isSubmitting()) {
                <app-icon name="loader-2" [size]="16" class="animate-spin" />
                <span>Iniciando...</span>
              } @else {
                <app-icon name="play" [size]="16" />
                <span>Comenzar Clase</span>
              }
            </button>
          }
        </ng-container>
      </app-drawer-form>
    }
  `,
})
export class AdminIniciarClaseDrawerComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly pagosFacade = inject(PagosFacade);

  protected readonly clp = formatCLP;

  // ── Spec 0010-i: segundo pago ───────────────────────────────────────────────
  protected readonly estadoPago = this.facade.estadoPagoClase;
  /** Clase 7+ con deuda y sin habilitación: no se muestra "Comenzar Clase" (la BD igual lo rechaza). */
  protected readonly bloqueada = computed(() => this.estadoPago()?.estado === 'bloqueada');
  protected readonly mostrarMotivo = signal(false);
  protected readonly motivo = signal('');
  protected readonly motivoValido = computed(() => this.motivo().trim().length >= 5);

  protected onMotivoInput(event: Event): void {
    this.motivo.set((event.target as HTMLTextAreaElement).value);
  }

  protected cancelarMotivo(): void {
    this.mostrarMotivo.set(false);
    this.motivo.set('');
  }

  /**
   * Abre el drawer de pago existente con la matrícula precargada. Al guardar, ese drawer vuelve
   * (back) a este, que se re-crea y relee el saldo en ngOnInit: la clase queda lista para iniciar.
   */
  protected onRegistrarPago(cls: ClasePracticaRow): void {
    if (cls.enrollmentId === null) return;
    this.pagosFacade.seleccionarParaPago(cls.enrollmentId);
    this.layoutDrawer.push(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card');
  }

  protected async onHabilitarSinPago(cls: ClasePracticaRow): Promise<void> {
    if (cls.enrollmentId === null || !this.motivoValido()) return;
    const ok = await this.facade.habilitarSinPago(cls.enrollmentId, this.motivo());
    if (ok) this.cancelarMotivo();
  }

  protected readonly isSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Valor reactivo de kmStart para dimensionar la fuente del odómetro (OnPush-safe). */
  protected readonly kmValue = signal<number | null>(null);

  /** Tier de fuente adaptativo (fix-050): el número se achica para caber en la caja fija. */
  protected readonly kmFontTier = computed(() => odometerFontTier(this.kmValue()));

  /** ID del vehículo seleccionado en el dropdown (null = usa el de la sesión). */
  protected readonly selectedVehicleId = signal<number | null>(null);

  /** Objeto completo del vehículo seleccionado (para el ticket resumen). */
  protected readonly selectedVehicle = computed<VehicleOption | null>(() => {
    const id = this.selectedVehicleId();
    if (id === null) return null;
    return this.facade.vehiclesPorSede().find((v) => v.id === id) ?? null;
  });

  /** Opciones formateadas para p-select (plate · brand model). */
  protected readonly vehicleOptions = computed(() =>
    this.facade.vehiclesPorSede().map((v) => ({
      id: v.id,
      label: `${v.plate}${v.brand ? ' · ' + v.brand : ''}${v.model ? ' ' + v.model : ''}`,
    })),
  );

  /** fix-375-m: km de salida contra el registrado del vehículo elegido (o el de la sesión). */
  protected readonly startKmWarning = computed(() =>
    kmWarning(
      'start',
      this.kmValue(),
      this.selectedVehicle()?.currentKm ?? this.facade.selectedPractica()?.vehicleCurrentKm ?? null,
    ),
  );

  /** fix-374-m: la hora de la clase ya pasó → se puede registrar la inasistencia desde aquí. */
  protected canMarkAbsent(): boolean {
    const at = this.facade.selectedPractica()?.scheduledAt;
    return !!at && new Date(at) < new Date();
  }

  protected async onMarkAbsent(cls: { id: number }): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Marcar inasistencia',
      message:
        '¿Confirmas que el alumno no asistió a esta clase? Esta acción queda registrada en su historial de asistencia.',
      confirmLabel: 'Marcar ausente',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });
    if (!confirmed) return;
    this.isSubmitting.set(true);
    try {
      const done = await this.facade.markAttendance(cls.id, 'ausente');
      if (done) {
        void this.dashboardFacade.refreshLiveClassesOnly();
        this.layoutDrawer.close();
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  form!: FormGroup;

  ngOnInit(): void {
    const cls = this.facade.selectedPractica();
    // Spec 0010-i: también corre al volver del drawer de pago (el drawer se re-crea).
    if (cls) void this.facade.cargarEstadoPagoClase(cls);
    const currentKm = cls?.vehicleCurrentKm ?? null;
    this.form = this.fb.group({
      kmStart: [currentKm, [Validators.required, Validators.min(0), Validators.max(999999)]],
    });

    // Refleja kmStart en un signal para el tier de fuente adaptativo (OnPush-safe).
    this.kmValue.set(currentKm);
    this.form
      .get('kmStart')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.kmValue.set(v));

    if (cls?.branchId) {
      this.facade.loadVehiclesByBranch(cls.branchId).then(() => {
        // Pre-selecciona el vehículo actual de la sesión
        if (cls.vehicleId) this.selectedVehicleId.set(cls.vehicleId);
      });
    }
  }

  protected onVehicleSelectChange(id: number): void {
    this.selectedVehicleId.set(id);
    const vehicle = this.facade.vehiclesPorSede().find((v) => v.id === id);
    if (vehicle?.currentKm != null) {
      this.form.patchValue({ kmStart: vehicle.currentKm });
    }
  }

  async onSubmit(cls: NonNullable<ReturnType<typeof this.facade.selectedPractica>>): Promise<void> {
    if (this.form.invalid) return;
    this.isSubmitting.set(true);
    this.error.set(null);
    try {
      const vehicleId = this.selectedVehicleId() ?? undefined;
      await this.facade.startClass(cls.id, this.form.value.kmStart, vehicleId);
      void this.dashboardFacade.refreshLiveClassesOnly();
      this.layoutDrawer.close();
    } catch (err) {
      // fix-388-m: si otra persona ya cambió la clase, "Clases Actuales" también quedó vieja.
      if (err instanceof StaleSessionError) void this.dashboardFacade.refreshLiveClassesOnly();
      this.error.set(
        err instanceof Error ? err.message : 'No se pudo iniciar la clase. Intenta de nuevo.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
