import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BranchFacade } from '@core/facades/branch.facade';
import { EvaluacionesProfesionalFacade } from '@core/facades/evaluaciones-profesional.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { GRADE_PASS, MODULE_COUNT } from '@core/utils/professional-modules';
import { computeGradebookStats, countModulosCompletos } from '@core/utils/gradebook-stats';
import type { CursoEstado, FilaEvaluacion } from '@core/models/ui/evaluaciones-profesional.model';
import type { SectionHeroChip } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-secretaria-profesional-notas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    StatBoxComponent,
    BentoGridLayoutDirective,
  ],
  styles: `
    .gradebook-scroll {
      max-height: 62vh;
      overflow: auto;
    }
    .gradebook-table {
      border-collapse: separate;
      border-spacing: 0;
    }
    .gradebook-table thead th {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--bg-elevated);
    }
    .col-alumno {
      position: sticky;
      left: 0;
      z-index: 10;
      background: var(--bg-surface);
    }
    .gradebook-table tbody tr:hover .col-alumno {
      background: var(--bg-subtle);
    }
    .gradebook-table thead .col-alumno {
      z-index: 30;
      background: var(--bg-elevated);
    }
    .grade-cell {
      position: relative;
    }
    .grade-cell > * {
      position: relative;
      z-index: 1;
    }
    .grade-cell:hover::after {
      content: '';
      position: absolute;
      top: -1000px;
      bottom: -1000px;
      left: 0;
      right: 0;
      background: var(--bg-subtle);
      pointer-events: none;
      z-index: 0;
    }
  `,
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        [title]="heroTitle()"
        [subtitle]="heroSubtitle()"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        icon="graduation-cap"
        [actions]="[]"
      />

      <!-- ═══ Landing — sin grilla activa ═══ -->
      @if (!facade.grilla()) {
        @if (!facade.isLoading() && facade.landingLoaded() && facade.landing().length === 0) {
          <div class="bento-banner py-14 flex flex-col items-center gap-4 text-center">
            <div class="w-16 h-16 rounded-2xl bg-subtle flex items-center justify-center">
              <app-icon name="graduation-cap" [size]="28" color="var(--text-muted)" />
            </div>
            <div class="space-y-1">
              <p class="font-semibold text-text-primary">Sin promociones activas</p>
              <p class="text-sm text-text-muted max-w-xs">
                No hay promociones en curso o planificadas.
              </p>
            </div>
          </div>
        }

        @for (promo of facade.landing(); track promo.id) {
          <div class="bento-banner rounded-xl border border-border bg-surface overflow-hidden">
            <div
              class="flex items-center justify-between gap-4 px-5 py-4 border-b border-border bg-elevated"
            >
              <div class="flex items-center gap-3 min-w-0">
                <app-icon name="graduation-cap" [size]="18" color="var(--ds-brand)" />
                <div class="min-w-0">
                  <h2 class="font-bold text-text-primary text-sm truncate">{{ promo.name }}</h2>
                  <p class="text-xs text-text-muted">{{ promo.code }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]"
                  [class]="promoStatusClass(promo.status)"
                >
                  {{ promoStatusLabel(promo.status) }}
                </span>
                <span class="hidden sm:flex items-center gap-1 text-xs text-text-secondary">
                  <app-icon name="users" [size]="12" />
                  {{ promo.totalAlumnos }}
                </span>
                @if (promo.cursosConfirmados > 0) {
                  <span class="flex items-center gap-1 text-xs text-success font-medium">
                    <app-icon name="check-circle" [size]="12" />
                    {{ promo.cursosConfirmados }}/{{ promo.cursos.length }}
                  </span>
                }
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
              @for (curso of promo.cursos; track curso.promotionCourseId) {
                @let pct =
                  curso.totalAlumnos > 0 ? (curso.alumnosConNotas / curso.totalAlumnos) * 100 : 0;
                <button
                  type="button"
                  class="group flex flex-col gap-3 p-5 bg-surface text-left transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand cursor-pointer"
                  (click)="onCursoSelect(curso.promotionCourseId)"
                  [attr.data-llm-action]="'open-gradebook-' + curso.promotionCourseId"
                  [attr.aria-label]="'Abrir gradebook ' + curso.courseName"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="kpi-value leading-none">{{ curso.courseCode }}</span>
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 border"
                      [class]="estadoBadgeClass(curso.estado)"
                    >
                      <app-icon [name]="estadoBadgeIcon(curso.estado)" [size]="11" />
                      {{ estadoBadgeLabel(curso.estado) }}
                    </span>
                  </div>
                  <p class="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {{ curso.courseName }}
                  </p>
                  <div class="space-y-1 w-full">
                    <div class="h-1.5 w-full rounded-full bg-border overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        [class.bg-brand]="curso.estado !== 'confirmada'"
                        [class.bg-success]="curso.estado === 'confirmada'"
                        [style.width.%]="pct"
                      ></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-text-muted">
                      <span>{{ curso.alumnosConNotas }}/{{ curso.totalAlumnos }} alumnos</span>
                      @if (curso.promedio !== null) {
                        <span
                          class="font-semibold"
                          [class.text-success]="curso.promedio >= gradePass"
                          [class.text-error]="curso.promedio < gradePass"
                          >{{ curso.promedio }}</span
                        >
                      } @else {
                        <span>Sin notas</span>
                      }
                    </div>
                  </div>
                  <div
                    class="flex items-center justify-end text-text-muted group-hover:text-brand transition-colors"
                  >
                    <app-icon name="chevron-right" [size]="14" />
                  </div>
                </button>
              }
              @if (promo.cursos.length === 0) {
                <div
                  class="col-span-full p-8 flex flex-col items-center gap-2 text-center text-text-muted"
                >
                  <app-icon name="book-open" [size]="24" color="var(--text-muted)" />
                  <p class="text-sm">Esta promoción no tiene cursos asignados.</p>
                </div>
              }
            </div>
          </div>
        }
      }

      <!-- Botón volver -->
      @if (facade.grilla() && !facade.isLoading()) {
        <div class="bento-banner flex items-center py-2">
          <button
            class="btn-secondary"
            (click)="voltearAterrizaje()"
            data-llm-action="back-to-landing"
          >
            <app-icon name="chevron-left" [size]="14" />
            Volver al panorama
          </button>
        </div>
      }

      <!-- Skeleton -->
      @if (facade.isLoading()) {
        <div class="bento-banner space-y-2">
          @for (i of skeletonRows; track $index) {
            <app-skeleton-block variant="text" width="100%" height="48px" />
          }
        </div>
      }

      <!-- KPI strip -->
      @if (facade.grilla() && !facade.isLoading()) {
        @let s = stats();
        <div class="bento-banner grid grid-cols-2 lg:grid-cols-4 gap-3">
          <app-stat-box
            label="Alumnos completos"
            [value]="s.alumnosCompletos + ' / ' + s.totalAlumnos"
            icon="users"
            [variant]="
              s.alumnosCompletos === s.totalAlumnos && s.totalAlumnos > 0 ? 'success' : 'default'
            "
          />
          <app-stat-box
            label="Promedio del curso"
            [value]="s.promedioCurso ?? '—'"
            icon="trending-up"
            [variant]="promedioVariant()"
          />
          <app-stat-box
            label="En riesgo"
            [value]="s.enRiesgo"
            icon="alert-triangle"
            [variant]="s.enRiesgo > 0 ? 'error' : 'default'"
          />
          <app-stat-box
            label="Módulos cargados"
            [value]="s.modulosCargados + ' / ' + moduleCount"
            icon="list-checks"
            variant="default"
          />
        </div>
      }

      <!-- Grilla de notas -->
      @if (facade.grilla() && !facade.isLoading()) {
        @let g = facade.grilla()!;
        <div
          class="bento-banner rounded-xl border border-border bg-surface flex flex-col overflow-hidden"
        >
          <!-- Desktop -->
          <div class="gradebook-scroll hidden md:block">
            <table class="gradebook-table w-full text-sm">
              <thead>
                <tr>
                  <th
                    class="col-alumno px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border"
                    style="min-width:220px"
                  >
                    Alumno
                  </th>
                  @for (name of g.moduleNames; track $index) {
                    <th
                      class="px-2 py-2 text-center border-b border-border align-bottom"
                      style="min-width:96px"
                      [title]="name"
                    >
                      <span
                        class="block text-[11px] font-bold uppercase tracking-wider text-text-secondary"
                        >Mod {{ $index + 1 }}</span
                      >
                      <span
                        class="block text-[10px] font-medium text-text-muted truncate max-w-24 mx-auto mt-0.5 normal-case"
                        >{{ name }}</span
                      >
                    </th>
                  }
                  <th
                    class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border"
                    style="min-width:80px"
                  >
                    Progreso
                  </th>
                  <th
                    class="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border"
                    style="min-width:90px"
                  >
                    Promedio
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (fila of g.filas; track fila.enrollmentId; let r = $index) {
                  <tr class="border-b border-border/50 transition-colors hover:bg-subtle">
                    <td class="col-alumno px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div
                          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-brand/10 text-text-primary"
                        >
                          {{ fila.initials }}
                        </div>
                        <div class="min-w-0">
                          <p class="font-bold text-text-primary text-xs truncate">
                            {{ fila.nombre }}
                          </p>
                          <p class="text-[11px] text-text-muted">{{ fila.rut }}</p>
                        </div>
                      </div>
                    </td>
                    @for (nota of fila.notas; track $index; let m = $index) {
                      <td class="grade-cell px-2 py-2 text-center">
                        @if (g.confirmed) {
                          <span
                            class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-bold min-w-14 border"
                            [class]="getReadonlyClasses(nota.passed)"
                          >
                            {{ nota.grade !== null ? nota.grade : '—' }}
                          </span>
                        } @else {
                          <input
                            [id]="'eval-d-' + r + '-' + m"
                            type="number"
                            [ngModel]="nota.grade"
                            (ngModelChange)="onGradeChange(fila.enrollmentId, m, $event)"
                            max="100"
                            min="10"
                            (keydown)="onGradeKeyDown($event, r, m, 'd')"
                            (blur)="onGradeBlur(fila.enrollmentId, m)"
                            placeholder="—"
                            class="w-16 text-center font-bold text-xs px-2 py-1.5 rounded-md border appearance-none outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                            [class]="getInputClasses(nota.grade)"
                            [attr.aria-label]="
                              'Nota módulo ' +
                              (m + 1) +
                              ' (' +
                              g.moduleNames[m] +
                              ') de ' +
                              fila.nombre
                            "
                            data-llm-description="module grade input scale 10 to 100"
                          />
                        }
                      </td>
                    }
                    <td class="px-3 py-2 text-center">
                      <span
                        class="text-[11px] font-semibold"
                        [class.text-success]="modulosCompletos(fila) === moduleCount"
                        [class.text-text-muted]="modulosCompletos(fila) !== moduleCount"
                        >{{ modulosCompletos(fila) }}/{{ moduleCount }}</span
                      >
                    </td>
                    <td class="px-4 py-2 text-right">
                      @if (fila.promedio !== null) {
                        <span
                          class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold border"
                          [class]="getPromedioClasses(fila.promedioAprobado)"
                          >{{ fila.promedio }}</span
                        >
                      } @else {
                        <span class="text-text-muted inline-block w-full text-center">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Móvil -->
          <div class="md:hidden divide-y divide-border">
            @for (fila of g.filas; track fila.enrollmentId; let r = $index) {
              <div class="p-4 space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-brand/10 text-text-primary"
                    >
                      {{ fila.initials }}
                    </div>
                    <div class="min-w-0">
                      <p class="font-bold text-text-primary text-sm truncate">{{ fila.nombre }}</p>
                      <p class="text-[11px] text-text-muted">{{ fila.rut }}</p>
                    </div>
                  </div>
                  @if (fila.promedio !== null) {
                    <span
                      class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold border shrink-0"
                      [class]="getPromedioClasses(fila.promedioAprobado)"
                      >{{ fila.promedio }}</span
                    >
                  } @else {
                    <span class="text-text-muted text-xs shrink-0">Sin promedio</span>
                  }
                </div>
                <div class="flex items-center gap-2 text-[11px] text-text-muted">
                  <app-icon name="list-checks" [size]="13" />
                  <span
                    [class.text-success]="modulosCompletos(fila) === moduleCount"
                    [class.font-semibold]="modulosCompletos(fila) === moduleCount"
                    >{{ modulosCompletos(fila) }} de {{ moduleCount }} módulos</span
                  >
                </div>
                <div class="grid grid-cols-2 gap-2">
                  @for (nota of fila.notas; track $index; let m = $index) {
                    <div
                      class="flex items-center justify-between gap-2 rounded-lg border border-border bg-elevated px-3 py-2"
                    >
                      <div class="min-w-0">
                        <p class="text-[11px] font-bold text-text-secondary">Mod {{ m + 1 }}</p>
                        <p class="text-[10px] text-text-muted truncate">{{ g.moduleNames[m] }}</p>
                      </div>
                      @if (g.confirmed) {
                        <span
                          class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-bold min-w-12 border shrink-0"
                          [class]="getReadonlyClasses(nota.passed)"
                          >{{ nota.grade !== null ? nota.grade : '—' }}</span
                        >
                      } @else {
                        <input
                          [id]="'eval-m-' + r + '-' + m"
                          type="number"
                          [ngModel]="nota.grade"
                          (ngModelChange)="onGradeChange(fila.enrollmentId, m, $event)"
                          max="100"
                          min="10"
                          (keydown)="onGradeKeyDown($event, r, m, 'm')"
                          (blur)="onGradeBlur(fila.enrollmentId, m)"
                          placeholder="—"
                          class="w-14 text-center font-bold text-xs px-2 py-1.5 rounded-md border appearance-none outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors shrink-0"
                          [class]="getInputClasses(nota.grade)"
                          [attr.aria-label]="
                            'Nota módulo ' +
                            (m + 1) +
                            ' (' +
                            g.moduleNames[m] +
                            ') de ' +
                            fila.nombre
                          "
                          data-llm-description="module grade input scale 10 to 100"
                        />
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Leyenda -->
          <div
            class="px-4 py-3 bg-elevated border-t border-border flex items-center gap-4 text-xs font-medium text-text-secondary flex-wrap"
          >
            <span class="flex items-center gap-1.5"
              ><span class="h-2 w-2 rounded-full bg-success"></span> Aprobado (≥{{
                gradePass
              }})</span
            >
            <span class="flex items-center gap-1.5"
              ><span class="h-2 w-2 rounded-full bg-error"></span> Reprobado (&lt;{{
                gradePass
              }})</span
            >
            @if (!g.confirmed) {
              <span class="flex items-center gap-1.5 text-text-muted"
                ><app-icon name="keyboard" [size]="14" /> Enter baja · Tab avanza</span
              >
            }
          </div>

          <!-- Acciones -->
          @if (!g.confirmed) {
            <div
              class="px-4 py-3 border-t border-border flex items-center justify-end gap-3 flex-wrap"
            >
              <button
                class="btn-secondary"
                [disabled]="facade.isSaving() || !facade.hayDirty()"
                [title]="!facade.hayDirty() ? 'No hay cambios para guardar' : 'Guardar borrador'"
                (click)="guardarBorrador()"
                data-llm-action="save-draft-grades"
              >
                <app-icon name="save" [size]="14" />
                Guardar
              </button>
              <button
                class="btn-primary"
                [disabled]="facade.isSaving() || !todasConNota()"
                [title]="
                  !todasConNota()
                    ? 'Completa todas las notas antes de confirmar'
                    : 'Confirmar notas (irreversible)'
                "
                (click)="confirmarNotas()"
                data-llm-action="confirm-grades"
              >
                <app-icon name="lock" [size]="14" />
                Confirmar Final
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SecretariaProfesionalNotasComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(EvaluacionesProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly confirmModalService = inject(ConfirmModalService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  protected readonly gradePass = GRADE_PASS;
  protected readonly moduleCount = MODULE_COUNT;
  protected readonly skeletonRows = Array.from({ length: 6 });

  protected readonly stats = computed(() => computeGradebookStats(this.facade.grilla()));

  protected readonly promedioVariant = computed<'success' | 'error' | 'default'>(() => {
    const prom = this.stats().promedioCurso;
    if (prom === null) return 'default';
    return prom >= GRADE_PASS ? 'success' : 'error';
  });

  protected readonly heroTitle = computed(
    () => this.facade.grilla()?.courseName ?? 'Calificaciones',
  );

  protected readonly heroSubtitle = computed(() => {
    const g = this.facade.grilla();
    if (!g) return 'Registro de notas por módulo · Escala 10–100 · Mínimo aprobación: 75';
    const plural = g.totalAlumnos === 1 ? 'alumno' : 'alumnos';
    return `Escala 10–100 · aprobación ${GRADE_PASS} · ${g.totalAlumnos} ${plural}`;
  });

  protected readonly heroContextLine = computed(() => this.facade.grilla()?.promotionName ?? '');

  protected readonly heroChips = computed<SectionHeroChip[]>(() => {
    const g = this.facade.grilla();
    if (!g) return [];
    const chips: SectionHeroChip[] = [];
    if (g.confirmed) {
      chips.push({ label: 'Confirmadas', icon: 'lock', style: 'success' });
    } else {
      chips.push({ label: 'En edición', icon: 'edit-3', style: 'warning' });
      if (this.facade.hayDirty()) {
        chips.push({ label: 'Cambios sin guardar', icon: 'circle', style: 'warning' });
      }
    }
    return chips;
  });

  constructor() {
    effect(() => {
      const ready = !this.facade.isLoading();
      const grid = this.bentoGrid()?.nativeElement;
      if (ready && grid) {
        Promise.resolve().then(() => this.gsap.animateBentoGrid(grid));
      }
    });
  }

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    this.facade.loadLanding();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  protected onCursoSelect(promotionCourseId: number): void {
    this.facade.selectCurso(promotionCourseId);
  }

  protected voltearAterrizaje(): void {
    this.facade.cerrarGrilla();
    this.facade.loadLanding();
  }

  protected onGradeChange(
    enrollmentId: number,
    moduleIndex: number,
    value: number | string | null,
  ): void {
    let numValue: number | null;
    if (value === null || value === '') {
      numValue = null;
    } else {
      const n = typeof value === 'number' ? value : Number(value);
      numValue = Number.isNaN(n) ? null : n;
    }
    this.facade.setNota(enrollmentId, moduleIndex, numValue);
  }

  protected modulosCompletos(fila: FilaEvaluacion): number {
    return countModulosCompletos(fila);
  }

  protected estadoBadgeClass(estado: CursoEstado): string {
    switch (estado) {
      case 'confirmada':
        return 'bg-success/10 text-success border-success/30';
      case 'en_edicion':
        return 'bg-warning/10 text-warning-dark border-warning/30';
      default:
        return 'bg-subtle text-text-muted border-border';
    }
  }

  protected estadoBadgeIcon(estado: CursoEstado): string {
    switch (estado) {
      case 'confirmada':
        return 'check-circle';
      case 'en_edicion':
        return 'edit-3';
      default:
        return 'clock';
    }
  }

  protected estadoBadgeLabel(estado: CursoEstado): string {
    switch (estado) {
      case 'confirmada':
        return 'Confirmada';
      case 'en_edicion':
        return 'En edición';
      default:
        return 'Sin iniciar';
    }
  }

  protected promoStatusClass(status: string): string {
    return status === 'in_progress'
      ? 'bg-brand/10 text-brand border border-brand/20 font-medium'
      : 'bg-subtle text-text-muted border border-border';
  }

  protected promoStatusLabel(status: string): string {
    return status === 'in_progress' ? 'En curso' : 'Planificada';
  }

  protected getInputClasses(grade: number | null): string {
    if (grade === null) return 'bg-surface border-border text-text-primary';
    return grade >= this.gradePass
      ? 'bg-success/10 text-success-dark border-success/30'
      : 'bg-error/10 text-error-dark border-error/30';
  }

  protected getReadonlyClasses(passed: boolean | null): string {
    if (passed === true) return 'bg-success/15 text-success border-success/20';
    if (passed === false) return 'bg-error/15 text-error border-error/20';
    return 'bg-surface border-border text-text-muted';
  }

  protected getPromedioClasses(passed: boolean | null): string {
    if (passed === true) return 'bg-success text-white border-success-dark';
    if (passed === false) return 'bg-error text-white border-error-dark';
    return 'bg-border text-text-secondary border-border-subtle';
  }

  protected todasConNota(): boolean {
    const g = this.facade.grilla();
    if (!g) return false;
    return g.filas.every((f) => f.notas.every((n) => n.grade !== null));
  }

  protected onGradeBlur(enrollmentId: number, moduleIndex: number): void {
    this.facade.corregirNotaMinima(enrollmentId, moduleIndex);
  }

  protected onGradeKeyDown(
    event: KeyboardEvent,
    rowIndex: number,
    moduleIndex: number,
    surface: 'd' | 'm',
  ): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.focusCell(rowIndex + 1, moduleIndex, surface);
      return;
    }
    const allowed = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const preview = input.value.slice(0, start) + event.key + input.value.slice(end);
    if (preview.length > 3) event.preventDefault();
  }

  private focusCell(rowIndex: number, moduleIndex: number, surface: 'd' | 'm'): void {
    const next = document.getElementById(`eval-${surface}-${rowIndex}-${moduleIndex}`);
    if (next instanceof HTMLInputElement) {
      next.focus();
      next.select();
    }
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
    if (confirmed) this.facade.confirmarNotas();
  }
}
