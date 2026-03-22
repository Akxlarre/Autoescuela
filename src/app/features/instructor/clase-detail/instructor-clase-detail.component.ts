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
  selector: 'app-instructor-clase-detail',
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
        <span class="text-text-primary font-medium">Clase Activa</span>
      </div>

      <div>
        <h1 class="text-2xl font-bold text-text-primary">Clase Activa</h1>
        <p class="text-sm text-text-muted mt-1">Registra el término de la clase</p>
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
                Kilometraje Inicial
              </p>
              <p class="text-sm text-text-primary font-medium flex items-center gap-1.5">
                <app-icon name="gauge" [size]="14" /> {{ cls.kmStart }} km iniciales
              </p>
            </div>
          </div>
        </div>

        @if (cls.canFinish) {
          <!-- Formulario Término -->
          <form
            [formGroup]="finishForm"
            (ngSubmit)="onFinishClass(cls.sessionId, cls.studentId)"
            class="card p-6 flex flex-col gap-6"
          >
            <div>
              <h3 class="text-base font-semibold text-text-primary mb-1">Finalizar Clase</h3>
              <p class="text-sm text-text-muted">Ingresa el kilometraje final del vehículo.</p>
            </div>

            <div class="space-y-1.5">
              <label class="form-label" for="kmEnd">Kilometraje Final (Km)</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <app-icon name="gauge" [size]="18" class="text-text-muted" />
                </div>
                <input
                  id="kmEnd"
                  type="number"
                  formControlName="kmEnd"
                  class="form-control pl-10"
                  placeholder="Ej: 45220"
                  data-llm-description="input for final vehicle kilometer reading"
                  [style.borderColor]="
                    finishForm.get('kmEnd')?.invalid && finishForm.get('kmEnd')?.touched
                      ? 'var(--state-error)'
                      : ''
                  "
                />
              </div>
              @if (finishForm.get('kmEnd')?.invalid && finishForm.get('kmEnd')?.touched) {
                <p class="text-xs mt-1" style="color: var(--state-error)">
                  El kilometraje es requerido y debe ser mayor al inicial.
                </p>
              }
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-divider">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="finishForm.invalid || isSubmitting()"
                data-llm-action="finish-class"
              >
                @if (!isSubmitting()) {
                  <app-icon name="check-square" [size]="16" />
                } @else {
                  <app-icon name="loader-2" [size]="16" class="animate-spin" />
                }
                <span>{{ isSubmitting() ? 'Finalizando...' : 'Finalizar Clase' }}</span>
              </button>
            </div>
          </form>
        } @else {
          <div class="card p-6 text-center">
            <app-icon name="info" [size]="32" class="text-text-muted mx-auto mb-3 opacity-50" />
            <h3 class="font-medium text-text-primary mb-1">
              Esta clase no puede ser finalizada ahora.
            </h3>
            <p class="text-sm text-text-muted mb-4">
              La clase ya está {{ cls.statusLabel | lowercase }}.
            </p>
            @if (cls.canEvaluate) {
              <a
                [routerLink]="[
                  '/app/instructor/alumnos',
                  cls.studentId,
                  'evaluacion',
                  cls.sessionId,
                ]"
                class="btn btn-primary text-sm px-4 py-2 mt-2"
              >
                Ir a la Evaluación
              </a>
            } @else {
              <a
                routerLink="/app/instructor/dashboard"
                class="btn btn-outline text-sm px-4 py-2 mt-2"
                >Volver al Dashboard</a
              >
            }
          </div>
        }
      } @else {
        <app-empty-state
          icon="search-x"
          message="Clase no encontrada"
          subtitle="La clase solicitada no existe o no tienes acceso."
          actionLabel="Volver al Dashboard"
          actionIcon="arrow-left"
          (action)="goToDashboard()"
        />
      }
    </div>
  `,
})
export class InstructorClaseDetailComponent implements OnInit {
  public clasesFacade = inject(InstructorClasesFacade);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  public finishForm: FormGroup;
  public isSubmitting = signal(false);

  constructor() {
    this.finishForm = this.fb.group({
      kmEnd: [null, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const sessionIdStr = params['id'];
      if (sessionIdStr) {
        const sessionId = parseInt(sessionIdStr, 10);
        if (!isNaN(sessionId)) {
          this.clasesFacade.loadClassDetail(sessionId);
        }
      }
    });
  }

  async onFinishClass(sessionId: number, studentId: number) {
    if (this.finishForm.invalid) return;

    const cls = this.clasesFacade.selectedClass();
    const kmStart = cls?.kmStart || 0;
    const kmEnd = this.finishForm.value.kmEnd;

    if (kmEnd <= kmStart) {
      this.toast.error(
        'Kilometraje inválido',
        `El kilometraje final debe ser mayor que el inicial (${kmStart} km).`,
      );
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.clasesFacade.finishClass(sessionId, kmEnd);
      this.router.navigate(['/app/instructor/alumnos', studentId, 'evaluacion', sessionId]);
    } catch {
      this.toast.error('Error al finalizar la clase', 'Por favor, intenta de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToDashboard() {
    this.router.navigate(['/app/instructor/dashboard']);
  }
}
