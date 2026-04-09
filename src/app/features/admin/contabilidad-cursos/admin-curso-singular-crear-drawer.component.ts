import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-admin-curso-singular-crear-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  template: `
    <div class="p-6 space-y-6">
      <form [formGroup]="form" (ngSubmit)="onGuardar()" class="space-y-4">
        <!-- Nombre -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Nombre del curso *
          </label>
          <input
            formControlName="nombre"
            type="text"
            class="h-10 px-3 text-sm rounded-lg border w-full bg-base text-text-primary border-border-subtle focus:border-brand transition-colors"
            placeholder="Ej: Operador de Grúa Horquilla"
          />
          @if (form.controls['nombre'].invalid && form.controls['nombre'].touched) {
            <p class="text-xs text-state-error">El nombre es requerido (mín. 3 caps).</p>
          }
        </div>

        <!-- Tipo + Facturación -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Tipo *
            </label>
            <select
              formControlName="tipo"
              class="h-10 px-3 text-sm rounded-lg border bg-base text-text-primary border-border-subtle focus:border-brand"
            >
              <option value="sence">SENCE</option>
              <option value="particular">Particular</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Facturación *
            </label>
            <select
              formControlName="billingType"
              class="h-10 px-3 text-sm rounded-lg border bg-base text-text-primary border-border-subtle focus:border-brand"
            >
              <option value="sence_franchise">Franquicia SENCE</option>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
            </select>
          </div>
        </div>

        <!-- Precio + Duración -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Precio (CLP) *
            </label>
            <input
              formControlName="precio"
              type="number"
              min="0"
              class="h-10 px-3 text-sm rounded-lg border w-full bg-base text-text-primary border-border-subtle focus:border-brand"
              placeholder="280000"
            />
            @if (form.controls['precio'].invalid && form.controls['precio'].touched) {
              <p class="text-xs text-state-error">Ingrese un precio válido.</p>
            }
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Duración (hrs) *
            </label>
            <input
              formControlName="duracionHoras"
              type="number"
              min="1"
              class="h-10 px-3 text-sm rounded-lg border w-full bg-base text-text-primary border-border-subtle focus:border-brand"
              placeholder="40"
            />
          </div>
        </div>

        <!-- Cupos + Fecha inicio -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Cupos máx. *
            </label>
            <input
              formControlName="cupos"
              type="number"
              min="1"
              class="h-10 px-3 text-sm rounded-lg border w-full bg-base text-text-primary border-border-subtle focus:border-brand"
              placeholder="12"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Fecha inicio *
            </label>
            <input
              formControlName="inicio"
              type="date"
              class="h-10 px-3 text-sm rounded-lg border w-full bg-base text-text-primary border-border-subtle focus:border-brand"
            />
            @if (form.controls['inicio'].invalid && form.controls['inicio'].touched) {
              <p class="text-xs text-state-error">La fecha es requerida.</p>
            }
          </div>
        </div>

        <!-- Error global -->
        @if (facade.error()) {
          <div class="p-3 rounded-lg bg-state-error-subtle text-state-error text-xs flex items-center gap-2">
            <app-icon name="alert-circle" [size]="14" />
            <span>{{ facade.error() }}</span>
          </div>
        }

        <!-- Botones de Acción -->
        <div class="flex flex-col pt-4 gap-3">
          <button
            type="submit"
            class="h-11 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            [disabled]="form.invalid || facade.isSaving()"
          >
            @if (facade.isSaving()) {
              <app-icon name="loader-2" [size]="18" class="animate-spin" />
              <span>Guardando...</span>
            } @else {
              <app-icon name="check" [size]="18" />
              <span>Crear curso singular</span>
            }
          </button>
          
          <button
            type="button"
            (click)="onCancelar()"
            class="h-11 rounded-xl bg-elevated text-text-secondary font-semibold hover:bg-subtle transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  `,
})
export class AdminCursoSingularCrearDrawerComponent {
  protected readonly facade = inject(CursosSingularesFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly form = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(3)]),
    tipo: new FormControl<'sence' | 'particular'>('sence', Validators.required),
    billingType: new FormControl<'sence_franchise' | 'boleta' | 'factura'>(
      'sence_franchise',
      Validators.required,
    ),
    precio: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    duracionHoras: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    cupos: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    inicio: new FormControl('', Validators.required),
  });

  protected async onGuardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const ok = await this.facade.crearCurso({
      nombre: v.nombre!,
      tipo: v.tipo!,
      billingType: v.billingType!,
      precio: v.precio!,
      duracionHoras: v.duracionHoras!,
      cupos: v.cupos!,
      inicio: v.inicio!,
    });
    if (ok) this.layoutDrawer.close();
  }

  protected onCancelar(): void {
    this.layoutDrawer.close();
  }
}
