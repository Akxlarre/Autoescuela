import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { BranchFacade } from '@core/facades/branch.facade';
import { EvaluacionesProfesionalFacade } from '@core/facades/evaluaciones-profesional.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { GRADE_PASS } from '@core/utils/professional-modules';

@Component({
  selector: 'app-admin-profesional-evaluaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    InputNumberModule,
    TooltipModule,
    ConfirmDialogModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
  ],
  template: `
    <p-confirmDialog />

    <!-- ═══ Hero ═══ -->
    <app-section-hero
      title="Evaluaciones"
      subtitle="Registro de notas por módulo · Escala 10–100 · Mínimo aprobación: 75"
      [actions]="[]"
    />

    <!-- ═══ Selectores ═══ -->
    <section class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-xs font-medium text-secondary">Promoción</label>
        <p-select
          [options]="facade.promociones()"
          optionLabel="name"
          optionValue="id"
          placeholder="Seleccionar promoción"
          [ngModel]="facade.selectedPromocionId()"
          (ngModelChange)="onPromoChange($event)"
          styleClass="w-full"
          [style]="{ height: '40px' }"
          data-llm-description="select promotion to view grades"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-secondary">Curso</label>
        <p-select
          [options]="cursoOptions()"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleccionar curso"
          [disabled]="!facade.selectedPromocionId() || facade.cursos().length === 0"
          [ngModel]="facade.selectedCursoId()"
          (ngModelChange)="onCursoChange($event)"
          styleClass="w-full"
          [style]="{ height: '40px' }"
          data-llm-description="select course to view grades"
        />
      </div>
    </section>

    <!-- ═══ Estado vacío ═══ -->
    @if (!facade.selectedCursoId() && !facade.isLoading()) {
      <div class="mt-10 flex flex-col items-center gap-3 text-center text-secondary">
        <app-icon name="file-spreadsheet" [size]="48" />
        <p class="text-sm">Selecciona una promoción y un curso para ver la grilla de notas.</p>
      </div>
    }

    <!-- ═══ Skeleton ═══ -->
    @if (facade.isLoading()) {
      <div class="mt-6 space-y-2">
        @for (i of skeletonRows; track $index) {
          <app-skeleton-block variant="text" width="100%" height="48px" />
        }
      </div>
    }

    <!-- ═══ Grilla de notas ═══ -->
    @if (facade.grilla() && !facade.isLoading()) {
      @let g = facade.grilla()!;

      <!-- Header info -->
      <div class="mt-6 mb-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <p class="text-sm font-semibold text-primary">
            {{ g.promotionName }} · {{ g.courseName }} · {{ g.totalAlumnos }} alumnos
          </p>
          @if (g.confirmed) {
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              [style]="confirmedBadgeStyle"
            >
              <app-icon name="check-circle" [size]="12" />
              Notas confirmadas
            </span>
          }
        </div>
      </div>

      <!-- Escala de notas -->
      <p class="mb-3 text-xs text-muted">
        Escala de notas: 10–100 · Pasa el cursor sobre cada columna para ver el contenido del
        módulo.
      </p>

      <!-- Tabla responsive -->
      <div class="overflow-x-auto rounded-lg border border-[var(--p-content-border-color)]">
        <table class="w-full border-collapse text-sm">
          <!-- Encabezados -->
          <thead>
            <tr class="border-b border-[var(--p-content-border-color)] bg-[var(--p-surface-100)]">
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-secondary"
                style="min-width:220px"
              >
                Alumno
              </th>
              @for (name of g.moduleNames; track $index) {
                <th
                  class="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-secondary"
                  style="min-width:90px"
                  [pTooltip]="name"
                  tooltipPosition="top"
                >
                  Módulo {{ $index + 1 }}
                </th>
              }
              <th
                class="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-secondary"
                style="min-width:90px"
              >
                Promedio
              </th>
            </tr>
          </thead>

          <!-- Filas de alumnos -->
          <tbody>
            @for (fila of g.filas; track fila.enrollmentId) {
              <tr
                class="border-b border-[var(--p-content-border-color)] transition-colors hover:bg-[var(--p-surface-50)]"
              >
                <!-- Alumno -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      [style]="avatarStyle"
                    >
                      {{ fila.initials }}
                    </div>
                    <div>
                      <p class="font-medium text-primary">{{ fila.nombre }}</p>
                      <p class="text-xs text-muted">{{ fila.rut }}</p>
                    </div>
                  </div>
                </td>

                <!-- Celdas de módulos -->
                @for (nota of fila.notas; track $index) {
                  <td class="px-2 py-2 text-center">
                    @if (g.confirmed) {
                      <!-- Vista solo lectura -->
                      <span
                        class="inline-block rounded-md px-2 py-1 text-sm font-semibold"
                        style="min-width:56px"
                        [style]="getGradeReadonlyStyle(nota.passed)"
                      >
                        {{ nota.grade !== null ? nota.grade : '—' }}
                      </span>
                    } @else {
                      <!-- Input editable -->
                      <p-inputnumber
                        [ngModel]="nota.grade"
                        (ngModelChange)="onGradeChange(fila.enrollmentId, $index, $event)"
                        [max]="100"
                        [minFractionDigits]="0"
                        [maxFractionDigits]="1"
                        [useGrouping]="false"
                        (onKeyDown)="onGradeKeyDown($event)"
                        (onBlur)="onGradeBlur(fila.enrollmentId, $index, nota.grade)"
                        placeholder="—"
                        inputStyleClass="text-center font-semibold text-sm"
                        [inputStyle]="getCellInputStyle(nota.grade)"
                        styleClass="w-[72px]"
                        data-llm-description="module grade input scale 10 to 100"
                      />
                    }
                  </td>
                }

                <!-- Promedio -->
                <td class="px-3 py-2 text-center">
                  @if (fila.promedio !== null) {
                    <span
                      class="inline-block rounded-full px-3 py-1 text-sm font-bold"
                      style="min-width:56px"
                      [style]="getPromedioStyle(fila.promedioAprobado)"
                    >
                      {{ fila.promedio }}
                    </span>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- ═══ Footer: leyenda + acciones ═══ -->
      <footer class="mt-4 flex items-center justify-between">
        <!-- Leyenda -->
        <div class="flex items-center gap-4 text-xs text-secondary">
          <span class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full" [style]="legendPassDotStyle"></span>
            Aprobado (≥{{ gradePass }})
          </span>
          <span class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full" [style]="legendFailDotStyle"></span>
            Reprobado (&lt;{{ gradePass }})
          </span>
        </div>

        <!-- Botones de acción -->
        @if (!g.confirmed) {
          <div class="flex items-center gap-3">
            <button
              class="rounded-lg border border-[var(--p-content-border-color)] px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-[var(--p-surface-100)]"
              [disabled]="facade.isSaving() || !facade.hayDirty()"
              (click)="guardarBorrador()"
              data-llm-action="save-draft-grades"
            >
              @if (facade.isSaving()) {
                <app-icon name="loader-2" [size]="14" class="mr-1 animate-spin" />
              }
              Guardar borrador
            </button>
            <button
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              [style]="confirmBtnStyle"
              [disabled]="facade.isSaving() || !todasConNota()"
              (click)="confirmarNotas()"
              data-llm-action="confirm-grades"
            >
              Confirmar notas
            </button>
          </div>
        }
      </footer>
    }
  `,
})
export class AdminProfesionalEvaluacionesComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(EvaluacionesProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly confirmationService = inject(ConfirmationService);

  protected readonly gradePass = GRADE_PASS;
  protected readonly skeletonRows = Array.from({ length: 6 });

  // ── Estilos estáticos via tokens CSS ────────────────────────────────────────
  protected readonly avatarStyle = {
    background: 'var(--p-primary-100)',
    color: 'var(--p-primary-700)',
  };
  protected readonly confirmedBadgeStyle = {
    background: 'var(--p-green-100)',
    color: 'var(--p-green-700)',
  };
  protected readonly legendPassDotStyle = { background: 'var(--p-green-500)' };
  protected readonly legendFailDotStyle = { background: 'var(--p-red-400)' };
  protected readonly confirmBtnStyle = {
    background: 'var(--p-primary-500)',
  };

  // ── Computed ────────────────────────────────────────────────────────────────
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
  protected onPromoChange(id: number): void {
    this.facade.selectPromocion(id);
  }

  protected onCursoChange(id: number): void {
    this.facade.selectCurso(id);
  }

  protected onGradeChange(enrollmentId: number, moduleIndex: number, value: number | null): void {
    this.facade.setNota(enrollmentId, moduleIndex, value);
  }

  // ── Helpers de estilo dinámico ───────────────────────────────────────────────
  /** Estilo para celda de input editable según nota */
  protected getCellInputStyle(grade: number | null): Record<string, string> {
    const base = { width: '72px' };
    if (grade === null) return base;
    return grade >= GRADE_PASS
      ? {
          ...base,
          background: 'var(--p-green-50)',
          color: 'var(--p-green-700)',
          borderColor: 'var(--p-green-200)',
        }
      : {
          ...base,
          background: 'var(--p-red-50)',
          color: 'var(--p-red-700)',
          borderColor: 'var(--p-red-200)',
        };
  }

  /** Estilo para celda readonly (grilla confirmada) */
  protected getGradeReadonlyStyle(passed: boolean | null): Record<string, string> {
    if (passed === true) {
      return {
        background: 'var(--p-green-50)',
        color: 'var(--p-green-700)',
        border: '1px solid var(--p-green-200)',
      };
    }
    if (passed === false) {
      return {
        background: 'var(--p-red-50)',
        color: 'var(--p-red-700)',
        border: '1px solid var(--p-red-200)',
      };
    }
    return { color: 'var(--p-text-muted-color)' };
  }

  /** Estilo para badge de promedio */
  protected getPromedioStyle(passed: boolean | null): Record<string, string> {
    if (passed === true) return { background: 'var(--p-green-100)', color: 'var(--p-green-800)' };
    if (passed === false) return { background: 'var(--p-red-100)', color: 'var(--p-red-800)' };
    return {};
  }

  /** Verifica que todos los alumnos tengan nota en todos los módulos */
  protected todasConNota(): boolean {
    const g = this.facade.grilla();
    if (!g) return false;
    return g.filas.every((f) => f.notas.every((n) => n.grade !== null));
  }

  /**
   * Impide tipear más de 4 caracteres en la celda de nota (ej: "100." o "75.5").
   * Bloquea en tiempo real antes de que PrimeNG procese el valor — evita ver "101".
   */
  /** Al salir del campo, clampea a 10 si el valor quedó por debajo del mínimo. */
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

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const preview = input.value.slice(0, start) + event.key + input.value.slice(end);

    if (preview.length > 4) event.preventDefault();
  }

  protected guardarBorrador(): void {
    this.facade.guardarBorrador();
  }

  protected confirmarNotas(): void {
    this.confirmationService.confirm({
      header: 'Confirmar notas',
      message:
        '¿Estás seguro de confirmar las notas? Esta acción es <strong>irreversible</strong>: las notas quedarán bloqueadas.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, confirmar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.facade.confirmarNotas(),
    });
  }
}
