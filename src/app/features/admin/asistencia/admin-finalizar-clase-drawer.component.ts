import { TooltipModule } from 'primeng/tooltip';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { SignaturePadComponent } from '@shared/components/signature-pad/signature-pad.component';
import type { FinishClassPayload } from '@core/models/ui/asistencia-clase-b.model';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-admin-finalizar-clase-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    DecimalPipe,
    ReactiveFormsModule,
    IconComponent,
    AlertCardComponent,
    SignaturePadComponent,
    DrawerFormComponent,
  ],
  template: `
    @if (facade.selectedPractica(); as cls) {
      <app-drawer-form>
        <!-- Ticket resumen -->
        <div
          class="relative overflow-hidden rounded-xl border border-border-default bg-surface p-5 mb-5"
        >
          <div
            class="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-bl-full pointer-events-none -mr-6 -mt-6"
          ></div>
          <div class="flex items-center gap-3 relative z-10">
            <div
              class="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex flex-col items-center justify-center shrink-0"
            >
              <span class="text-2xs uppercase tracking-wider font-bold text-brand leading-tight"
                >Clase</span
              >
              <span class="text-lg font-display font-bold text-brand leading-none">{{
                cls.classNumber ?? '—'
              }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="font-semibold text-text-primary truncate"
                [pTooltip]="cls.alumnoName ?? 'Sin alumno'"
                tooltipPosition="top"
              >
                {{ cls.alumnoName ?? 'Sin alumno' }}
              </p>
              <p class="text-xs text-text-muted mt-0.5">
                {{ cls.horaInicio }} · {{ cls.instructorName }}
                @if (cls.vehiclePlate) {
                  · {{ cls.vehiclePlate }}
                }
                @if (cls.kmStart) {
                  · Km ini: {{ cls.kmStart }}
                }
              </p>
            </div>
            <span class="indicator-live text-xs text-text-secondary shrink-0 hidden sm:flex"
              >En clase</span
            >
          </div>
        </div>

        @if (error()) {
          <app-alert-card title="Error" severity="error" class="mb-4">
            {{ error() }}
          </app-alert-card>
        }

        <div class="flex flex-col gap-6" [formGroup]="form">
          <!-- Km final -->
          <div class="flex flex-col items-center rounded-2xl border border-border-default/60 p-6">
            <app-icon name="gauge" [size]="24" class="text-brand mb-3" />
            <label
              class="text-xs font-bold text-text-secondary uppercase tracking-widest mb-3"
              for="kmEndAdmin"
            >
              Kilometraje al Retorno
            </label>
            <div
              class="flex items-center gap-3 bg-subtle rounded-2xl border border-border-default/60 px-5 py-3"
            >
              <input
                id="kmEndAdmin"
                type="number"
                formControlName="kmEnd"
                min="1"
                max="999999"
                class="bg-transparent! border-none! outline-none! shadow-none! ring-0! text-4xl font-display font-black text-text-primary text-center p-0 w-28 placeholder:text-border-strong tracking-tighter tabular-nums m-0 focus:bg-transparent!"
                placeholder="0"
                data-llm-description="Odómetro final del vehículo al retorno de la clase práctica"
              />
              <span class="text-xl font-bold text-text-muted select-none mt-1">km</span>
            </div>
            @if (cls.kmStart !== null) {
              <p class="text-xs text-text-muted mt-3 flex items-center gap-1">
                <app-icon name="map-pin" [size]="11" />
                Km. de salida:
                <span class="font-semibold text-text-primary ml-0.5"
                  >{{ cls.kmStart | number }} km</span
                >
              </p>
            }
            @if (
              form.controls.kmEnd.value !== null &&
              cls.kmStart !== null &&
              form.controls.kmEnd.value <= cls.kmStart
            ) {
              <div
                class="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error/10 text-error text-xs font-medium"
              >
                <app-icon name="alert-circle" [size]="13" />
                <span>Debe ser mayor al inicial ({{ cls.kmStart }} km)</span>
              </div>
            } @else if (cls.kmStart === null) {
              <p class="text-xs text-text-muted mt-3 opacity-70">
                Verifique el odómetro del tablero central.
              </p>
            }
          </div>

          <!-- Firmas (opcionales) -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h3
                class="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2"
              >
                <app-icon name="pen-line" [size]="14" />
                Firmas <span class="font-normal normal-case text-text-muted">(opcional)</span>
              </h3>
              <button
                type="button"
                class="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                (click)="signaturesExpanded.set(!signaturesExpanded())"
              >
                {{ signaturesExpanded() ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
            @if (signaturesExpanded()) {
              <div class="grid grid-cols-1 gap-4">
                <app-signature-pad
                  label="Firma del Alumno"
                  (signatureChange)="onSignatureChange('student', $event)"
                  [height]="120"
                />
                <app-signature-pad
                  label="Firma del Instructor"
                  (signatureChange)="onSignatureChange('instructor', $event)"
                  [height]="120"
                />
              </div>
            }
          </div>
        </div>

        <ng-container ngProjectAs="[drawer-form-footer]">
          <button
            type="button"
            class="btn-secondary flex-1"
            [disabled]="isSubmitting()"
            (click)="layoutDrawer.close()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-primary flex-1 flex items-center justify-center gap-2 cursor-pointer"
            [disabled]="!canFinalize(cls) || isSubmitting()"
            (click)="onFinalize(cls)"
            data-llm-action="admin-finish-class"
          >
            @if (isSubmitting()) {
              <app-icon name="loader-2" [size]="16" class="animate-spin" />
              <span>Guardando...</span>
            } @else {
              <app-icon name="check-circle" [size]="16" />
              <span>Cerrar Clase</span>
            }
          </button>
        </ng-container>
      </app-drawer-form>
    }
  `,
})
export class AdminFinalizarClaseDrawerComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly fb = inject(FormBuilder);

  protected readonly isSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly signaturesExpanded = signal(false);

  protected readonly form = this.fb.group({
    kmEnd: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(999999),
    ]),
  });

  private studentSignature: string | null = null;
  private instructorSignature: string | null = null;

  ngOnInit(): void {
    this.form.reset({ kmEnd: null });
    this.studentSignature = null;
    this.instructorSignature = null;
    this.error.set(null);
  }

  protected onSignatureChange(type: 'student' | 'instructor', dataUrl: string | null): void {
    if (type === 'student') this.studentSignature = dataUrl;
    else this.instructorSignature = dataUrl;
  }

  protected canFinalize(cls: { kmStart: number | null }): boolean {
    const kmEnd = this.form.controls.kmEnd.value;
    return kmEnd !== null && kmEnd > 0 && kmEnd > (cls.kmStart ?? 0);
  }

  protected async onFinalize(cls: {
    id: number;
    studentId: number | null;
    kmStart: number | null;
  }): Promise<void> {
    if (!this.canFinalize(cls)) return;
    this.isSubmitting.set(true);
    this.error.set(null);
    try {
      const payload: FinishClassPayload = {
        sessionId: cls.id,
        studentId: cls.studentId,
        kmEnd: this.form.controls.kmEnd.value!,
        studentSignature: this.studentSignature,
        instructorSignature: this.instructorSignature,
      };
      await this.facade.finishClass(payload);
      void this.dashboardFacade.refreshLiveClassesOnly();
      this.layoutDrawer.close();
    } catch {
      this.error.set('No se pudo finalizar la clase. Intenta de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
