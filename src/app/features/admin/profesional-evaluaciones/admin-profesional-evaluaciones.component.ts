import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  computed,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BranchFacade } from '@core/facades/branch.facade';
import { EvaluacionesProfesionalFacade } from '@core/facades/evaluaciones-profesional.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SelectModule } from 'primeng/select';
import { GRADE_PASS } from '@core/utils/professional-modules';

@Component({
  selector: 'app-admin-profesional-evaluaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Hero ═══ -->
      <app-section-hero
        #heroRef
        title="Evaluaciones"
        subtitle="Registro de notas por módulo · Escala 10–100 · Mínimo aprobación: 75"
        icon="graduation-cap"
        [actions]="[]"
      />

      <!-- ═══ Filtros / Selectores ═══ -->
      <div
        class="bento-banner rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-end"
      >
        <div class="flex-1">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-secondary"
            >Promoción</label
          >
          <p-select
            [options]="promoSelectOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccionar promoción"
            [ngModel]="facade.selectedPromocionId()"
            (ngModelChange)="onPromoChange($event)"
            styleClass="w-full"
            data-llm-description="select promotion to view grades"
          />
        </div>
        <div class="flex-1">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-secondary"
            >Curso</label
          >
          <p-select
            [options]="cursoOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccionar curso"
            [ngModel]="facade.selectedCursoId()"
            (ngModelChange)="onCursoChange($event)"
            [disabled]="!facade.selectedPromocionId() || facade.cursos().length === 0"
            styleClass="w-full"
            data-llm-description="select course to view grades"
          />
        </div>
      </div>

      <!-- ═══ Estado vacío ═══ -->
      @if (!facade.selectedCursoId() && !facade.isLoading()) {
        <div
          class="bento-banner py-12 flex flex-col items-center gap-3 text-center text-secondary border border-dashed border-border rounded-xl"
        >
          <div class="bg-surface p-4 rounded-full shadow-sm mb-2">
            <app-icon name="file-spreadsheet" [size]="48" color="var(--text-muted)" />
          </div>
          <p class="text-sm font-medium">
            Selecciona una promoción y un curso para ver la grilla de notas.
          </p>
        </div>
      }

      <!-- ═══ Skeleton ═══ -->
      @if (facade.isLoading()) {
        <div class="bento-banner space-y-2 mt-4">
          @for (i of skeletonRows; track $index) {
            <app-skeleton-block variant="text" width="100%" height="48px" />
          }
        </div>
      }

      <!-- ═══ Grilla de notas ═══ -->
      @if (facade.grilla() && !facade.isLoading()) {
        @let g = facade.grilla()!;
        <div
          class="bento-banner rounded-xl border border-border bg-surface flex flex-col overflow-hidden"
        >
          <!-- Header info -->
          <div class="p-4 border-b border-border flex items-center justify-between flex-wrap gap-4">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center bg-brand/10 text-brand"
              >
                <app-icon name="list-checks" [size]="20" />
              </div>
              <div>
                <p class="text-sm font-bold text-primary">
                  {{ g.courseName }}
                </p>
                <p class="text-xs text-secondary mt-0.5">
                  {{ g.promotionName }} ·
                  <span class="font-semibold">{{ g.totalAlumnos }} alumnos</span>
                </p>
              </div>
            </div>

            @if (g.confirmed) {
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider bg-success/15 text-success border border-success/30"
              >
                <app-icon name="lock" [size]="12" /> Confirmadas
              </span>
            } @else {
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 border border-amber-500/30"
              >
                <app-icon name="edit-3" [size]="12" /> En edición
              </span>
            }
          </div>

          <!-- Tabla responsive -->
          <div class="overflow-x-auto w-full max-w-[100vw]">
            <table class="w-full border-collapse text-sm">
              <!-- Encabezados -->
              <thead>
                <tr class="border-b border-border bg-surface-elevated">
                  <th
                    class="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-secondary"
                    style="min-width:220px"
                  >
                    Alumno
                  </th>
                  @for (name of g.moduleNames; track $index) {
                    <th
                      class="px-2 py-3 justify-center items-center text-[11px] font-bold uppercase tracking-wider text-secondary"
                      style="min-width:90px"
                      [title]="name"
                    >
                      <span class="truncate block text-center max-w-[90px] mx-auto"
                        >Mod {{ $index + 1 }}</span
                      >
                    </th>
                  }
                  <th
                    class="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-secondary"
                    style="min-width:90px"
                  >
                    Promedio
                  </th>
                </tr>
              </thead>

              <!-- Filas de alumnos -->
              <tbody>
                @for (fila of g.filas; track fila.enrollmentId) {
                  <tr class="border-b border-border/50 transition-colors hover:bg-surface-hover">
                    <!-- Alumno -->
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div
                          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-primary/10 text-primary"
                        >
                          {{ fila.initials }}
                        </div>
                        <div>
                          <p class="font-bold text-primary text-xs">{{ fila.nombre }}</p>
                          <p class="text-[11px] text-muted">{{ fila.rut }}</p>
                        </div>
                      </div>
                    </td>

                    <!-- Celdas de módulos -->
                    @for (nota of fila.notas; track $index) {
                      <td class="px-2 py-2 text-center">
                        @if (g.confirmed) {
                          <!-- Vista solo lectura -->
                          <span
                            class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-bold min-w-[56px] border"
                            [class]="getReadonlyClasses(nota.passed)"
                          >
                            {{ nota.grade !== null ? nota.grade : '—' }}
                          </span>
                        } @else {
                          <!-- Input editable (HTML Nativo) -->
                          <input
                            type="number"
                            [ngModel]="nota.grade"
                            (ngModelChange)="onGradeChange(fila.enrollmentId, $index, $event)"
                            max="100"
                            min="10"
                            (keydown)="onGradeKeyDown($event)"
                            (blur)="onGradeBlur(fila.enrollmentId, $index, nota.grade)"
                            placeholder="—"
                            class="w-[64px] text-center font-bold text-xs px-2 py-1.5 rounded-md border appearance-none outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                            [class]="getInputClasses(nota.grade)"
                            data-llm-description="module grade input scale 10 to 100"
                          />
                        }
                      </td>
                    }

                    <!-- Promedio -->
                    <td class="px-4 py-2 text-right">
                      @if (fila.promedio !== null) {
                        <span
                          class="inline-flex items-center justify-center rounded-full px-3 py-1 mt-0.5 text-xs font-bold border"
                          [class]="getPromedioClasses(fila.promedioAprobado)"
                        >
                          {{ fila.promedio }}
                        </span>
                      } @else {
                        <span class="text-muted inline-block w-full text-center">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Footer: leyenda + acciones -->
          <div
            class="p-4 bg-surface-elevated border-t border-border flex items-center justify-between flex-wrap gap-4"
          >
            <!-- Leyenda -->
            <div class="flex items-center gap-4 text-xs font-medium text-secondary">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-success"></span> Aprobado (≥{{ gradePass }})
              </span>
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-error"></span> Reprobado (&lt;{{ gradePass }})
              </span>
            </div>

            <!-- Botones de acción -->
            @if (!g.confirmed) {
              <div class="flex items-center gap-3">
                <button
                  class="btn-outline flex items-center gap-2"
                  [disabled]="facade.isSaving() || !facade.hayDirty()"
                  (click)="guardarBorrador()"
                  data-llm-action="save-draft-grades"
                >
                  <app-icon name="save" [size]="14" />
                  Guardar
                </button>
                <button
                  class="btn-primary flex items-center gap-2"
                  [disabled]="facade.isSaving() || !todasConNota()"
                  (click)="confirmarNotas()"
                  data-llm-action="confirm-grades"
                >
                  <app-icon name="check-circle" [size]="14" />
                  Confirmar Final
                </button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminProfesionalEvaluacionesComponent implements OnInit, OnDestroy, AfterViewInit {
  protected readonly facade = inject(EvaluacionesProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly confirmModalService = inject(ConfirmModalService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  protected readonly gradePass = GRADE_PASS;
  protected readonly skeletonRows = Array.from({ length: 6 });

  // ── Computed ────────────────────────────────────────────────────────────────
  protected readonly promoSelectOptions = computed(() =>
    this.facade.promociones().map((p) => ({ label: p.name, value: p.id })),
  );

  protected readonly cursoOptions = computed(() =>
    this.facade.cursos().map((c) => ({
      label: `${c.courseCode} — ${c.courseName}`,
      value: c.id,
    })),
  );

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    this.facade.loadPromociones();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected onPromoChange(id: string): void {
    const numId = Number(id);
    if (!isNaN(numId)) this.facade.selectPromocion(numId);
  }

  protected onCursoChange(id: string): void {
    const numId = Number(id);
    if (!isNaN(numId)) this.facade.selectCurso(numId);
  }

  protected onGradeChange(enrollmentId: number, moduleIndex: number, value: string | null): void {
    const numValue = value && value.trim() ? Number(value) : null;
    this.facade.setNota(enrollmentId, moduleIndex, numValue);
  }

  // ── Helpers de estilo dinámico ───────────────────────────────────────────────
  protected getInputClasses(grade: number | null): string {
    if (grade === null) return 'bg-surface border-border text-primary';
    return grade >= this.gradePass
      ? 'bg-success/10 text-success-dark border-success/30'
      : 'bg-error/10 text-error-dark border-error/30';
  }

  protected getReadonlyClasses(passed: boolean | null): string {
    if (passed === true) return 'bg-success/15 text-success border-success/20';
    if (passed === false) return 'bg-error/15 text-error border-error/20';
    return 'bg-surface border-border text-muted';
  }

  protected getPromedioClasses(passed: boolean | null): string {
    if (passed === true) return 'bg-success text-white border-success-dark';
    if (passed === false) return 'bg-error text-white border-error-dark';
    return 'bg-border text-secondary border-border-subtle';
  }

  protected todasConNota(): boolean {
    const g = this.facade.grilla();
    if (!g) return false;
    return g.filas.every((f) => f.notas.every((n) => n.grade !== null));
  }

  protected onGradeBlur(enrollmentId: number, moduleIndex: number, grade: number | null): void {
    if (grade !== null && grade < 10) {
      this.facade.setNota(enrollmentId, moduleIndex, 10);
    }
  }

  protected onGradeKeyDown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const allowed = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;

    // Prevent non-numeric entries
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const preview = input.value.slice(0, start) + event.key + input.value.slice(end);

    if (preview.length > 3) event.preventDefault(); // Max 100
  }

  protected guardarBorrador(): void {
    this.facade.guardarBorrador();
  }

  protected async confirmarNotas(): Promise<void> {
    const confirmed = await this.confirmModalService.confirm({
      title: 'Confirmar notas',
      message:
        '¿Estás seguro de confirmar las notas? Esta acción es irreversible: las notas quedarán bloqueadas y no podrán editarse.',
      confirmLabel: 'Sí, confirmar notas',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });

    if (confirmed) {
      this.facade.confirmarNotas();
    }
  }

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();

    if (hero) this.gsap.animateHero(hero.nativeElement);
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
