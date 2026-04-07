import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import type { InstructorStudentCard } from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-instructor-ensayos-teoricos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    TagModule,
    DialogModule,
    SelectModule,
    InputNumberModule,
    DatePickerModule,
    BentoGridLayoutDirective,
    SectionHeroComponent,
    IconComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    AlertCardComponent,
    EmptyStateComponent,
    AsyncBtnComponent,
  ],
  template: `
    <div class="px-6 py-6 pb-20 max-w-5xl mx-auto space-y-6">
      <!-- HERO -->
      <app-section-hero
        #heroRef
        title="Ensayos Teóricos"
        subtitle="Registro de puntajes para preparación de examen municipal"
        backRoute="/app/instructor/dashboard"
        backLabel="Dashboard"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- KPIs Bento Grid -->
      <div class="bento-grid" appBentoGridLayout #bentoGrid>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Total Registros"
            [value]="kpis().total"
            icon="file-check"
            [loading]="isDataLoading()"
          />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Promedio"
            [value]="kpis().promedio"
            suffix="/100"
            icon="bar-chart-2"
            [loading]="isDataLoading()"
          />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Aprobados (80+)"
            [value]="kpis().aprobados"
            icon="award"
            color="success"
            [accent]="true"
            [loading]="isDataLoading()"
          />
        </div>
      </div>

      <!-- Error state -->
      @if (facade.error()) {
        <app-alert-card title="Error al cargar puntajes" severity="error">
          {{ facade.error() }}
        </app-alert-card>
      }

      <!-- Tabla de historial -->
      <div class="card p-0 overflow-hidden">
        <div
          class="px-6 py-4 border-b border-divider bg-surface-hover flex items-center justify-between"
        >
          <h3 class="text-lg font-bold text-text-primary">Historial de Puntajes</h3>
        </div>

        @if (isDataLoading()) {
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr
                  class="border-b border-divider text-xs text-text-muted uppercase tracking-wider"
                  style="background: var(--bg-subtle)"
                >
                  <th class="p-4 font-semibold">Alumno</th>
                  <th class="p-4 font-semibold">RUT</th>
                  <th class="p-4 font-semibold">Puntaje</th>
                  <th class="p-4 font-semibold">Fecha</th>
                  <th class="p-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-divider text-sm">
                @for (_ of skeletonRows; track $index) {
                  <tr>
                    <td class="p-4">
                      <app-skeleton-block variant="text" width="140px" height="14px" />
                    </td>
                    <td class="p-4">
                      <app-skeleton-block variant="text" width="90px" height="14px" />
                    </td>
                    <td class="p-4">
                      <app-skeleton-block variant="text" width="50px" height="14px" />
                    </td>
                    <td class="p-4">
                      <app-skeleton-block variant="text" width="80px" height="14px" />
                    </td>
                    <td class="p-4">
                      <app-skeleton-block variant="rect" width="72px" height="22px" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (facade.examScores().length === 0) {
          <app-empty-state
            icon="file-question"
            message="Sin puntajes registrados"
            subtitle="Registra el primer resultado usando el botón 'Registrar Puntaje'."
            actionLabel="Registrar Puntaje"
            actionIcon="plus"
            (action)="onHeroAction('registrar')"
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr
                  class="border-b border-divider text-xs text-text-muted uppercase tracking-wider"
                  style="background: var(--bg-subtle)"
                >
                  <th class="p-4 font-semibold">Alumno</th>
                  <th class="p-4 font-semibold">RUT</th>
                  <th class="p-4 font-semibold">Puntaje</th>
                  <th class="p-4 font-semibold">Fecha</th>
                  <th class="p-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-divider text-sm">
                @for (item of facade.examScores(); track item.id) {
                  <tr class="hover:bg-surface-hover/50 transition-colors">
                    <td class="p-4 font-medium text-text-primary">{{ item.studentName }}</td>
                    <td class="p-4 text-text-muted">{{ item.studentRut }}</td>
                    <td class="p-4">
                      <span class="font-bold text-text-primary">{{ item.score }}</span>
                      <span class="text-text-muted font-normal">/100</span>
                    </td>
                    <td class="p-4 text-text-muted">{{ item.date | date: 'dd/MM/yyyy' }}</td>
                    <td class="p-4">
                      <p-tag
                        [value]="scoreStatus(item.score).label"
                        [severity]="scoreStatus(item.score).severity"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- Modal: Registrar Puntaje -->
    <p-dialog
      [(visible)]="modalVisibleBridge"
      [modal]="true"
      [style]="{ width: '30rem' }"
      [closable]="true"
      (onHide)="resetForm()"
    >
      <!-- Header con icono + subtítulo -->
      <ng-template pTemplate="header">
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style="background: color-mix(in srgb, var(--ds-brand) 15%, transparent)"
          >
            <app-icon name="file-check" [size]="18" style="color: var(--ds-brand)" />
          </div>
          <div>
            <h2 class="text-base font-bold text-text-primary m-0 leading-tight">
              Registrar Puntaje
            </h2>
            <p class="text-xs text-text-muted m-0">Ensayo Teórico Clase B</p>
          </div>
        </div>
      </ng-template>

      <div class="space-y-5 pt-1">
        <!-- Alumno -->
        <div>
          <label class="block text-sm font-medium text-text-primary mb-1.5">
            Alumno <span style="color: var(--state-error)">*</span>
          </label>
          <p-select
            [options]="facade.students()"
            [(ngModel)]="selectedAlumno"
            optionLabel="name"
            [filter]="true"
            filterBy="name,rut"
            placeholder="Selecciona un alumno"
            [fluid]="true"
            data-llm-description="selector of student for exam score registration"
          />
        </div>

        <!-- Puntaje + Preview en vivo -->
        <div>
          <label class="block text-sm font-medium text-text-primary mb-1.5">
            Puntaje <span style="color: var(--state-error)">*</span>
          </label>
          <div class="flex items-center gap-3">
            <p-inputnumber
              [(ngModel)]="scoreValue"
              [min]="0"
              [max]="100"
              [useGrouping]="false"
              placeholder="85"
              [fluid]="true"
              data-llm-description="input for student exam score from 0 to 100"
            />
            @if (scoreValue !== null) {
              <p-tag
                [value]="scoreStatus(scoreValue).label"
                [severity]="scoreStatus(scoreValue).severity"
              />
            }
          </div>
          <p class="text-xs text-text-muted mt-1.5">Mínimo aprobatorio: 80 puntos (escala 0–100)</p>
        </div>

        <!-- Fecha -->
        <div>
          <label class="block text-sm font-medium text-text-primary mb-1.5">
            Fecha del Ensayo <span style="color: var(--state-error)">*</span>
          </label>
          <p-datepicker
            [(ngModel)]="examDate"
            [showIcon]="true"
            dateFormat="dd/mm/yy"
            [fluid]="true"
            data-llm-description="date picker for the theory exam date"
          />
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="flex gap-3 pt-4 border-t border-divider">
          <app-async-btn
            label="Guardar Puntaje"
            icon="save"
            [loading]="saving()"
            loadingLabel="Guardando..."
            [disabled]="!canSave()"
            class="flex-1"
            (click)="saveScore()"
            data-llm-action="submit-exam-score"
          />
          <button class="btn btn-outline flex-1" (click)="closeModal()">Cancelar</button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class InstructorEnsayosTeoricosComponent implements OnInit, AfterViewInit {
  readonly facade = inject(InstructorAlumnosFacade);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // ── Modal state ──
  private readonly _modalVisible = signal(false);
  readonly saving = signal(false);

  // Bridge para p-dialog [(visible)] — no acepta signals directamente
  get modalVisibleBridge(): boolean {
    return this._modalVisible();
  }
  set modalVisibleBridge(val: boolean) {
    this._modalVisible.set(val);
  }

  // ── Form fields (mutable, ngModel compatible) ──
  selectedAlumno: InstructorStudentCard | null = null;
  scoreValue: number | null = null;
  examDate: Date = new Date();

  readonly skeletonRows = Array(5);

  readonly heroActions: SectionHeroAction[] = [
    { id: 'registrar', label: 'Registrar Puntaje', icon: 'plus', primary: true },
  ];

  /** Verdadero mientras estudiantes O puntajes estén en tránsito. */
  readonly isDataLoading = computed(() => this.facade.isLoading() || this.facade.examLoading());

  readonly kpis = computed(() => {
    const scores = this.facade.examScores();
    const total = scores.length;
    const promedio = total ? Math.round(scores.reduce((acc, r) => acc + r.score, 0) / total) : 0;
    const aprobados = scores.filter((r) => r.score >= 80).length;
    return { total, promedio, aprobados };
  });

  canSave(): boolean {
    return this.selectedAlumno !== null && this.scoreValue !== null;
  }

  async ngOnInit(): Promise<void> {
    await this.facade.initialize(); // carga students (requerido antes de loadExamScores)
    await this.facade.loadExamScores();
  }

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  onHeroAction(id: string): void {
    if (id === 'registrar') this._modalVisible.set(true);
  }

  scoreStatus(score: number): { label: string; severity: 'success' | 'warn' | 'danger' } {
    if (score >= 80) return { label: 'Aprobado', severity: 'success' };
    if (score >= 60) return { label: 'Mejora necesaria', severity: 'warn' };
    return { label: 'Reprobado', severity: 'danger' };
  }

  async saveScore(): Promise<void> {
    if (!this.selectedAlumno || this.scoreValue === null) return;

    this.saving.set(true);
    try {
      await this.facade.registerExamScore({
        studentId: this.selectedAlumno.studentId,
        enrollmentId: this.selectedAlumno.enrollmentId,
        date: this.examDate.toISOString().split('T')[0],
        score: this.scoreValue,
      });
      this.facade.showSuccess('Puntaje registrado exitosamente');
      this.closeModal();
    } catch (e: any) {
      this.facade.showError(e?.message || 'Error al registrar puntaje');
    } finally {
      this.saving.set(false);
    }
  }

  closeModal(): void {
    this._modalVisible.set(false);
  }

  resetForm(): void {
    this.selectedAlumno = null;
    this.scoreValue = null;
    this.examDate = new Date();
  }
}
