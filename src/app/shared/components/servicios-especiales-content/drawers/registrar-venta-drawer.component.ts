import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { formatRut, autocompleteRutDv } from '@core/utils/rut.utils';

/**
 * RegistrarVentaDrawerComponent — Formulario de venta en side-drawer (RF-037).
 */
@Component({
  selector: 'app-registrar-venta-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IconComponent,
    SelectModule,
    DrawerFormComponent,
    StableWidthDirective,
  ],
  template: `
    <app-drawer-form>
      <form [formGroup]="ventaForm" (ngSubmit)="submitVenta()" class="flex flex-col gap-5">
        <!-- Servicio -->
        <div class="flex flex-col gap-1.5">
          <label class="micro-label" for="v-servicio">
            Servicio <span class="text-error">*</span>
          </label>
          <p-select
            id="v-servicio"
            formControlName="servicioId"
            [options]="catalogoOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccionar servicio..."
            styleClass="w-full"
          />
        </div>

        <!-- Nombre + RUT -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="micro-label" for="v-nombre">
              Nombre del cliente <span class="text-error">*</span>
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
            <label class="micro-label" for="v-rut"> RUT <span class="text-error">*</span> </label>
            <input
              id="v-rut"
              type="text"
              formControlName="rut"
              (input)="onRutInput($event)"
              (blur)="onRutBlur()"
              maxlength="12"
              placeholder="12.345.678-9"
              class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            />
          </div>
        </div>

        <!-- Tipo de cliente (condicional para psicotécnico/informe) -->
        @if (showTipoCliente()) {
          <div class="flex flex-col gap-1.5">
            <label class="micro-label" for="v-tipo"> Tipo de cliente </label>
            <p-select
              id="v-tipo"
              formControlName="esAlumno"
              [options]="esAlumnoOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
            />
          </div>
        }

        <!-- Fecha (fija a hoy, fix-023-i) + Monto -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <span class="micro-label">Fecha</span>
            <div
              class="w-full h-11 px-3 flex items-center text-sm rounded-xl border border-border-default bg-subtle text-text-secondary"
              data-llm-description="fecha de la venta — siempre hoy, no editable"
            >
              {{ hoyLabel }}
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="micro-label" for="v-precio">
              Monto ($) <span class="text-error">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
                >$</span
              >
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

        <!-- N° de boleta (fix-025-i, opcional) -->
        <div class="flex flex-col gap-1.5">
          <label class="micro-label" for="v-boleta">N° de boleta</label>
          <input
            id="v-boleta"
            type="text"
            formControlName="documentNumber"
            placeholder="Ej. 4582 (opcional)"
            data-llm-description="número de boleta emitida, opcional — se refleja en Caja Diaria"
            class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
          />
        </div>
      </form>

      <!-- Botones -->
      <ng-container ngProjectAs="[drawer-form-footer]">
        <button type="button" class="btn-secondary" (click)="drawer.close()">Cancelar</button>
        <button
          type="button"
          class="btn-primary flex items-center justify-center gap-2"
          [disabled]="ventaForm.invalid || isSaving()"
          [appStableWidth]="isSaving()"
          (click)="submitVenta()"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="18" class="animate-spin" />
            Registrando...
          } @else {
            Registrar Venta
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
  styles: [],
})
export class RegistrarVentaDrawerComponent {
  protected readonly facade = inject(ServiciosEspecialesFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  readonly esAlumnoOptions = [
    { label: 'Cliente externo', value: false },
    { label: 'Alumno de la escuela', value: true },
  ];

  readonly catalogoOptions = computed(() =>
    this.facade
      .catalogo()
      // fix-023-i: el catálogo ahora incluye inactivos (para el toggle "Mostrar
      // inactivos") — una venta nueva nunca debe poder elegir uno inactivo.
      .filter((s) => s.activo)
      .map((s) => ({
        label: `$${s.precio.toLocaleString('es-CL')} — ${s.nombre}`,
        value: s.id,
      })),
  );

  protected readonly isSaving = signal(false);
  protected readonly showTipoCliente = signal(false);

  // fix-023-i: la fecha ya no es un campo del formulario — se fija a hoy al enviar.
  protected readonly hoyLabel = new Date().toLocaleDateString('es-CL');

  protected readonly ventaForm = new FormGroup({
    servicioId: new FormControl('', Validators.required),
    nombre: new FormControl('', Validators.required),
    rut: new FormControl('', Validators.required),
    esAlumno: new FormControl<boolean>(false),
    precio: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    documentNumber: new FormControl<string>(''),
  });

  constructor() {
    this.ventaForm
      .get('servicioId')!
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe((id) => {
        if (!id) return;
        // Bug preexistente (hallado en QA de fix-025-i): p-select con optionValue="value"
        // entrega el id como number al seleccionarlo a mano, no como string — comparar con
        // String(s.id) === id fallaba siempre en ese caso (solo funcionaba cuando el prellenado
        // de este mismo fix pasaba explícitamente un string). Number() normaliza ambos casos.
        const servicio = this.facade.catalogo().find((s) => s.id === Number(id));
        if (servicio) {
          this.ventaForm.patchValue({ precio: servicio.precio }, { emitEvent: false });
          this.showTipoCliente.set(this.esPsicotecnicoOInforme(servicio.nombre));
        }
      });

    // fix-025-i: si el drawer se abrió desde la tarjeta "Vender" de un servicio específico,
    // prellena servicioId (dispara el valueChanges de arriba y autocompleta el precio).
    // fix-026-i: el valor debe ser number, no string — catalogoOptions usa optionValue="value"
    // con `value: s.id` (number); si se prellena con String(id) el precio igual se autocompleta
    // (el valueChanges normaliza con Number()) pero el p-select nunca encuentra el option que
    // hace match, así que el combobox se queda mostrando el placeholder en vez de la etiqueta.
    const preseleccionado = this.facade.selectedServicio();
    if (preseleccionado) {
      this.ventaForm.patchValue({ servicioId: preseleccionado.id as unknown as string });
    }
  }

  private esPsicotecnicoOInforme(nombre: string): boolean {
    const n = nombre.toLowerCase();
    return n.includes('psicot') || n.includes('informe');
  }

  protected onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatRut(input.value);
    this.ventaForm.get('rut')!.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  /** Al perder el foco: autocompleta el DV (módulo 11, ASG-047). */
  protected onRutBlur(): void {
    const control = this.ventaForm.get('rut')!;
    control.setValue(autocompleteRutDv(control.value ?? ''));
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
      fecha: new Date().toISOString().split('T')[0],
      precio: val.precio!,
      documentNumber: val.documentNumber?.trim() || null,
    });

    this.isSaving.set(false);
    if (success) {
      this.drawer.close();
    }
  }
}
