import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import type { VehicleOption } from '@core/models/ui/asistencia-clase-b.model';
import { AdminFinalizarClaseDrawerComponent } from './admin-finalizar-clase-drawer.component';

@Component({
  selector: 'app-admin-iniciar-clase-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, AlertCardComponent],
  template: `
    @if (facade.selectedPractica(); as cls) {
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
            <span class="text-[9px] uppercase tracking-wider font-bold text-brand leading-tight"
              >Clase</span
            >
            <span class="text-lg font-display font-bold text-brand leading-none">{{
              cls.classNumber ?? '—'
            }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-primary truncate">{{ cls.alumnoName ?? 'Sin alumno' }}</p>
            <p class="text-xs text-muted mt-0.5">
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

      <form [formGroup]="form" (ngSubmit)="onSubmit(cls)" class="flex flex-col gap-6">
        <!-- Selector de vehículo -->
        @if (facade.vehiclesPorSede().length > 0) {
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-secondary uppercase tracking-widest">
              Vehículo
            </label>
            <select
              class="text-sm rounded-xl border px-3 py-2.5 bg-surface text-primary focus:outline-none cursor-pointer w-full"
              [style.border-color]="'var(--border-default)'"
              [value]="selectedVehicleId()"
              (change)="onVehicleChange($event)"
              data-llm-description="Selector de vehículo para la clase práctica"
            >
              @for (v of facade.vehiclesPorSede(); track v.id) {
                <option [value]="v.id" class="cursor-pointer">
                  {{ v.plate }}{{ v.brand ? ' · ' + v.brand : ''
                  }}{{ v.model ? ' ' + v.model : '' }}
                </option>
              }
            </select>
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
            class="text-xs font-bold text-secondary uppercase tracking-widest mb-3"
            for="kmStartAdmin"
          >
            Kilometraje Actual
          </label>
          <div
            class="flex items-center gap-3 bg-surface-hover rounded-2xl border border-border-default/60 px-6 py-3"
          >
            <input
              id="kmStartAdmin"
              type="number"
              formControlName="kmStart"
              max="999999"
              class="bg-transparent! border-none! outline-none! shadow-none! ring-0! text-5xl font-display font-black text-primary text-center p-0 w-36 placeholder:text-border-strong tracking-tighter tabular-nums m-0 focus:bg-transparent!"
              placeholder="0"
              data-llm-description="Odómetro inicial del vehículo para iniciar clase práctica"
            />
            <span class="text-2xl font-bold text-muted select-none mt-1">km</span>
          </div>
          @if (form.get('kmStart')?.invalid && form.get('kmStart')?.touched) {
            <div
              class="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error/10 text-error text-xs font-medium"
            >
              <app-icon name="alert-circle" [size]="13" />
              @if (form.get('kmStart')?.hasError('max')) {
                <span>El valor máximo es 999.999 km</span>
              } @else {
                <span>Ingrese un valor válido (mayor a 0)</span>
              }
            </div>
          } @else {
            <p class="text-xs text-muted mt-3 opacity-70">
              Verifique el panel del vehículo antes de arrancar.
            </p>
          }
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="btn-secondary flex-1"
            [disabled]="isSubmitting()"
            (click)="layoutDrawer.close()"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-primary flex-1 flex items-center justify-center gap-2"
            [disabled]="form.invalid || isSubmitting()"
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
        </div>
      </form>
    }
  `,
})
export class AdminIniciarClaseDrawerComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly fb = inject(FormBuilder);

  protected readonly isSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** ID del vehículo seleccionado en el dropdown (null = usa el de la sesión). */
  protected readonly selectedVehicleId = signal<number | null>(null);

  /** Objeto completo del vehículo seleccionado (para el ticket resumen). */
  protected readonly selectedVehicle = computed<VehicleOption | null>(() => {
    const id = this.selectedVehicleId();
    if (id === null) return null;
    return this.facade.vehiclesPorSede().find((v) => v.id === id) ?? null;
  });

  form!: FormGroup;

  ngOnInit(): void {
    const cls = this.facade.selectedPractica();
    const currentKm = cls?.vehicleCurrentKm ?? null;
    this.form = this.fb.group({
      kmStart: [currentKm, [Validators.required, Validators.min(1), Validators.max(999999)]],
    });

    if (cls?.branchId) {
      this.facade.loadVehiclesByBranch(cls.branchId).then(() => {
        // Pre-selecciona el vehículo actual de la sesión
        if (cls.vehicleId) this.selectedVehicleId.set(cls.vehicleId);
      });
    }
  }

  protected onVehicleChange(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
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
      this.layoutDrawer.open(
        AdminFinalizarClaseDrawerComponent,
        `Finalizar Clase — ${cls.alumnoName ?? 'Alumno'}`,
        'flag',
      );
    } catch {
      this.error.set('No se pudo iniciar la clase. Intenta de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
