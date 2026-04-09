import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { LowerCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-clase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LowerCasePipe,
    ReactiveFormsModule,
    TagModule,
    IconComponent,
    EmptyStateComponent,
    AlertCardComponent,
    SectionHeroComponent,
  ],
  template: `
    <div class="px-4 sm:px-6 py-6 pb-20 max-w-3xl mx-auto space-y-6">
      <app-section-hero
        title="Iniciar Clase"
        subtitle="Verifica la sesión y registra el kilometraje inicial del vehículo"
        backRoute="/app/instructor/dashboard"
        backLabel="Dashboard"
        [actions]="heroActions"
      />

      @if (clasesFacade.isLoading()) {
        <div class="flex justify-center p-12">
          <app-icon
            name="loader-2"
            [size]="32"
            class="text-brand animate-spin"
          />
        </div>
      } @else if (clasesFacade.error()) {
        <app-alert-card title="Atención" severity="error">
          {{ clasesFacade.error() }}
        </app-alert-card>
      } @else if (clasesFacade.selectedClass(); as cls) {
        <!-- Resumen de Clase Estilo "Ticket" -->
        <div class="bento-card relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-full pointer-events-none -mr-8 -mt-8"></div>
          <div class="flex items-start sm:items-center gap-4 mb-5 relative z-10">
            <div class="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex flex-col items-center justify-center shrink-0">
              <span class="text-[10px] uppercase tracking-wider font-bold text-brand">Ruta</span>
              <span class="text-xl font-display font-bold text-brand leading-none mt-0.5">{{ cls.classNumber }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-xl font-display font-bold text-text-primary truncate">{{ cls.studentName }}</h2>
              <p class="text-sm text-text-muted mt-0.5">RUT: {{ cls.studentRut }}</p>
            </div>
            <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" styleClass="hidden sm:inline-flex" />
          </div>

          <!-- P-tag para mobile (se mueve abajo en pantallas pequeñas) -->
          <div class="mb-4 sm:hidden">
            <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" />
          </div>

          <div class="grid grid-cols-2 gap-4 pt-4 border-t border-border-default/50 relative z-10">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center shrink-0">
                <app-icon name="clock" [size]="16" class="text-text-secondary" />
              </div>
              <div>
                <p class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Horario</p>
                <p class="text-sm text-text-primary font-medium">{{ cls.timeLabel }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center shrink-0">
                <app-icon name="car" [size]="16" class="text-text-secondary" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Vehículo</p>
                <p class="text-sm text-text-primary font-medium truncate">{{ cls.vehiclePlate }} <span class="text-text-muted font-normal">({{ cls.vehicleLabel }})</span></p>
              </div>
            </div>
          </div>
        </div>

        @if (cls.canStart) {
          <!-- Formulario Inicio Premium Odometer Mode -->
          <form
            [formGroup]="startForm"
            (ngSubmit)="onStartClass(cls.sessionId)"
            class="flex flex-col gap-6"
          >
            <!-- Gran Tarjeta de Odómetro -->
            <div 
              class="bento-card p-8 sm:p-12 relative overflow-hidden transition-all duration-300 group focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand border-2"
              [class.border-border-default]="startForm.get('kmStart')?.valid || !startForm.get('kmStart')?.touched"
              [class.border-error]="startForm.get('kmStart')?.invalid && startForm.get('kmStart')?.touched"
            >
              <div class="flex flex-col items-center justify-center relative z-10">
                <div class="w-16 h-16 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-6 shadow-sm ring-1 ring-brand/20 group-focus-within:scale-110 group-focus-within:bg-brand group-focus-within:text-white transition-all duration-500">
                  <app-icon name="gauge" [size]="32" />
                </div>
                
                <label class="text-sm font-bold text-text-secondary uppercase tracking-widest mb-2 cursor-pointer" for="kmStart">
                  Kilometraje Actual
                </label>
                
                <div class="flex items-center justify-center gap-3 w-full max-w-sm mx-auto bg-surface-base rounded-2xl shadow-inner border border-border-default/60 px-6 py-4 mt-2 transition-colors group-focus-within:border-brand/50 group-focus-within:bg-surface-hover">
                  <input
                    id="kmStart"
                    type="number"
                    formControlName="kmStart"
                    max="999999"
                    class="!bg-transparent !border-none !outline-none !shadow-none !ring-0 text-5xl sm:text-7xl font-display font-black text-text-primary text-center p-0 w-32 sm:w-56 placeholder:text-border-strong tracking-tighter tabular-nums m-0 focus:!bg-transparent"
                    placeholder="0"
                  />
                  <span class="text-2xl sm:text-3xl font-bold text-text-muted select-none mt-2">km</span>
                </div>
                
                @if (startForm.get('kmStart')?.invalid && startForm.get('kmStart')?.touched) {
                  <div class="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error/10 text-error text-sm font-medium animate-in fade-in slide-in-from-top-2">
                    <app-icon name="alert-circle" [size]="14" />
                    <span>
                      @if (startForm.get('kmStart')?.hasError('max')) {
                        El valor máximo es 999.999 km
                      } @else {
                        Ingrese un valor válido (> 0)
                      }
                    </span>
                  </div>
                } @else {
                  <p class="text-sm text-text-muted mt-4 opacity-70">
                    Verifique el panel del coche antes de arrancar.
                  </p>
                }
              </div>
            </div>

            <div class="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-2">
              <button
                type="button"
                (click)="goToDashboard()"
                class="btn-secondary w-full sm:w-auto px-8"
              >
                Volver
              </button>
              <button
                type="submit"
                class="btn-primary w-full sm:w-auto px-8 shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5"
                [disabled]="startForm.invalid || isSubmitting()"
                data-llm-action="start-class"
              >
                @if (!isSubmitting()) {
                  <app-icon name="play" [size]="16" class="mr-1" />
                } @else {
                  <app-icon name="loader-2" [size]="16" class="animate-spin mr-1" />
                }
                <span>{{ isSubmitting() ? 'Iniciando Ruta...' : 'Comenzar Clase' }}</span>
              </button>
            </div>
          </form>
        } @else {
          <div class="card p-10 flex flex-col justify-center items-center text-center border-dashed">
            <div class="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4">
              <app-icon name="lock" [size]="28" class="text-text-muted opacity-60" />
            </div>
            <h3 class="text-xl font-display font-bold text-text-primary mb-2">
              Clase Bloqueada
            </h3>
            <p class="text-base text-text-muted mb-6 max-w-sm">
              Esta sesión se encuentra <strong class="text-text-primary">{{ cls.statusLabel | lowercase }}</strong>. Solo se permite iniciar clases en estado "Agendada".
            </p>
            <button (click)="goToDashboard()" class="btn-primary w-full sm:w-auto px-8">
              Volver al Dashboard
            </button>
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

  public startForm: FormGroup;
  public isSubmitting = signal(false);

  readonly heroActions: SectionHeroAction[] = [];

  constructor() {
    this.startForm = this.fb.group({
      kmStart: [null, [Validators.required, Validators.min(1), Validators.max(999999)]],
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
      this.clasesFacade.showError('Error al iniciar la clase', 'Por favor, intenta de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToDashboard() {
    this.router.navigate(['/app/instructor/dashboard']);
  }
}
