import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';

import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-ficha',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    IconComponent,
    EmptyStateComponent,
    AlertCardComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout>
      <!-- ── Error ── -->
      @if (facade.error()) {
        <div class="bento-banner">
          <app-alert-card title="No se pudo cargar la ficha" severity="error" [dismissible]="false">
            {{ facade.error() }}
          </app-alert-card>
        </div>

        <!-- ── Sin datos (carga completada) ── -->
      } @else if (!facade.detailLoading() && !facade.studentDetail()) {
        <div class="bento-banner">
          <app-empty-state
            icon="user-x"
            message="Alumno no encontrado"
            subtitle="No se encontró la ficha técnica solicitada."
            actionLabel="Volver a mis alumnos"
            actionIcon="arrow-left"
            (action)="goBack()"
          />
        </div>

        <!-- ── Layout con skeletons inline ── -->
      } @else {
        <!-- Hero — direct child → bento-hero host class aplica grid span -->
        @if (facade.detailLoading()) {
          <div class="bento-banner">
            <app-skeleton-block variant="rect" width="100%" height="120px" />
          </div>
        } @else if (facade.studentDetail(); as detail) {
          <app-section-hero
            [contextLine]="heroContextLine"
            [title]="detail.name"
            [subtitle]="detail.courseName"
            [chips]="heroChips()"
            [actions]="heroActions"
            backRoute="/app/instructor/alumnos"
            backLabel="Mis Alumnos"
          />
        }

        <!-- ── Contenido principal ── -->
        <div class="bento-banner">
          <div class="flex flex-col gap-6">
            <!-- 3-Card Grid — skeleton inline -->
            <div class="grid md:grid-cols-3 gap-4">
              @if (facade.detailLoading()) {
                <app-skeleton-block variant="rect" width="100%" height="160px" />
                <app-skeleton-block variant="rect" width="100%" height="160px" />
                <app-skeleton-block variant="rect" width="100%" height="160px" />
              } @else if (facade.studentDetail(); as detail) {
                <!-- Info Personal -->
                <div class="card">
                  <h3 class="kpi-label mb-4">Información del Alumno</h3>
                  <div class="space-y-3">
                    <div>
                      <span class="kpi-label">RUT</span>
                      <span
                        class="block text-sm font-medium mt-1"
                        [style.color]="'var(--text-primary)'"
                        >{{ detail.rut }}</span
                      >
                    </div>
                    @if (detail.email) {
                      <div>
                        <span class="kpi-label">Email</span>
                        <span
                          class="block text-sm font-medium mt-1 break-all"
                          [style.color]="'var(--text-primary)'"
                          >{{ detail.email }}</span
                        >
                      </div>
                    }
                    @if (detail.phone) {
                      <div>
                        <span class="kpi-label">Teléfono</span>
                        <span
                          class="block text-sm font-medium mt-1"
                          [style.color]="'var(--text-primary)'"
                          >{{ detail.phone }}</span
                        >
                      </div>
                    }
                    <div>
                      <span class="kpi-label">Curso</span>
                      <span
                        class="block text-sm font-medium mt-1"
                        [style.color]="'var(--text-primary)'"
                        >{{ detail.courseName }}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Clases Prácticas -->
                <div class="card">
                  <div class="flex items-start justify-between mb-4">
                    <div class="min-w-0 flex-1 mr-3">
                      <h3 class="text-base font-semibold" [style.color]="'var(--text-primary)'">
                        Clases Prácticas
                      </h3>
                      <p class="text-xs mt-0.5" [style.color]="'var(--text-muted)'">
                        De {{ detail.totalSessions }} requeridas
                      </p>
                    </div>
                    <span
                      class="kpi-value shrink-0"
                      style="color: var(--ds-brand); font-size: 2rem; line-height: 1"
                    >
                      {{
                        detail.totalSessions > 0
                          ? ((detail.practiceProgress / detail.totalSessions) * 100
                            | number: '1.0-0')
                          : 0
                      }}%
                    </span>
                  </div>
                  <div
                    class="w-full rounded-full h-3 overflow-hidden mb-3"
                    style="background: var(--bg-subtle)"
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      style="background: var(--ds-brand)"
                      [style.width.%]="
                        detail.totalSessions > 0
                          ? (detail.practiceProgress / detail.totalSessions) * 100
                          : 0
                      "
                    ></div>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span [style.color]="'var(--text-muted)'"
                      >{{ detail.practiceProgress }} completadas</span
                    >
                    <span class="font-semibold" [style.color]="'var(--text-primary)'">
                      {{ detail.totalSessions - detail.practiceProgress }} restantes
                    </span>
                  </div>
                </div>

                <!-- Clases Teóricas -->
                <div class="card">
                  <div class="flex items-start justify-between mb-4">
                    <div class="min-w-0 flex-1 mr-3">
                      <h3 class="text-base font-semibold" [style.color]="'var(--text-primary)'">
                        Clases Teóricas
                      </h3>
                      <p class="text-xs mt-0.5" [style.color]="'var(--text-muted)'">
                        Asistencia a módulos teóricos
                      </p>
                    </div>
                    <span
                      class="kpi-value shrink-0"
                      [style.color]="
                        detail.theoryPercent >= 75 ? 'var(--state-success)' : 'var(--state-warning)'
                      "
                      style="font-size: 2rem; line-height: 1"
                    >
                      {{ detail.theoryPercent }}%
                    </span>
                  </div>
                  <div
                    class="w-full rounded-full h-3 overflow-hidden mb-3"
                    style="background: var(--bg-subtle)"
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      [style.background]="
                        detail.theoryPercent >= 75 ? 'var(--state-success)' : 'var(--state-warning)'
                      "
                      [style.width.%]="detail.theoryPercent"
                    ></div>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span [style.color]="'var(--text-muted)'">% asistencia</span>
                    <span
                      class="font-semibold"
                      [style.color]="
                        detail.theoryPercent >= 75 ? 'var(--state-success)' : 'var(--state-warning)'
                      "
                    >
                      {{ detail.theoryPercent >= 75 ? 'Aprobada' : 'En curso' }}
                    </span>
                  </div>
                </div>
              }
            </div>

            <!-- ── Ficha Técnica — skeleton inline ── -->
            @if (facade.detailLoading()) {
              <app-skeleton-block variant="rect" width="100%" height="320px" />
            } @else if (facade.studentDetail(); as detail) {
              <div class="card p-0 overflow-hidden">
                <!-- Cabecera de tabla -->
                <div class="px-4 md:px-6 py-4 border-b" style="border-color: var(--border-subtle)">
                  <h3 class="text-base md:text-lg font-bold" [style.color]="'var(--text-primary)'">
                    Ficha Técnica — Clases Prácticas
                  </h3>
                  <p class="text-sm mt-0.5" [style.color]="'var(--text-muted)'">
                    Registro detallado de las {{ detail.totalSessions }} clases prácticas del alumno
                  </p>
                </div>

                <!-- Desktop: tabla -->
                <div class="hidden md:block overflow-x-auto">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr
                        class="text-xs uppercase tracking-wider border-b"
                        style="background: var(--bg-subtle); border-color: var(--border-subtle); color: var(--text-muted)"
                      >
                        <th class="p-4 font-semibold">N°</th>
                        <th class="p-4 font-semibold">Fecha</th>
                        <th class="p-4 font-semibold">Hora</th>
                        <th class="p-4 font-semibold">Instructor</th>
                        <th class="p-4 font-semibold text-right">Km Inicio</th>
                        <th class="p-4 font-semibold text-right">Km Fin</th>
                        <th class="p-4 font-semibold">Observaciones</th>
                        <th class="p-4 font-semibold text-center">Estado</th>
                        <th class="p-4 font-semibold text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody class="text-sm">
                      @for (row of detail.fichaTecnica; track row.classNumber) {
                        <tr
                          class="border-b transition-colors"
                          style="border-color: var(--border-subtle)"
                          [style.background]="row.date ? '' : 'var(--bg-elevated)'"
                        >
                          <td class="p-4 w-14">
                            <div
                              class="w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm"
                              style="background: var(--color-primary-muted); color: var(--color-primary)"
                            >
                              {{ row.classNumber }}
                            </div>
                          </td>
                          <td class="p-4 whitespace-nowrap">
                            @if (row.date) {
                              <span
                                class="font-medium font-mono text-xs"
                                [style.color]="'var(--text-primary)'"
                              >
                                {{ row.date | date: 'dd/MM/yyyy' }}
                              </span>
                            } @else {
                              <span class="italic" [style.color]="'var(--text-muted)'">-</span>
                            }
                          </td>
                          <td
                            class="p-4 whitespace-nowrap font-mono text-xs"
                            [style.color]="'var(--text-muted)'"
                          >
                            @if (row.date) {
                              {{ row.date | date: 'HH:mm' }}
                            } @else {
                              -
                            }
                          </td>
                          <td class="p-4 text-xs" [style.color]="'var(--text-muted)'">
                            {{ row.instructorName || '-' }}
                          </td>
                          <td
                            class="p-4 text-right font-mono text-xs"
                            [style.color]="'var(--text-muted)'"
                          >
                            {{ row.kmStart ?? '-' }}
                          </td>
                          <td
                            class="p-4 text-right font-mono text-xs"
                            [style.color]="'var(--text-muted)'"
                          >
                            {{ row.kmEnd ?? '-' }}
                          </td>
                          <td class="p-4 text-xs max-w-xs" [style.color]="'var(--text-muted)'">
                            @if (row.notes) {
                              {{ row.notes }}
                            } @else {
                              <span class="italic">Pendiente</span>
                            }
                          </td>
                          <td class="p-4 text-center w-28">
                            <span
                              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                              [attr.style]="getStatusStyle(row.status)"
                            >
                              {{ getStatusLabel(row.status) }}
                            </span>
                          </td>
                          <td class="p-4 text-center w-28">
                            @if (row.canEvaluate) {
                              <a
                                [routerLink]="[
                                  '/app/instructor/alumnos',
                                  detail.studentId,
                                  'evaluacion',
                                  row.sessionId,
                                ]"
                                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                                style="background: var(--ds-brand); color: var(--color-primary-text)"
                                data-llm-action="evaluate-class"
                              >
                                <app-icon name="clipboard-pen" [size]="12" />
                                Evaluar
                              </a>
                            } @else if (row.status === 'completed') {
                              <a
                                [routerLink]="[
                                  '/app/instructor/alumnos',
                                  detail.studentId,
                                  'evaluacion',
                                  row.sessionId,
                                ]"
                                class="text-xs font-medium transition-colors hover:underline"
                                [style.color]="'var(--text-muted)'"
                                >Ver</a
                              >
                            } @else {
                              <span class="text-xs" [style.color]="'var(--text-muted)'">-</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Mobile: lista de tarjetas -->
                <div class="md:hidden divide-y" style="border-color: var(--border-subtle)">
                  @for (row of detail.fichaTecnica; track row.classNumber) {
                    <div class="p-4 space-y-3">
                      <!-- Fila 1: número + fecha + badge -->
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <div
                            class="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                            style="background: var(--color-primary-muted); color: var(--color-primary)"
                          >
                            {{ row.classNumber }}
                          </div>
                          <div class="min-w-0">
                            @if (row.date) {
                              <span
                                class="text-sm font-semibold block"
                                [style.color]="'var(--text-primary)'"
                              >
                                {{ row.date | date: 'dd MMM yyyy' }}
                              </span>
                              <span class="text-xs font-mono" [style.color]="'var(--text-muted)'">{{
                                row.date | date: 'HH:mm'
                              }}</span>
                            } @else {
                              <span class="text-sm italic" [style.color]="'var(--text-muted)'"
                                >No agendada</span
                              >
                            }
                          </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                          @if (row.grade) {
                            <div
                              class="flex items-center gap-1 font-bold text-base"
                              [style.color]="
                                row.grade >= 4 ? 'var(--state-success)' : 'var(--state-error)'
                              "
                            >
                              <app-icon name="star" [size]="14" />
                              {{ row.grade }}
                            </div>
                          }
                          <span
                            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold"
                            [attr.style]="getStatusStyle(row.status)"
                          >
                            {{ getStatusLabel(row.status) }}
                          </span>
                        </div>
                      </div>

                      <!-- Meta grid -->
                      <div
                        class="grid grid-cols-2 gap-2 text-xs p-3 rounded-lg"
                        style="background: var(--bg-elevated)"
                      >
                        <div>
                          <span class="kpi-label block mb-0.5">Kilómetros</span>
                          <span class="font-mono" [style.color]="'var(--text-primary)'">
                            {{ row.kmStart ?? '-' }} → {{ row.kmEnd ?? '-' }}
                          </span>
                        </div>
                        <div>
                          <span class="kpi-label block mb-0.5">Instructor</span>
                          <span class="truncate block" [style.color]="'var(--text-primary)'">{{
                            row.instructorName || '-'
                          }}</span>
                        </div>
                        @if (row.notes) {
                          <div class="col-span-2">
                            <span class="kpi-label block mb-0.5">Observaciones</span>
                            <span [style.color]="'var(--text-primary)'">{{ row.notes }}</span>
                          </div>
                        }
                      </div>

                      <!-- CTA móvil -->
                      @if (row.canEvaluate) {
                        <a
                          [routerLink]="[
                            '/app/instructor/alumnos',
                            detail.studentId,
                            'evaluacion',
                            row.sessionId,
                          ]"
                          class="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                          style="background: var(--ds-brand); color: var(--color-primary-text)"
                          data-llm-action="evaluate-class"
                        >
                          <app-icon name="clipboard-pen" [size]="14" />
                          Evaluar Clase
                        </a>
                      } @else if (row.status === 'completed') {
                        <a
                          [routerLink]="[
                            '/app/instructor/alumnos',
                            detail.studentId,
                            'evaluacion',
                            row.sessionId,
                          ]"
                          class="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold border transition-all"
                          style="border-color: var(--border-default); color: var(--text-secondary)"
                        >
                          <app-icon name="eye" [size]="14" />
                          Ver Detalles
                        </a>
                      } @else if (row.status === 'in_progress') {
                        <span
                          class="indicator-live flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-semibold"
                          style="background: var(--state-warning-bg); color: var(--state-warning)"
                          >En Curso</span
                        >
                      } @else if (row.status === 'scheduled') {
                        <span
                          class="flex items-center justify-center gap-1 w-full py-2 rounded-lg text-xs font-semibold"
                          style="background: var(--color-primary-muted); color: var(--color-primary)"
                        >
                          <app-icon name="calendar-check" [size]="13" />
                          Agendada
                        </span>
                      } @else {
                        <span
                          class="flex items-center justify-center w-full py-2 rounded-lg text-xs"
                          style="background: var(--bg-elevated); color: var(--text-muted)"
                          >Pendiente de agendar</span
                        >
                      }
                    </div>
                  }
                </div>

                <!-- Nota informativa -->
                <div class="p-4">
                  <app-alert-card
                    title="¿Cómo funciona la ficha?"
                    severity="info"
                    [dismissible]="false"
                  >
                    Puedes evaluar las clases completadas haciendo clic en <strong>Evaluar</strong>.
                    Las clases ya evaluadas se pueden revisar con <strong>Ver Detalles</strong>.
                  </app-alert-card>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class InstructorFichaComponent implements OnInit {
  protected readonly facade = inject(InstructorAlumnosFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly heroActions: SectionHeroAction[] = [];
  protected readonly heroContextLine = 'Ficha Técnica del Alumno';

  protected readonly heroChips = computed((): SectionHeroChip[] => {
    const detail = this.facade.studentDetail();
    if (!detail) return [];

    const practicePercent =
      detail.totalSessions > 0
        ? Math.round((detail.practiceProgress / detail.totalSessions) * 100)
        : 0;

    return [
      {
        label: `${practicePercent}% práctico`,
        style: practicePercent >= 80 ? 'success' : 'default',
      },
      {
        label: `${detail.theoryPercent}% teórico`,
        style: detail.theoryPercent >= 75 ? 'success' : 'warning',
      },
    ];
  });

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = parseInt(params['id'], 10);
      if (!isNaN(id)) {
        this.facade.loadStudentDetail(id);
      }
    });
  }

  protected goBack(): void {
    history.back();
  }

  protected getStatusLabel(status: string): string {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'in_progress':
        return 'En Curso';
      case 'scheduled':
        return 'Agendada';
      case 'cancelled':
      case 'no_show':
        return 'Cancelada';
      default:
        return 'Pendiente';
    }
  }

  protected getStatusStyle(status: string): string {
    switch (status) {
      case 'completed':
        return 'background: var(--state-success-bg); color: var(--state-success)';
      case 'in_progress':
        return 'background: var(--state-warning-bg); color: var(--state-warning)';
      case 'scheduled':
        return 'background: var(--color-primary-muted); color: var(--color-primary)';
      default:
        return 'background: var(--bg-subtle); color: var(--text-muted)';
    }
  }
}
