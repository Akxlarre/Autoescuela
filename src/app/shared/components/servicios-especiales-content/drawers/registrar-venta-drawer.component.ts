import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatDayMonthYear, todayIso } from '@core/utils/date.utils';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { formatRutTyping, completeRutDv } from '@core/utils/rut.utils';
import type { AlumnoVinculado } from '@core/models/ui/servicios-especiales.model';
import { montoEntero } from '@core/utils/servicios-especiales.utils';

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

        <!-- Sede (admin / multi-sede): sin ella la venta quedaba fuera de toda Caja (fix-194-b) -->
        @if (facade.requiereElegirSede()) {
          <div class="flex flex-col gap-1.5">
            <label class="micro-label" for="v-sede"> Sede <span class="text-error">*</span> </label>
            <p-select
              inputId="v-sede"
              formControlName="branchId"
              [options]="facade.sedeOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar sede..."
              styleClass="w-full"
              data-llm-description="Sede a la que se imputa la venta (Caja Diaria y reportes)"
            />
          </div>
        }

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
              data-llm-description="RUT del cliente; si es de un alumno, la venta se vincula a su ficha"
            />
            <!-- fix-438-m: la venta a un alumno se vincula sola por su RUT -->
            @if (alumnoVinculado(); as alumno) {
              <span class="flex items-center gap-1.5 text-xs text-text-secondary">
                <app-icon name="user-check" [size]="14" />
                Se vinculará a la ficha de {{ alumno.nombre }}
              </span>
            }
          </div>
        </div>

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
            <!-- hotfix-158-m: las columnas de monto son enteras -->
            @if (ventaForm.controls.precio.hasError('montoEntero')) {
              <span class="text-xs text-error">Ingresa el monto en pesos, sin decimales.</span>
            }
          </div>
        </div>

        <!-- Medio de pago (fix-047-i): decide la columna en la Caja Diaria; efectivo entra al arqueo -->
        <div class="flex flex-col gap-1.5">
          <label class="micro-label" for="v-medio-pago">
            Medio de pago <span class="text-error">*</span>
          </label>
          <p-select
            inputId="v-medio-pago"
            formControlName="paymentMethod"
            [options]="medioPagoOptions"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
            data-llm-description="Medio con el que el cliente pagó la venta: decide la columna en Caja Diaria y si entra al arqueo de efectivo"
          />
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
  private readonly toast = inject(ToastService);

  /** Mismas opciones que el egreso de Caja (registrar-egreso-drawer), fix-047-i. */
  readonly medioPagoOptions = [
    { label: 'Efectivo', value: 'efectivo' },
    { label: 'Transferencia', value: 'transferencia' },
    { label: 'Tarjeta', value: 'tarjeta' },
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
  /** fix-438-m: alumno con el RUT escrito (null = cliente externo). */
  protected readonly alumnoVinculado = signal<AlumnoVinculado | null>(null);

  // fix-023-i: la fecha ya no es un campo del formulario — se fija a hoy al enviar.
  protected readonly hoyLabel = formatDayMonthYear(todayIso());

  protected readonly ventaForm = new FormGroup({
    servicioId: new FormControl('', Validators.required),
    nombre: new FormControl('', Validators.required),
    rut: new FormControl('', Validators.required),
    precio: new FormControl<number>(0, [Validators.required, Validators.min(1), montoEntero]),
    documentNumber: new FormControl<string>(''),
    branchId: new FormControl<number | null>(null),
    paymentMethod: new FormControl<'efectivo' | 'transferencia' | 'tarjeta'>('efectivo', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });

  constructor() {
    // fix-194-b: el admin elige la sede (precargada con la del topbar, si hay una).
    if (this.facade.requiereElegirSede()) {
      const branchId = this.ventaForm.controls.branchId;
      branchId.setValidators(Validators.required);
      branchId.setValue(this.facade.sedePorDefecto());
    }

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

  protected onRutInput(event: Event): void {
    this.alumnoVinculado.set(null);
    const input = event.target as HTMLInputElement;
    const formatted = formatRutTyping(input.value);
    this.ventaForm.get('rut')!.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  /** Al perder el foco: completa el DV solo si falta (ASG-047, fix-213-b). */
  protected async onRutBlur(): Promise<void> {
    const control = this.ventaForm.get('rut')!;
    control.setValue(completeRutDv(control.value ?? ''));
    const rut = control.value ?? '';
    const alumno = await this.facade.buscarAlumnoPorRut(rut);
    // Si se siguió escribiendo mientras se buscaba, el aviso ya no corresponde.
    if (control.value === rut) this.alumnoVinculado.set(alumno);
  }

  protected async submitVenta(): Promise<void> {
    if (this.ventaForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    const val = this.ventaForm.value;

    const success = await this.facade.registrarVenta({
      servicioId: Number(val.servicioId),
      nombre: val.nombre!,
      rut: val.rut!,
      fecha: todayIso(),
      precio: val.precio!,
      documentNumber: val.documentNumber?.trim() || null,
      branchId: val.branchId ?? null,
      paymentMethod: val.paymentMethod ?? 'efectivo',
    });

    this.isSaving.set(false);
    // fix-435-m: confirmar la venta (decisión H05) y nunca fallar en silencio.
    if (success) {
      this.toast.success('Venta registrada');
      this.drawer.close();
    } else {
      this.toast.error('No se pudo registrar la venta', this.facade.error() ?? undefined);
    }
  }
}
