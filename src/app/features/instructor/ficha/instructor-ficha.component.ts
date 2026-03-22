import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-instructor-ficha',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, IconComponent, EmptyStateComponent],
  template: `
    <div class="px-6 py-6 pb-20 max-w-5xl mx-auto space-y-6">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-sm text-text-muted">
        <a
          routerLink="/app/instructor/alumnos"
          class="hover:text-text-primary flex items-center gap-1"
        >
          <app-icon name="arrow-left" [size]="14" />
          Mis Alumnos
        </a>
        <span>/</span>
        <span class="text-text-primary font-medium">Ficha Técnica</span>
      </div>

      @if (facade.detailLoading()) {
        <div class="flex justify-center p-12">
          <app-icon
            name="loader-2"
            [size]="32"
            style="color: var(--color-primary)"
            class="animate-spin"
          />
        </div>
      } @else if (facade.error()) {
        <div
          class="card p-4 flex items-start gap-3"
          style="background: var(--state-error-bg); color: var(--state-error)"
        >
          <app-icon name="alert-circle" [size]="20" class="mt-0.5 shrink-0" />
          <p class="text-sm">{{ facade.error() }}</p>
        </div>
      } @else if (facade.studentDetail(); as detail) {
        <!-- Header -->
        <div>
          <h2 class="text-2xl font-bold text-text-primary">{{ detail.name }}</h2>
          <p class="text-sm text-text-muted mt-1">{{ detail.courseName }}</p>
        </div>

        <!-- 3-Card Grid: Info + Prácticas + Teóricas -->
        <div class="grid lg:grid-cols-3 gap-6">
          <!-- Info Personal -->
          <div class="card p-6">
            <h3 class="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
              Información del Alumno
            </h3>
            <div class="space-y-3">
              <div>
                <span class="block text-xs text-text-muted uppercase tracking-wider">RUT</span>
                <span class="block text-sm font-medium text-text-primary mt-0.5">{{
                  detail.rut
                }}</span>
              </div>
              @if (detail.email) {
                <div>
                  <span class="block text-xs text-text-muted uppercase tracking-wider">Email</span>
                  <span class="block text-sm font-medium text-text-primary mt-0.5 break-all">{{
                    detail.email
                  }}</span>
                </div>
              }
              @if (detail.phone) {
                <div>
                  <span class="block text-xs text-text-muted uppercase tracking-wider"
                    >Teléfono</span
                  >
                  <span class="block text-sm font-medium text-text-primary mt-0.5">{{
                    detail.phone
                  }}</span>
                </div>
              }
              <div>
                <span class="block text-xs text-text-muted uppercase tracking-wider">Curso</span>
                <span class="block text-sm font-medium text-text-primary mt-0.5">{{
                  detail.courseName
                }}</span>
              </div>
            </div>
          </div>

          <!-- Clases Prácticas -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-base font-semibold text-text-primary">Clases Prácticas</h3>
                <p class="text-xs text-text-muted mt-0.5">
                  De {{ detail.totalSessions }} clases requeridas
                </p>
              </div>
              <span
                class="kpi-value"
                style="color: var(--ds-brand); font-size: 2rem; line-height: 1"
                >{{
                  detail.totalSessions > 0
                    ? ((detail.practiceProgress / detail.totalSessions) * 100 | number: '1.0-0')
                    : 0
                }}%</span
              >
            </div>
            <div class="w-full bg-divider rounded-full h-5 overflow-hidden mb-3">
              <div
                class="h-full bg-brand-primary rounded-full flex items-center justify-end px-3 transition-all"
                [style.width.%]="
                  detail.totalSessions > 0
                    ? (detail.practiceProgress / detail.totalSessions) * 100
                    : 0
                "
              >
                @if (detail.practiceProgress > 0) {
                  <span class="text-xs font-semibold text-white"
                    >{{ detail.practiceProgress }}/{{ detail.totalSessions }}</span
                  >
                }
              </div>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-text-muted">{{ detail.practiceProgress }} completadas</span>
              <span class="font-semibold text-text-primary"
                >{{ detail.totalSessions - detail.practiceProgress }} restantes</span
              >
            </div>
          </div>

          <!-- Clases Teóricas -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-base font-semibold text-text-primary">Clases Teóricas</h3>
                <p class="text-xs text-text-muted mt-0.5">Asistencia a módulos teóricos</p>
              </div>
              <span
                class="kpi-value"
                style="color: var(--state-success); font-size: 2rem; line-height: 1"
                >{{ detail.theoryPercent }}%</span
              >
            </div>
            <div class="w-full bg-divider rounded-full h-5 overflow-hidden mb-3">
              <div
                class="h-full rounded-full flex items-center justify-end px-3 transition-all"
                style="background: var(--state-success)"
                [style.width.%]="detail.theoryPercent"
              >
                @if (detail.theoryPercent > 0) {
                  <span class="text-xs font-semibold text-white">{{ detail.theoryPercent }}%</span>
                }
              </div>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-text-muted">% asistencia</span>
              <span
                class="font-semibold"
                [style.color]="
                  detail.theoryPercent >= 75 ? 'var(--state-success)' : 'var(--state-warning)'
                "
                >{{ detail.theoryPercent >= 75 ? 'Aprobada' : 'En curso' }}</span
              >
            </div>
          </div>
        </div>

        <!-- Ficha Técnica -->
        <div class="card p-0 overflow-hidden">
          <div class="px-6 py-4 border-b border-divider">
            <h3 class="text-lg font-bold text-text-primary">Ficha Técnica — Clases Prácticas</h3>
            <p class="text-sm text-text-muted mt-0.5">
              Registro detallado de las {{ detail.totalSessions }} clases prácticas del alumno
            </p>
          </div>

          <!-- Desktop Table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr
                  class="border-b border-divider text-xs text-text-muted uppercase tracking-wider"
                  style="background: var(--bg-subtle)"
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
              <tbody class="divide-y divide-divider align-top text-sm">
                @for (row of detail.fichaTecnica; track row.classNumber) {
                  <tr
                    class="transition-colors"
                    [class.hover:bg-surface-hover]="!!row.date"
                    [class.bg-surface]="!row.date"
                  >
                    <td class="p-4 w-14">
                      <div
                        class="w-8 h-8 rounded bg-brand-muted text-brand-primary flex items-center justify-center font-bold"
                      >
                        {{ row.classNumber }}
                      </div>
                    </td>
                    <td class="p-4 whitespace-nowrap">
                      @if (row.date) {
                        <span class="text-text-primary font-medium font-mono text-xs">{{
                          row.date | date: 'dd/MM/yyyy'
                        }}</span>
                      } @else {
                        <span class="text-text-muted italic">-</span>
                      }
                    </td>
                    <td class="p-4 whitespace-nowrap text-text-muted font-mono text-xs">
                      @if (row.date) {
                        {{ row.date | date: 'HH:mm' }}
                      } @else {
                        -
                      }
                    </td>
                    <td class="p-4 text-text-muted text-xs">{{ row.instructorName || '-' }}</td>
                    <td class="p-4 text-right text-text-muted font-mono text-xs">
                      {{ row.kmStart ?? '-' }}
                    </td>
                    <td class="p-4 text-right text-text-muted font-mono text-xs">
                      {{ row.kmEnd ?? '-' }}
                    </td>
                    <td class="p-4 text-xs text-text-muted max-w-xs">
                      @if (row.notes) {
                        {{ row.notes }}
                      } @else {
                        <span class="italic">Pendiente</span>
                      }
                    </td>
                    <td class="p-4 text-center w-28">
                      @if (row.status === 'completed') {
                        <span
                          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style="background: var(--state-success-bg); color: var(--state-success)"
                          >Completada</span
                        >
                      } @else if (row.status === 'in_progress') {
                        <span
                          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium animate-pulse"
                          style="background: var(--state-warning-bg); color: var(--state-warning)"
                          >En Curso</span
                        >
                      } @else if (row.status === 'scheduled') {
                        <span
                          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-muted text-brand-primary"
                          >Agendada</span
                        >
                      } @else if (row.status === 'cancelled' || row.status === 'no_show') {
                        <span
                          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface text-text-muted"
                          >Cancelada</span
                        >
                      } @else {
                        <span
                          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface text-text-muted"
                          >Pendiente</span
                        >
                      }
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
                          class="text-xs font-medium hover:underline"
                          style="color: var(--ds-brand)"
                          data-llm-action="evaluate-class"
                        >
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
                          class="text-xs font-medium text-text-muted hover:text-text-primary hover:underline"
                        >
                          Ver
                        </a>
                      } @else {
                        <span class="text-xs text-text-muted">-</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile List -->
          <div class="md:hidden divide-y divide-divider">
            @for (row of detail.fichaTecnica; track row.classNumber) {
              <div class="p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded bg-brand-muted text-brand-primary flex items-center justify-center font-bold text-lg"
                    >
                      {{ row.classNumber }}
                    </div>
                    <div>
                      @if (row.date) {
                        <span class="text-sm font-semibold text-text-primary block">{{
                          row.date | date: 'dd MMM yyyy'
                        }}</span>
                        <span class="text-xs text-text-muted">{{ row.date | date: 'HH:mm' }}</span>
                      } @else {
                        <span class="text-sm text-text-muted italic block">No agendada</span>
                      }
                    </div>
                  </div>
                  @if (row.grade) {
                    <div
                      class="flex items-center gap-1 font-bold text-lg"
                      [style.color]="row.grade >= 4 ? 'var(--state-success)' : 'var(--state-error)'"
                    >
                      <app-icon name="star" [size]="16" /> {{ row.grade }}
                    </div>
                  }
                </div>

                <div
                  class="grid grid-cols-2 gap-2 text-xs text-text-muted bg-surface-hover p-2 rounded"
                >
                  <div>
                    <span class="block uppercase tracking-wider font-semibold opacity-70 mb-0.5"
                      >Kilómetros</span
                    >
                    <span>{{ row.kmStart ?? '-' }} → {{ row.kmEnd ?? '-' }}</span>
                  </div>
                  <div>
                    <span class="block uppercase tracking-wider font-semibold opacity-70 mb-0.5"
                      >Instructor</span
                    >
                    <span class="truncate block">{{ row.instructorName || '-' }}</span>
                  </div>
                  @if (row.notes) {
                    <div class="col-span-2">
                      <span class="block uppercase tracking-wider font-semibold opacity-70 mb-0.5"
                        >Observaciones</span
                      >
                      <span>{{ row.notes }}</span>
                    </div>
                  }
                </div>

                <div class="pt-2">
                  @if (row.canEvaluate) {
                    <a
                      [routerLink]="[
                        '/app/instructor/alumnos',
                        detail.studentId,
                        'evaluacion',
                        row.sessionId,
                      ]"
                      class="btn btn-primary btn-sm w-full justify-center"
                      data-llm-action="evaluate-class"
                      >Evaluar Clase</a
                    >
                  } @else if (row.status === 'completed') {
                    <a
                      [routerLink]="[
                        '/app/instructor/alumnos',
                        detail.studentId,
                        'evaluacion',
                        row.sessionId,
                      ]"
                      class="btn btn-outline btn-sm w-full justify-center"
                      >Ver Detalles</a
                    >
                  } @else if (row.status === 'in_progress') {
                    <span
                      class="flex items-center px-2 py-1.5 rounded text-xs font-medium w-full justify-center animate-pulse"
                      style="background: var(--state-warning-bg); color: var(--state-warning)"
                      >En Curso</span
                    >
                  } @else {
                    <span
                      class="flex items-center px-2 py-1.5 rounded text-xs font-medium bg-brand-muted text-brand-primary w-full justify-center"
                      >Pendiente</span
                    >
                  }
                </div>
              </div>
            }
          </div>

          <!-- Nota informativa -->
          <div
            class="mx-6 my-4 p-3 rounded-lg border"
            style="background: var(--state-info-bg); border-color: var(--state-info)"
          >
            <p class="text-xs" style="color: var(--state-info)">
              <strong>Nota:</strong> Puedes evaluar las clases pendientes haciendo clic en
              "Evaluar". Las clases completadas se pueden revisar con "Ver".
            </p>
          </div>
        </div>
      } @else {
        <app-empty-state
          icon="user-x"
          message="Alumno no encontrado"
          subtitle="No se encontró la ficha técnica solicitada."
          actionLabel="Volver a mis alumnos"
          actionIcon="arrow-left"
        />
      }
    </div>
  `,
})
export class InstructorFichaComponent implements OnInit {
  public facade = inject(InstructorAlumnosFacade);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const idStr = params['id'];
      if (idStr) {
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          this.facade.loadStudentDetail(id);
        }
      }
    });
  }
}
