import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

/**
 * EditarServicioDrawerComponent — Editar nombre/precio/estado de un servicio existente
 * (fix-240-m). Antes solo existían altas (`app-agregar-servicio-drawer`) y bajas
 * (`borrarServicio`/`reactivarServicio`) — no había forma de corregir un servicio ya creado.
 * Self-sufficient (mismo espíritu que `HistorialVentasDrawerComponent`): inyecta
 * `ServiciosEspecialesFacade` directo, precarga desde `facade.servicioAEditar()`.
 */
@Component({
  selector: 'app-editar-servicio-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SelectModule,
    IconComponent,
    DrawerFormComponent,
    StableWidthDirective,
  ],
  template: `
    <app-drawer-form>
      <form [formGroup]="servicioForm" (ngSubmit)="submitServicio()" class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label class="micro-label" for="es-nombre">
            Nombre del servicio <span class="text-error">*</span>
          </label>
          <input
            id="es-nombre"
            type="text"
            formControlName="nombre"
            placeholder="Ej. Uso de Simulador"
            class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            data-llm-description="input for the special service name"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="micro-label" for="es-precio">
            Precio Base ($) <span class="text-error">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
            <input
              id="es-precio"
              type="number"
              formControlName="precio"
              placeholder="Ej. 25000"
              class="w-full h-11 pl-7 pr-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
              data-llm-description="input for the special service base price"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="micro-label" for="es-estado">Estado</label>
          <p-select
            id="es-estado"
            formControlName="activo"
            [options]="estadoOptions"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
            appendTo="body"
            data-llm-description="input for the special service active status"
          />
        </div>
      </form>

      <!-- Botones -->
      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-secondary"
          (click)="drawer.close()"
          data-llm-action="cancelar-editar-servicio-especial"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex items-center justify-center gap-2"
          [disabled]="servicioForm.invalid || isSaving()"
          [appStableWidth]="isSaving()"
          (click)="submitServicio()"
          data-llm-action="guardar-editar-servicio-especial"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="18" class="animate-spin" />
            Guardando...
          } @else {
            Guardar Cambios
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class EditarServicioDrawerComponent {
  protected readonly facade = inject(ServiciosEspecialesFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly isSaving = signal(false);

  readonly estadoOptions = [
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false },
  ];

  private readonly servicio = this.facade.servicioAEditar();

  protected readonly servicioForm = new FormGroup({
    nombre: new FormControl(this.servicio?.nombre ?? '', Validators.required),
    precio: new FormControl<number>(this.servicio?.precio ?? 0, [
      Validators.required,
      Validators.min(1),
    ]),
    activo: new FormControl<boolean>(this.servicio?.activo ?? true, { nonNullable: true }),
  });

  protected async submitServicio(): Promise<void> {
    if (this.servicioForm.invalid || this.isSaving() || !this.servicio) return;

    this.isSaving.set(true);
    const val = this.servicioForm.value;

    const success = await this.facade.editarServicio(this.servicio.id, {
      nombre: val.nombre!,
      precio: val.precio!,
      activo: val.activo!,
    });

    this.isSaving.set(false);
    if (success) {
      this.drawer.close();
    }
  }
}
