import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * RegistrarVentaDrawerComponent — Formulario de venta en side-drawer (RF-037).
 */
@Component({
  selector: 'app-registrar-venta-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-5 py-2">
      <form [formGroup]="ventaForm" (ngSubmit)="submitVenta()" class="flex flex-col gap-5">
        <!-- Servicio -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="v-servicio">
            Servicio <span class="text-state-error">*</span>
          </label>
          <select
            id="v-servicio"
            formControlName="servicioId"
            class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            style="focus-ring-color:var(--ds-brand)"
          >
            <option value="">Seleccionar servicio...</option>
            @for (s of facade.catalogo(); track s.id) {
              <option [value]="s.id">
                \${{ s.precio.toLocaleString('es-CL') }} — {{ s.nombre }}
              </option>
            }
          </select>
        </div>

        <!-- Nombre + RUT -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="v-nombre">
              Nombre del cliente <span class="text-state-error">*</span>
            </label>
            <input
              id="v-nombre"
              type="text"
              formControlName="nombre"
              placeholder="Ej. Juan Pérez"
              class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="v-rut">
              RUT <span class="text-state-error">*</span>
            </label>
            <input
              id="v-rut"
              type="text"
              formControlName="rut"
              placeholder="12.345.678-9"
              class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            />
          </div>
        </div>

        <!-- Tipo de cliente (condicional para psicotécnico/informe) -->
        @if (showTipoCliente()) {
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="v-tipo">
              Tipo de cliente
            </label>
            <select
              id="v-tipo"
              formControlName="esAlumno"
              class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            >
              <option [value]="false">Cliente externo</option>
              <option [value]="true">Alumno de la escuela</option>
            </select>
          </div>
        }

        <!-- Fecha + Monto -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="v-fecha">
              Fecha <span class="text-state-error">*</span>
            </label>
            <input
              id="v-fecha"
              type="date"
              formControlName="fecha"
              class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="v-precio">
              Monto ($) <span class="text-state-error">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
              <input
                id="v-precio"
                type="number"
                formControlName="precio"
                placeholder="40000"
                class="w-full h-11 pl-7 pr-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Cobrado al registrar -->
        <label class="flex items-center gap-3 p-4 rounded-xl border border-border-default cursor-pointer hover:bg-bg-subtle transition-colors">
          <input type="checkbox" formControlName="cobrado" class="w-4 h-4 rounded text-brand focus:ring-brand" />
          <div class="flex flex-col">
            <span class="text-sm font-medium text-text-primary">Registrar como ya cobrado</span>
            <span class="text-xs text-text-muted">Se marcará la venta como "Pagada" inmediatamente</span>
          </div>
        </label>

        <!-- Botones -->
        <div class="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="submit"
            class="flex-1 h-11 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand-hover active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-sm"
            [disabled]="ventaForm.invalid || isSaving()"
          >
            @if (isSaving()) {
              <div class="flex items-center justify-center gap-2">
                <app-icon name="loader-2" [size]="18" class="animate-spin" />
                Registrando...
              </div>
            } @else {
              Registrar Venta
            }
          </button>
          <button
            type="button"
            class="h-11 px-6 text-sm font-semibold rounded-xl border border-border-default text-text-secondary hover:bg-bg-subtle active:scale-95 transition-all"
            (click)="drawer.close()"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    input[type="date"]::-webkit-calendar-picker-indicator {
      filter: var(--calendar-icon-filter, invert(0.5));
    }
  `]
})
export class RegistrarVentaDrawerComponent {
  protected readonly facade = inject(ServiciosEspecialesFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly isSaving = signal(false);
  protected readonly showTipoCliente = signal(false);

  protected readonly ventaForm = new FormGroup({
    servicioId: new FormControl('', Validators.required),
    nombre: new FormControl('', Validators.required),
    rut: new FormControl('', Validators.required),
    esAlumno: new FormControl<boolean>(false),
    fecha: new FormControl(new Date().toISOString().split('T')[0], Validators.required),
    precio: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    cobrado: new FormControl<boolean>(false),
  });

  constructor() {
    this.ventaForm.get('servicioId')!.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(idStr => {
        if (!idStr) return;
        const servicio = this.facade.catalogo().find(s => String(s.id) === idStr);
        if (servicio) {
          this.ventaForm.patchValue({ precio: servicio.precio }, { emitEvent: false });
          this.showTipoCliente.set(this.esPsicotecnicoOInforme(servicio.nombre));
        }
      });
  }

  private esPsicotecnicoOInforme(nombre: string): boolean {
    const n = nombre.toLowerCase();
    return n.includes('psicot') || n.includes('informe');
  }

  protected async submitVenta(): Promise<void> {
    if (this.ventaForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    const val = this.ventaForm.value;
    
    const success = await this.facade.registrarVenta({
      servicioId: Number(val.servicioId),
      nombre: val.nombre!,
      rut: val.rut!,
      esAlumno: !!val.esAlumno,
      fecha: val.fecha!,
      precio: val.precio!,
      cobrado: !!val.cobrado,
    });

    this.isSaving.set(false);
    if (success) {
      this.drawer.close();
    }
  }
}
