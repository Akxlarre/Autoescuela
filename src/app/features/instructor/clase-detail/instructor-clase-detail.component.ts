import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SignaturePadComponent } from '@shared/components/signature-pad/signature-pad.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-clase-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TagModule,
    IconComponent,
    EmptyStateComponent,
    SignaturePadComponent,
    SectionHeroComponent,
    AlertCardComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--hero-fit" appBentoGridLayout>
      <!-- Section Hero Premium -->
      <app-section-hero
        title="Clase en Curso"
        subtitle="Registra el kilometraje de retorno para finalizar"
        backRoute="/app/instructor/dashboard"
        backLabel="Dashboard"
        [actions]="heroActions"
        density="slim"
      />

      <div class="bento-banner">
        <div class="max-w-3xl mx-auto flex flex-col gap-6">
          @if (clasesFacade.isLoading()) {
            <!-- Skeleton: Resumen de Clase Estilo "Ticket" -->
            <div class="bento-card relative overflow-hidden">
              <div class="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5 relative z-10">
                <app-skeleton-block
                  variant="rect"
                  width="56px"
                  height="56px"
                  borderRadius="1rem"
                  class="shrink-0"
                />
                <div class="flex-1 min-w-0 flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="60%" height="20px" />
                  <app-skeleton-block variant="text" width="30%" height="14px" />
                </div>
                <app-skeleton-block
                  variant="rect"
                  width="80px"
                  height="24px"
                  borderRadius="999px"
                  class="hidden sm:block shrink-0"
                />
              </div>

              <div
                class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 pt-4 sm:pt-5 border-t border-border-default/50 relative z-10"
              >
                <div
                  class="flex items-center gap-3 bg-subtle/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none"
                >
                  <app-skeleton-block
                    variant="circle"
                    width="32px"
                    height="32px"
                    class="shrink-0"
                  />
                  <div class="flex flex-col gap-1 w-full">
                    <app-skeleton-block variant="text" width="60px" height="10px" />
                    <app-skeleton-block variant="text" width="80px" height="14px" />
                  </div>
                </div>
                <div
                  class="flex items-center gap-3 bg-subtle/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none"
                >
                  <app-skeleton-block
                    variant="circle"
                    width="32px"
                    height="32px"
                    class="shrink-0"
                  />
                  <div class="flex flex-col gap-1 w-full">
                    <app-skeleton-block variant="text" width="60px" height="10px" />
                    <app-skeleton-block variant="text" width="80px" height="14px" />
                  </div>
                </div>
              </div>
            </div>

            <div class="bento-card p-6 sm:p-10 space-y-8 relative overflow-hidden">
              <app-skeleton-block variant="rect" width="100%" height="140px" borderRadius="1rem" />
              <app-skeleton-block variant="rect" width="100%" height="100px" borderRadius="1rem" />
            </div>
          } @else if (clasesFacade.error()) {
            <app-alert-card title="Error al cargar clase" severity="error">
              {{ clasesFacade.error() }}
            </app-alert-card>
          } @else if (clasesFacade.selectedClass(); as cls) {
            <!-- Resumen de Clase Estilo "Ticket" -->
            <div class="bento-card relative overflow-hidden" appCardHover>
              <div
                class="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-full pointer-events-none -mr-8 -mt-8"
              ></div>
              <div class="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5 relative z-10">
                <div
                  class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand/10 border border-brand/20 flex flex-col items-center justify-center shrink-0"
                >
                  <span
                    class="text-2xs sm:text-2xs uppercase tracking-wider font-bold text-brand leading-tight"
                    >Clase</span
                  >
                  <span class="text-lg sm:text-xl font-display font-bold text-brand leading-none">{{
                    cls.classNumber
                  }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h2
                    class="text-lg sm:text-xl font-display font-bold text-text-primary leading-tight wrap-break-word"
                  >
                    {{ cls.studentName }}
                  </h2>
                  <p class="text-xs sm:text-sm text-text-muted mt-1">RUT: {{ cls.studentRut }}</p>
                </div>
                <p-tag
                  [value]="cls.statusLabel"
                  [severity]="$any(cls.statusColor)"
                  styleClass="hidden sm:inline-flex shrink-0"
                />
              </div>

              <div class="mb-5 sm:hidden mt-2">
                <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" />
              </div>

              <div
                class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 pt-4 sm:pt-5 border-t border-border-default/50 relative z-10"
              >
                <div
                  class="flex items-center gap-3 bg-subtle/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none"
                >
                  <div
                    class="w-8 h-8 rounded-full bg-subtle flex items-center justify-center shrink-0 shadow-sm sm:shadow-none"
                  >
                    <app-icon name="gauge" [size]="16" class="text-text-secondary" />
                  </div>
                  <div>
                    <p
                      class="text-2xs sm:text-2xs font-bold text-text-muted uppercase tracking-wider"
                    >
                      Km Inicial
                    </p>
                    <p class="text-sm font-mono text-text-primary font-medium mt-0.5">
                      {{ cls.kmStart }} km
                    </p>
                  </div>
                </div>
                <div
                  class="flex items-center gap-3 bg-subtle/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none"
                >
                  <div
                    class="w-8 h-8 rounded-full bg-subtle flex items-center justify-center shrink-0 shadow-sm sm:shadow-none"
                  >
                    <app-icon name="clock" [size]="16" class="text-text-secondary" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-2xs sm:text-2xs font-bold text-text-muted uppercase tracking-wider"
                    >
                      Iniciada
                    </p>
                    <p class="text-sm text-text-primary font-medium truncate mt-0.5">
                      {{ cls.startTime || 'Recién' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cierre de clase: km (obligatorio) + observaciones y firmas (opcionales) -->
            <div class="card p-6 space-y-8">
              <!-- KM END ODOMETER -->
              <div>
                <label
                  class="text-sm font-bold text-text-secondary uppercase tracking-widest mb-2 flex justify-center text-center"
                >
                  Kilometraje al Retorno
                </label>
                <div
                  class="flex items-center justify-center gap-3 w-full max-w-sm mx-auto bg-subtle rounded-2xl shadow-inner border border-border-default/60 px-6 py-4 mt-2 transition-colors focus-within:border-brand/50 focus-within:bg-subtle"
                >
                  <input
                    type="number"
                    [(ngModel)]="kmEnd"
                    max="999999"
                    class="bg-transparent! border-none! outline-none! shadow-none! ring-0! text-5xl sm:text-7xl font-display font-black text-text-primary text-center p-0 w-32 sm:w-56 placeholder:text-border-strong tracking-tighter tabular-nums m-0 focus:bg-transparent!"
                    placeholder="0"
                    data-llm-description="input for the odometer reading at class return"
                  />
                  <span class="text-2xl sm:text-3xl font-bold text-text-muted select-none mt-2"
                    >km</span
                  >
                </div>
                <!-- Warning Label -->
                <div class="flex justify-center mt-3">
                  @if (kmEnd !== null && kmEnd <= (cls.kmStart ?? 0)) {
                    <div
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error/10 text-error text-sm font-medium animate-in fade-in"
                    >
                      <app-icon name="alert-circle" [size]="14" />
                      <span>Debe ser mayor al inicial ({{ cls.kmStart }} km)</span>
                    </div>
                  } @else {
                    <p class="text-xs text-text-muted opacity-70">
                      Verifique el odómetro del tablero central.
                    </p>
                  }
                </div>
              </div>

              <hr class="border-border-subtle" />

              <!-- Observaciones (opcional) -->
              <div class="space-y-1.5">
                <label
                  class="text-xs sm:text-sm font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2"
                  for="obs"
                >
                  <app-icon name="pen-tool" [size]="16" />
                  Observaciones (opcional)
                </label>
                <p class="text-sm text-text-muted">
                  La evaluación de desempeño se completa después desde la ficha técnica del alumno.
                </p>
                <div class="relative group">
                  <textarea
                    id="obs"
                    [(ngModel)]="observations"
                    rows="3"
                    class="form-control w-full resize-none rounded-2xl p-5 bg-subtle border-border-default/60 focus:bg-surface focus:border-brand/40 focus:ring-4 focus:ring-brand/10 transition-all text-sm sm:text-base shadow-inner placeholder:text-text-muted/60 hover:border-border-strong cursor-text"
                    placeholder="Notas rápidas sobre el retorno (opcional)..."
                    data-llm-description="input for class observations on return"
                  ></textarea>
                </div>
              </div>

              <hr class="border-border-subtle" />

              <!-- Firmas (opcional) -->
              <div class="space-y-3">
                <h3 class="text-sm font-bold text-text-secondary uppercase tracking-widest">
                  Firmas (opcional)
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <app-signature-pad
                    label="Firma del Alumno"
                    (signatureChange)="onSignatureChange('student', $event)"
                    [height]="150"
                  />
                  <app-signature-pad
                    label="Firma del Instructor"
                    (signatureChange)="onSignatureChange('instructor', $event)"
                    [height]="150"
                  />
                </div>
              </div>

              <div class="pt-2 flex justify-center">
                <button
                  class="btn-primary w-full sm:w-80 h-14 text-base sm:text-lg rounded-2xl shadow-md flex items-center justify-center hover:-translate-y-0.5 transition-all"
                  [disabled]="!canFinalize() || isSubmitting()"
                  (click)="onFinalize(cls)"
                  data-llm-action="cerrar-clase-definitivamente"
                >
                  @if (isSubmitting()) {
                    <app-icon name="loader-2" [size]="20" class="animate-spin mr-2" />
                    <span>Guardando...</span>
                  } @else {
                    <app-icon name="flag" [size]="20" class="mr-2" />
                    <span>Finalizar y Registrar Retorno</span>
                  }
                </button>
              </div>
            </div>
          } @else {
            <app-empty-state
              icon="search-x"
              message="Clase no encontrada"
              subtitle="La clase solicitada no existe o no está en curso."
              actionLabel="Volver al Dashboard"
              actionIcon="arrow-left"
              (action)="goToDashboard()"
            />
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .form-control:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-muted);
      }
    `,
  ],
})
export class InstructorClaseDetailComponent implements OnInit {
  public clasesFacade = inject(InstructorClasesFacade);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  public isSubmitting = signal(false);
  readonly heroActions: SectionHeroAction[] = [];

  public observations = '';
  public kmEnd: number | null = null;
  private studentSignature: string | null = null;
  private instructorSignature: string | null = null;

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

  onSignatureChange(type: 'student' | 'instructor', dataUrl: string | null) {
    if (type === 'student') this.studentSignature = dataUrl;
    else this.instructorSignature = dataUrl;
  }

  canFinalize(): boolean {
    const cls = this.clasesFacade.selectedClass();
    return this.kmEnd !== null && this.kmEnd > (cls?.kmStart || 0);
  }

  async onFinalize(cls: { sessionId: number }) {
    if (!this.canFinalize()) return;

    this.isSubmitting.set(true);
    try {
      await this.clasesFacade.finishClass(cls.sessionId, this.kmEnd!, {
        notes: this.observations || undefined,
        studentSignature: this.studentSignature,
        instructorSignature: this.instructorSignature,
      });

      this.clasesFacade.showSuccess('Clase Finalizada', 'La sesión se ha guardado con éxito.');
      this.router.navigate(['/app/instructor/dashboard']);
    } catch {
      this.clasesFacade.showError('Error al finalizar', 'Hubo un problema al guardar los datos.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToDashboard() {
    this.router.navigate(['/app/instructor/dashboard']);
  }
}
