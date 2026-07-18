import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';

@Component({
  selector: 'app-admin-curso-singular-crear-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconComponent,
    SelectModule,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
    DateInputComponent,
  ],
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-4">
            <!-- Nombre del curso -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="35%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="40px" />
            </div>
            <!-- Tipo + Facturación -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="40%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="55%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
            </div>
            <!-- Precio + Duración -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="45%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="50%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
            </div>
            <!-- Cupos + Fecha inicio -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="40%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="45%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
            </div>
          </div>
        </ng-template>
        <ng-template #content>
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
                <p class="text-xs text-error">El nombre es requerido (mín. 3 caps).</p>
              }
            </div>

            <!-- Tipo + Facturación -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Tipo *
                </label>
                <p-select
                  formControlName="tipo"
                  [options]="tipoOptions"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Facturación *
                </label>
                <p-select
                  formControlName="billingType"
                  [options]="billingTypeOptions"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full"
                />
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
                  <p class="text-xs text-error">Ingrese un precio válido.</p>
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

            <!-- Sede (solo admin: secretarias quedan ancladas a la suya) -->
            @if (isAdmin()) {
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Sede *
                </label>
                <p-select
                  formControlName="branchId"
                  [options]="branchOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Selecciona la sede"
                  styleClass="w-full"
                  data-llm-description="Sede a la que pertenece el curso singular"
                />
                @if (form.controls['branchId'].invalid && form.controls['branchId'].touched) {
                  <p class="text-xs text-state-error">
                    El curso debe pertenecer a una sede específica.
                  </p>
                }
              </div>
            }

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
                <app-date-input
                  label="Fecha inicio"
                  [required]="true"
                  [value]="form.controls['inicio'].value ?? ''"
                  (valueChange)="
                    form.controls['inicio'].setValue($event);
                    form.controls['inicio'].markAsTouched()
                  "
                />
                @if (form.controls['inicio'].invalid && form.controls['inicio'].touched) {
                  <p class="text-xs text-error">La fecha es requerida.</p>
                }
              </div>
            </div>

            <!-- Error global -->
            @if (facade.error()) {
              <div
                class="p-3 rounded-lg bg-error-subtle text-error text-xs flex items-center gap-2"
              >
                <app-icon name="alert-circle" [size]="14" />
                <span>{{ facade.error() }}</span>
              </div>
            }
          </form>
        </ng-template>
      </app-drawer-content-loader>

      <!-- Botones de Acción -->
      <ng-container ngProjectAs="[drawer-form-footer]">
        <button type="button" class="btn-secondary" (click)="onCancelar()">Cancelar</button>
        <button
          type="button"
          class="btn-primary flex items-center gap-2"
          [disabled]="form.invalid || facade.isSaving()"
          (click)="onGuardar()"
        >
          @if (facade.isSaving()) {
            <app-icon name="loader-2" [size]="18" class="animate-spin" />
            <span>Guardando...</span>
          } @else {
            <app-icon name="check" [size]="18" />
            <span>Crear curso singular</span>
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class AdminCursoSingularCrearDrawerComponent {
  readonly tipoOptions = [
    { label: 'SENCE', value: 'sence' },
    { label: 'Particular', value: 'particular' },
  ];

  readonly billingTypeOptions = [
    { label: 'Franquicia SENCE', value: 'sence_franchise' },
    { label: 'Boleta', value: 'boleta' },
    { label: 'Factura', value: 'factura' },
  ];

  protected readonly facade = inject(CursosSingularesFacade);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  protected readonly branchOptions = computed(() =>
    this.branchFacade.branches().map((b) => ({ label: b.name, value: b.id })),
  );

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
    // Admin: pre-carga la sede activa del topbar (null en "Todas" → debe elegir).
    // Secretaria: anclada a su sede, sin selector visible.
    branchId: new FormControl<number | null>(this.resolveInitialBranchId(), Validators.required),
  });

  private resolveInitialBranchId(): number | null {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') return this.branchFacade.selectedBranchId();
    return user?.branchId ?? null;
  }

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
      branchId: v.branchId!,
    });
    if (ok) this.layoutDrawer.close();
  }

  protected onCancelar(): void {
    this.layoutDrawer.close();
  }
}
