import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { LowerCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-instructor-clase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LowerCasePipe,
    ReactiveFormsModule,
    TagModule,
    IconComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="px-6 py-6 pb-20 max-w-3xl mx-auto space-y-6">
      <!-- Breadcrumb simple -->
      <div class="flex items-center gap-2 text-sm text-text-muted">
        <a
          routerLink="/app/instructor/dashboard"
          class="hover:text-text-primary flex items-center gap-1"
        >
          <app-icon name="arrow-left" [size]="14" />
          Dashboard
        </a>
        <span>/</span>
        <span class="text-text-primary font-medium">Iniciar Clase</span>
      </div>

      <div>
        <h1 class="text-2xl font-bold text-text-primary">Iniciar Clase</h1>
        <p class="text-sm text-text-muted mt-1">Registra el kilometraje inicial para comenzar</p>
      </div>

      @if (clasesFacade.isLoading()) {
        <div class="flex justify-center p-12">
          <app-icon
            name="loader-2"
            [size]="32"
            style="color: var(--color-primary)"
            class="animate-spin"
          />
        </div>
      } @else if (clasesFacade.error()) {
        <div
          class="card p-4 flex items-start gap-3"
          style="background: var(--state-error-bg); color: var(--state-error)"
        >
          <app-icon name="alert-circle" [size]="20" class="mt-0.5 shrink-0" />
          <p class="text-sm">{{ clasesFacade.error() }}</p>
        </div>
      } @else if (clasesFacade.selectedClass(); as cls) {
        <!-- Resumen de Clase -->
        <div class="card p-6">
          <div class="flex items-center gap-4 mb-4">
            <div
              class="w-12 h-12 rounded-full bg-brand-muted flex flex-col items-center justify-center shrink-0"
            >
              <span class="text-xs font-medium text-text-muted">Práctica</span>
              <span class="text-lg font-bold text-brand-primary">{{ cls.classNumber }}</span>
            </div>
            <div class="flex-1">
              <h2 class="text-lg font-bold text-text-primary">{{ cls.studentName }}</h2>
              <p class="text-sm text-text-muted mt-0.5">RUT: {{ cls.studentRut }}</p>
            </div>
            <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" />
          </div>

          <div class="grid grid-cols-2 gap-4 pt-4 border-t border-divider">
            <div>
              <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                Horario Programado
              </p>
              <p class="text-sm text-text-primary font-medium flex items-center gap-1.5">
                <app-icon name="clock" [size]="14" /> {{ cls.timeLabel }}
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                Vehículo Asignado
              </p>
              <p class="text-sm text-text-primary font-medium flex items-center gap-1.5">
                <app-icon name="car" [size]="14" /> {{ cls.vehiclePlate }} ({{ cls.vehicleLabel }})
              </p>
            </div>
          </div>
        </div>

        @if (cls.canStart) {
          <!-- Formulario Inicio -->
          <form
            [formGroup]="startForm"
            (ngSubmit)="onStartClass(cls.sessionId)"
            class="card p-6 flex flex-col gap-6"
          >
            <div>
              <h3 class="text-base font-semibold text-text-primary mb-1">Registrar Inicio</h3>
              <p class="text-sm text-text-muted">
                Ingresa el kilometraje actual del vehículo antes de iniciar la ruta.
              </p>
            </div>

            <div class="space-y-1.5">
              <label class="form-label" for="kmStart">Kilometraje Inicial (Km)</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <app-icon name="gauge" [size]="18" class="text-text-muted" />
                </div>
                <input
                  id="kmStart"
                  type="number"
                  formControlName="kmStart"
                  class="form-control pl-10"
                  placeholder="Ej: 45200"
                  data-llm-description="input for initial vehicle kilometer reading"
                  [style.borderColor]="
                    startForm.get('kmStart')?.invalid && startForm.get('kmStart')?.touched
                      ? 'var(--state-error)'
                      : ''
                  "
                />
              </div>
              @if (startForm.get('kmStart')?.invalid && startForm.get('kmStart')?.touched) {
                <p class="text-xs mt-1" style="color: var(--state-error)">
                  El kilometraje es requerido y debe ser mayor a 0.
                </p>
              }
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-divider">
              <a routerLink="/app/instructor/dashboard" class="btn btn-outline">Cancelar</a>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="startForm.invalid || isSubmitting()"
                data-llm-action="start-class"
              >
                @if (!isSubmitting()) {
                  <app-icon name="play" [size]="16" />
                } @else {
                  <app-icon name="loader-2" [size]="16" class="animate-spin" />
                }
                <span>{{ isSubmitting() ? 'Iniciando...' : 'Comenzar Clase' }}</span>
              </button>
            </div>
          </form>
        } @else {
          <div class="card p-6 text-center">
            <app-icon name="info" [size]="32" class="text-text-muted mx-auto mb-3 opacity-50" />
            <h3 class="font-medium text-text-primary mb-1">
              Esta clase no puede ser iniciada en este momento.
            </h3>
            <p class="text-sm text-text-muted mb-4">
              La clase ya se encuentra {{ cls.statusLabel | lowercase }}.
            </p>
            <a routerLink="/app/instructor/dashboard" class="btn btn-outline text-sm px-4 py-2"
              >Volver al Dashboard</a
            >
          </div>
        }
      } @else {
        <app-empty-state
          icon="search-x"
          message="Llegaste aquí por accidente"
          subtitle="No has seleccionado ninguna clase para iniciar."
          actionLabel="Volver al Dashboard"
          actionIcon="arrow-left"
          (action)="goToDashboard()"
        />
      }
    </div>
  `,
})
export class InstructorClaseComponent implements OnInit {
  public clasesFacade = inject(InstructorClasesFacade);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  public startForm: FormGroup;
  public isSubmitting = signal(false);

  constructor() {
    this.startForm = this.fb.group({
      kmStart: [null, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const sessionIdStr = params['sessionId'];
      if (sessionIdStr) {
        const sessionId = parseInt(sessionIdStr, 10);
        if (!isNaN(sessionId)) {
          this.clasesFacade.loadClassDetail(sessionId);
        }
      }
    });
  }

  async onStartClass(sessionId: number) {
    if (this.startForm.invalid) return;
    this.isSubmitting.set(true);
    try {
      const kmStart = this.startForm.value.kmStart;
      await this.clasesFacade.startClass(sessionId, kmStart);
      this.router.navigate(['/app/instructor/clase', sessionId]);
    } catch {
      this.toast.error('Error al iniciar la clase', 'Por favor, intenta de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToDashboard() {
    this.router.navigate(['/app/instructor/dashboard']);
  }
}
