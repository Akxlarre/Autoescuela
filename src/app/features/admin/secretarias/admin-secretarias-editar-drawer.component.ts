import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SecretariasFacade } from '@core/facades/secretarias.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-admin-secretarias-editar-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    FormsModule,
    SelectModule,
    IconComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    @if (facade.selectedSecretaria(); as sec) {
      <app-drawer-form>
        <app-drawer-content-loader class="flex-col h-full flex p-5 pb-0">
          <ng-template #skeletons>
            <div class="flex flex-col gap-4 w-full">
              <!-- Mini-header: avatar + nombre + email -->
              <div class="flex items-center gap-3 rounded-lg p-3 mb-1">
                <app-skeleton-block variant="circle" width="36px" height="36px" />
                <div class="flex flex-col gap-1.5 flex-1">
                  <app-skeleton-block variant="text" width="45%" height="14px" />
                  <app-skeleton-block variant="text" width="65%" height="12px" />
                </div>
              </div>

              <!-- Título de sección -->
              <app-skeleton-block variant="text" width="140px" height="14px" />

              <div class="flex flex-col gap-4">
                <!-- Nombres -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="35%" height="13px" />
                  <app-skeleton-block variant="rect" width="100%" height="38px" />
                </div>
                <!-- Apellido Paterno -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="60%" height="13px" />
                  <app-skeleton-block variant="rect" width="100%" height="38px" />
                </div>
                <!-- Apellido Materno -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="60%" height="13px" />
                  <app-skeleton-block variant="rect" width="100%" height="38px" />
                </div>
                <!-- Sede -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="40%" height="13px" />
                  <app-skeleton-block variant="rect" width="100%" height="38px" />
                </div>
                <!-- Email -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="45%" height="13px" />
                  <app-skeleton-block variant="rect" width="100%" height="38px" />
                </div>
                <!-- Teléfono -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="25%" height="13px" />
                  <app-skeleton-block variant="rect" width="100%" height="38px" />
                </div>
                <!-- Estado activo/inactivo (toggle de 2 botones) -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="35%" height="13px" />
                  <div class="flex items-center gap-3">
                    <app-skeleton-block variant="rect" width="100%" height="34px" />
                    <app-skeleton-block variant="rect" width="100%" height="34px" />
                  </div>
                </div>
                <!-- Acceso a sedes (toggle de 2 botones) -->
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="35%" height="13px" />
                  <div class="flex items-center gap-3">
                    <app-skeleton-block variant="rect" width="100%" height="34px" />
                    <app-skeleton-block variant="rect" width="100%" height="34px" />
                  </div>
                </div>
              </div>
            </div>
          </ng-template>
          <ng-template #content>
            <!-- Mini-header con la secretaria que se está editando -->
            <div
              class="flex items-center gap-3 rounded-lg p-3 mb-5 bg-elevated border border-border-subtle"
            >
              <div
                class="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-sm font-bold bg-brand-tint text-brand"
              >
                {{ sec.initials }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate text-text-primary">
                  {{ sec.nombre }}
                </p>
                <p
                  class="text-xs truncate text-text-muted"
                  [pTooltip]="sec.email"
                  tooltipPosition="top"
                >
                  {{ sec.email }}
                </p>
              </div>
            </div>

            <!-- Campos editables -->
            <h3 class="section-title">Datos Personales</h3>
            <div class="flex flex-col gap-4">
              <!-- Nombres -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-nombres">Nombres *</label>
                <input
                  id="e-nombres"
                  type="text"
                  class="field-input"
                  [class.field-input--error]="nombresTouched() && !nombresValido()"
                  placeholder="María"
                  [ngModel]="nombres()"
                  (ngModelChange)="nombres.set($event)"
                  (blur)="nombresTouched.set(true)"
                  data-llm-description="Nombres de la secretaria a editar"
                  aria-required="true"
                />
                @if (nombresTouched() && !nombresValido()) {
                  <span class="field-error">Ingresa el nombre (mínimo 2 caracteres)</span>
                }
              </div>

              <!-- Apellido Paterno -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-paterno">Apellido Paterno *</label>
                <input
                  id="e-paterno"
                  type="text"
                  class="field-input"
                  [class.field-input--error]="paternoTouched() && !paternoValido()"
                  placeholder="González"
                  [ngModel]="paterno()"
                  (ngModelChange)="paterno.set($event)"
                  (blur)="paternoTouched.set(true)"
                  data-llm-description="Apellido paterno de la secretaria a editar"
                  aria-required="true"
                />
                @if (paternoTouched() && !paternoValido()) {
                  <span class="field-error">Ingresa el apellido paterno (mínimo 2 caracteres)</span>
                }
              </div>

              <!-- Apellido Materno -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-materno">Apellido Materno *</label>
                <input
                  id="e-materno"
                  type="text"
                  class="field-input"
                  [class.field-input--error]="maternoTouched() && !maternoValido()"
                  placeholder="Pérez"
                  [ngModel]="materno()"
                  (ngModelChange)="materno.set($event)"
                  (blur)="maternoTouched.set(true)"
                  data-llm-description="Apellido materno de la secretaria a editar"
                  aria-required="true"
                />
                @if (maternoTouched() && !maternoValido()) {
                  <span class="field-error">Ingresa el apellido materno (mínimo 2 caracteres)</span>
                }
              </div>

              <!-- Sede -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-sede">Sede asignada *</label>
                <p-select
                  inputId="e-sede"
                  [options]="sedeOptions()"
                  [(ngModel)]="sedeIdModel"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleccione sede"
                  styleClass="w-full"
                  aria-required="true"
                  data-llm-description="Sede de trabajo asignada a la secretaria"
                />
                @if (sedeTouched() && !sedeValida()) {
                  <span class="field-error">Selecciona una sede.</span>
                }
              </div>

              <!-- Email -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-email">Correo electrónico *</label>
                <input
                  id="e-email"
                  type="email"
                  class="field-input"
                  [class.field-input--error]="emailTouched() && !emailValido()"
                  placeholder="maria@escuela.cl"
                  [ngModel]="email()"
                  (ngModelChange)="email.set($event)"
                  (blur)="emailTouched.set(true)"
                  data-llm-description="Correo electrónico de acceso de la secretaria"
                  aria-required="true"
                />
                @if (emailTouched() && !emailValido()) {
                  <span class="field-error">Ingresa un correo electrónico válido.</span>
                }
                @if (email() !== currentEmail && emailValido()) {
                  <span class="text-xs" style="color: var(--state-warning, #f59e0b);">
                    Se enviará confirmación al nuevo correo. El cambio es inmediato.
                  </span>
                }
              </div>

              <!-- Teléfono -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-telefono">Teléfono</label>
                <input
                  id="e-telefono"
                  type="tel"
                  class="field-input"
                  placeholder="+56 9 1234 5678"
                  [ngModel]="telefono()"
                  (ngModelChange)="telefono.set($event)"
                  data-llm-description="Teléfono de contacto de la secretaria"
                />
              </div>

              <!-- Estado activo/inactivo -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label">Estado de la cuenta</label>
                <div class="flex items-center gap-3">
                  <button
                    class="estado-btn"
                    [class.estado-btn--active]="activo()"
                    (click)="activo.set(true)"
                    data-llm-action="activar-secretaria"
                  >
                    <app-icon name="check-circle" [size]="14" />
                    Activa
                  </button>
                  <button
                    class="estado-btn"
                    [class.estado-btn--inactive]="!activo()"
                    (click)="activo.set(false)"
                    data-llm-action="desactivar-secretaria"
                  >
                    <app-icon name="circle" [size]="14" />
                    Inactiva
                  </button>
                </div>
                @if (!activo()) {
                  <p class="text-xs text-text-muted">
                    La secretaria no podrá iniciar sesión mientras esté inactiva.
                  </p>
                }
              </div>

              <!-- Acceso a sedes — grant multi-sede (spec 0017) -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label">Acceso a sedes</label>
                <div class="flex items-center gap-3">
                  <button
                    class="estado-btn"
                    [class.estado-btn--inactive]="!verTodasLasSedes()"
                    (click)="verTodasLasSedes.set(false)"
                    data-llm-action="toggle-secretary-all-branches-grant"
                  >
                    <app-icon name="map-pin" [size]="14" />
                    Solo su sede
                  </button>
                  <button
                    class="estado-btn"
                    [class.estado-btn--grant]="verTodasLasSedes()"
                    (click)="verTodasLasSedes.set(true)"
                    data-llm-action="toggle-secretary-all-branches-grant"
                  >
                    <app-icon name="building-2" [size]="14" />
                    Todas las sedes
                  </button>
                </div>
                @if (verTodasLasSedes()) {
                  <p class="text-xs text-text-muted">
                    Podrá ver y operar en todas las sedes desde el selector del encabezado, igual
                    que un administrador.
                  </p>
                }
              </div>
            </div>
          </ng-template>
        </app-drawer-content-loader>

        <ng-container ngProjectAs="[drawer-form-footer]">
          <button
            class="btn-secondary"
            (click)="layoutDrawer.close()"
            data-llm-action="cancelar-editar-secretaria"
          >
            Cancelar
          </button>
          <button
            class="btn-primary flex items-center gap-2"
            [disabled]="facade.isSubmitting()"
            (click)="submit(sec.id)"
            data-llm-action="guardar-editar-secretaria"
            aria-label="Guardar cambios de secretaria"
          >
            @if (facade.isSubmitting()) {
              <app-icon name="loader-2" [size]="15" class="animate-spin" />
              Guardando...
            } @else {
              <app-icon name="save" [size]="15" />
              Guardar cambios
            }
          </button>
        </ng-container>
      </app-drawer-form>
    }
  `,
  styles: `
    .section-title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .field-label {
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--text-primary);
    }

    .field-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
      transition:
        border-color var(--duration-fast),
        box-shadow var(--duration-fast);
      box-sizing: border-box;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }
    .field-input::placeholder {
      color: var(--text-muted);
    }
    .field-input--error {
      border-color: var(--state-error, #ef4444);
    }

    .field-error {
      font-size: 12px;
      color: var(--state-error, #ef4444);
    }

    .estado-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 0;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: transparent;
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .estado-btn--active {
      border-color: var(--state-success);
      background: color-mix(in srgb, var(--state-success) 10%, transparent);
      color: var(--state-success);
    }
    .estado-btn--inactive {
      border-color: var(--border-strong, var(--text-muted));
      background: var(--bg-elevated);
      color: var(--text-secondary);
    }
    .estado-btn--grant {
      border-color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 10%, transparent);
      color: var(--ds-brand);
    }
  `,
})
export class AdminSecretariasEditarDrawerComponent implements OnInit {
  protected readonly facade = inject(SecretariasFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Campos ─────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly sedeId = signal<number | null>(null);
  protected readonly activo = signal(true);
  protected readonly verTodasLasSedes = signal(false);

  // Email original para detectar cambios
  protected currentEmail = '';

  // ── Touched ────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly maternoTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly sedeTouched = signal(false);

  // ── Validaciones ───────────────────────────────────────────────────────────
  protected readonly nombresValido = computed(() => this.nombres().trim().length >= 2);
  protected readonly paternoValido = computed(() => this.paterno().trim().length >= 2);
  protected readonly maternoValido = computed(() => this.materno().trim().length >= 2);
  protected readonly emailValido = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()),
  );
  protected readonly sedeValida = computed(() => this.sedeId() !== null);
  protected readonly formValido = computed(
    () =>
      this.nombresValido() &&
      this.paternoValido() &&
      this.maternoValido() &&
      this.emailValido() &&
      this.sedeValida(),
  );

  // ── Opciones p-select ──────────────────────────────────────────────────────
  protected readonly sedeOptions = computed(() =>
    this.facade.branches().map((b) => ({ label: b.name, value: b.id })),
  );

  protected get sedeIdModel(): number | null {
    return this.sedeId();
  }
  protected set sedeIdModel(v: number | null) {
    this.sedeId.set(v);
    this.sedeTouched.set(true);
  }

  constructor() {
    // Pre-rellenar campos cuando cambia la secretaria seleccionada
    effect(() => {
      const sec = this.facade.selectedSecretaria();
      if (sec) {
        this.nombres.set(sec.firstName);
        this.paterno.set(sec.paternalLastName);
        this.materno.set(sec.maternalLastName);
        this.email.set(sec.email);
        this.currentEmail = sec.email;
        this.telefono.set(sec.phone);
        this.sedeId.set(sec.branchId);
        this.activo.set(sec.estado === 'activa');
        this.verTodasLasSedes.set(sec.canAccessBothBranches);
        this.nombresTouched.set(false);
        this.paternoTouched.set(false);
        this.maternoTouched.set(false);
        this.emailTouched.set(false);
        this.sedeTouched.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadBranches();
  }

  protected async submit(id: number): Promise<void> {
    this.nombresTouched.set(true);
    this.paternoTouched.set(true);
    this.maternoTouched.set(true);
    this.emailTouched.set(true);
    this.sedeTouched.set(true);

    if (!this.formValido()) return;

    const ok = await this.facade.editarSecretaria(id, {
      firstNames: this.nombres().trim(),
      paternalLastName: this.paterno().trim(),
      maternalLastName: this.materno().trim(),
      phone: this.telefono(),
      branchId: this.sedeId()!,
      active: this.activo(),
      email: this.email().trim().toLowerCase(),
      currentEmail: this.currentEmail,
      canAccessBothBranches: this.verTodasLasSedes(),
    });

    if (ok) {
      this.layoutDrawer.close();
      this.facade.initialize(); // Refresh table
    }
  }
}
