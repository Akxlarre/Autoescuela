import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * AgregarServicioDrawerComponent — Formulario para crear un nuevo servicio en side-drawer (RF-037).
 */
@Component({
  selector: 'app-agregar-servicio-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-5 py-2">
      <form [formGroup]="servicioForm" (ngSubmit)="submitServicio()" class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="ns-nombre">
            Nombre del servicio <span class="text-state-error">*</span>
          </label>
          <input
            id="ns-nombre"
            type="text"
            formControlName="nombre"
            placeholder="Ej. Uso de Simulador"
            class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="ns-descripcion">
            Descripción <span class="text-state-error">*</span>
          </label>
          <textarea
            id="ns-descripcion"
            formControlName="descripcion"
            rows="4"
            placeholder="Describe brevemente en qué consiste el servicio..."
            class="w-full px-3 py-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all resize-none"
          ></textarea>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="ns-precio">
            Precio Base ($) <span class="text-state-error">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
            <input
              id="ns-precio"
              type="number"
              formControlName="precio"
              placeholder="Ej. 25000"
              class="w-full h-11 pl-7 pr-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            />
          </div>
        </div>

        <!-- Botones -->
        <div class="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="submit"
            class="flex-1 h-11 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand-hover active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-sm"
            [disabled]="servicioForm.invalid || isSaving()"
          >
            @if (isSaving()) {
              <div class="flex items-center justify-center gap-2">
                <app-icon name="loader-2" [size]="18" class="animate-spin" />
                Guardando...
              </div>
            } @else {
              Agregar al Catálogo
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
})
export class AgregarServicioDrawerComponent {
  protected readonly facade = inject(ServiciosEspecialesFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly isSaving = signal(false);

  protected readonly servicioForm = new FormGroup({
    nombre: new FormControl('', Validators.required),
    descripcion: new FormControl('', Validators.required),
    precio: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
  });

  protected async submitServicio(): Promise<void> {
    if (this.servicioForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    const val = this.servicioForm.value;
    
    const success = await this.facade.agregarServicio({
      nombre: val.nombre!,
      descripcion: val.descripcion!,
      precio: val.precio!,
    });

    this.isSaving.set(false);
    if (success) {
      this.drawer.close();
    }
  }
}
