import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import type {
  CertificacionProfesionalAlumnoRow,
  CertificacionProfesionalKpis,
  CertificacionProfesionalLogRow,
  CursoCertOption,
  PromocionCertOption,
} from '@core/models/ui/certificacion-profesional.model';
import { ACCION_LABELS_PROF } from '@core/models/ui/certificacion-profesional.model';

type EstadoFilter = 'todos' | 'generado' | 'pendiente';

/**
 * CertificacionProfesionalContentComponent — Dumb component.
 *
 * Vista de certificación Clase Profesional con selección en cascada:
 *  1. Selector de promoción finalizada (ordenadas por fecha de inicio DESC).
 *  2. Selector de curso (habilitado tras elegir promoción).
 *  3. KPIs + tabla de alumnos (visibles tras elegir curso).
 *  4. Confirmation inline si práctica < 100 % (criterio flexible).
 *  5. Historial de emisiones (log).
 */
@Component({
  selector: 'app-certificacion-profesional-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    IconComponent,
    EmptyStateComponent,
  ],
  template: `
    <!-- ── Section Hero ──────────────────────────────────────────────── -->
    <app-section-hero
      title="Certificados Clase Profesional"
      subtitle="Certificación de finalización — Escuela de Conductores Profesionales"
      icon="shield-check"
      [actions]="heroActions"
      variant="compact"
    />

    <div class="flex flex-col gap-6 p-4 md:p-6">
      <!-- ── Selección en cascada ───────────────────────────────────── -->
      <div class="card flex flex-wrap items-end gap-4">
        <!-- Selector de Promoción -->
        <div class="flex flex-col gap-1.5 min-w-55 flex-1">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted">
            Promoción
          </label>
          @if (isLoading()) {
            <app-skeleton-block variant="rect" width="100%" height="38px" />
          } @else {
            <p-select
              [options]="promociones()"
              [ngModel]="selectedPromocionId()"
              (ngModelChange)="promocionSelected.emit($event)"
              optionLabel="label"
              optionValue="id"
              placeholder="Selecciona una promoción..."
              [showClear]="true"
              styleClass="w-full"
              [style]="{ height: '40px' }"
              data-llm-description="Selector de promoción de clase profesional finalizada"
            />
          }
        </div>

        <!-- Selector de Curso -->
        <div class="flex flex-col gap-1.5 min-w-50 flex-1">
          <label
            class="text-xs font-semibold uppercase tracking-wider"
            [class.text-muted]="!selectedPromocionId()"
          >
            Curso
          </label>
          @if (isLoading()) {
            <app-skeleton-block variant="rect" width="100%" height="38px" />
          } @else {
            <p-select
              [options]="cursos()"
              [ngModel]="selectedCursoId()"
              (ngModelChange)="cursoSelected.emit($event)"
              optionLabel="label"
              optionValue="id"
              placeholder="Selecciona un curso..."
              [disabled]="!selectedPromocionId()"
              [showClear]="true"
              styleClass="w-full"
              [style]="{ height: '40px' }"
              data-llm-description="Selector de curso dentro de la promoción seleccionada"
            />
          }
        </div>
      </div>

      <!-- ── Estado: sin promoción seleccionada ────────────────────── -->
      @if (!selectedPromocionId()) {
        <div class="card p-8">
          <app-empty-state
            icon="filter"
            message="Selecciona una promoción"
            subtitle="Elige una promoción finalizada para ver sus cursos y alumnos"
          />
        </div>

        <!-- ── Estado: promoción seleccionada, sin curso ─────────────── -->
      } @else if (!selectedCursoId()) {
        <div class="card p-8">
          <app-empty-state
            icon="book-open"
            message="Selecciona un curso"
            subtitle="Elige un curso de la promoción para cargar los alumnos"
          />
        </div>

        <!-- ── Contenido principal (curso seleccionado) ───────────────── -->
      } @else {
        <!-- ── KPIs ──────────────────────────────────────────────────── -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <app-kpi-card-variant
            label="Total Alumnos"
            [value]="kpis()?.totalAlumnos ?? 0"
            icon="graduation-cap"
            [loading]="isLoadingAlumnos()"
          />
          <app-kpi-card-variant
            label="Certificados Generados"
            [value]="kpis()?.certificadosGenerados ?? 0"
            icon="check-circle"
            color="success"
            [loading]="isLoadingAlumnos()"
          />
          <app-kpi-card-variant
            label="Pendientes Generación"
            [value]="kpis()?.pendientesGeneracion ?? 0"
            icon="clock"
            color="warning"
            [loading]="isLoadingAlumnos()"
          />
          <app-kpi-card-variant
            label="Pendientes Envío"
            [value]="kpis()?.pendientesEnvio ?? 0"
            icon="mail"
            [loading]="isLoadingAlumnos()"
          />
        </div>

        <!-- ── Toolbar ────────────────────────────────────────────────── -->
        <div class="flex flex-wrap items-center gap-3">
          @if (pendientesCount() > 0) {
            <button
              class="btn-primary flex items-center gap-2 text-sm"
              data-llm-action="generate-pending-professional-certificates"
              (click)="generarPendientes.emit()"
            >
              <app-icon name="file-check" [size]="16" />
              Generar Pendientes ({{ pendientesCount() }})
            </button>
          }

          <button
            class="btn-secondary text-sm"
            data-llm-action="send-bulk-emails-professional"
            (click)="enviarEmailsMasivo.emit()"
          >
            <app-icon name="send" [size]="16" />
            Enviar Emails Masivo
          </button>

          <p-select
            [options]="estadoOptions"
            [ngModel]="estadoFilter()"
            (ngModelChange)="estadoFilter.set($event)"
            optionLabel="label"
            optionValue="value"
            class="h-9"
            data-llm-description="Filter professional certificates by status"
          />

          <button
            class="btn-secondary text-sm ml-auto"
            data-llm-action="export-professional-certificates"
            (click)="exportar.emit()"
          >
            <app-icon name="download" [size]="16" />
            Exportar
          </button>
        </div>

        <!-- ── Tabla principal ────────────────────────────────────────── -->
        <div class="card overflow-hidden">
          @if (isLoadingAlumnos()) {
            <div class="p-6 flex flex-col gap-4">
              @for (_ of skeletonRows; track $index) {
                <app-skeleton-block variant="text" width="100%" height="48px" />
              }
            </div>
          } @else if (filteredAlumnos().length === 0) {
            <div class="p-8">
              <app-empty-state
                icon="shield-check"
                message="No hay alumnos en este curso"
                subtitle="Los alumnos con promoción finalizada aparecerán aquí con su estado de certificación"
              />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-(--border-default)">
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Alumno
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      RUT
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Promoción
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                      title="Asistencia a clases teóricas (mínimo 75%)"
                    >
                      Teoría
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                      title="Asistencia a clases prácticas (recomendado 100%)"
                    >
                      Práctica
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                      title="Promedio de módulos (mínimo 75 en escala MTT)"
                    >
                      Nota Prom.
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                      title="Saldo pendiente de pago"
                    >
                      Pago
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Estado
                    </th>
                    <th
                      class="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (alumno of filteredAlumnos(); track alumno.enrollmentId) {
                    <!-- Fila principal -->
                    <tr
                      class="border-b border-(--border-default) last:border-b-0 transition-colors"
                      [class.bg-[var(--bg-subtle)]]="pendingConfirmId() === alumno.enrollmentId"
                    >
                      <td class="px-4 py-3 font-medium text-primary">
                        {{ alumno.nombre }}
                      </td>
                      <td class="px-4 py-3" style="color: var(--color-primary)">
                        {{ alumno.rut }}
                      </td>
                      <td class="px-4 py-3 text-xs text-muted max-w-40 truncate">
                        {{ alumno.promocion }}
                      </td>
                      <!-- Teoría -->
                      <td class="px-4 py-3 text-center">
                        @if (alumno.pctAsistenciaTeoria === null) {
                          <span class="text-xs text-muted">Sin registro</span>
                        } @else {
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            [style.background]="getTeoriaBg(alumno.pctAsistenciaTeoria)"
                            [style.color]="getTeoriaColor(alumno.pctAsistenciaTeoria)"
                          >
                            @if (!alumno.elegibilidad.teoria) {
                              <app-icon name="alert-triangle" [size]="11" />
                            }
                            {{ alumno.pctAsistenciaTeoria }}%
                          </span>
                        }
                      </td>
                      <!-- Práctica -->
                      <td class="px-4 py-3 text-center">
                        @if (alumno.pctAsistenciaPractica === null) {
                          <span class="text-xs text-muted">Sin registro</span>
                        } @else {
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            [style.background]="getPracticaBg(alumno.pctAsistenciaPractica)"
                            [style.color]="getPracticaColor(alumno.pctAsistenciaPractica)"
                          >
                            @if (alumno.pctAsistenciaPractica < 100) {
                              <app-icon name="alert-circle" [size]="11" />
                            }
                            {{ alumno.pctAsistenciaPractica }}%
                          </span>
                        }
                      </td>
                      <!-- Nota promedio -->
                      <td class="px-4 py-3 text-center">
                        @if (alumno.notaPromedio === null) {
                          <span class="text-xs text-muted">Sin notas</span>
                        } @else {
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            [style.background]="getNotaBg(alumno.notaPromedio)"
                            [style.color]="getNotaColor(alumno.notaPromedio)"
                          >
                            @if (!alumno.elegibilidad.nota) {
                              <app-icon name="x-circle" [size]="11" />
                            }
                            {{ alumno.notaPromedio | number: '1.1-1' }}
                          </span>
                        }
                      </td>
                      <!-- Pago -->
                      <td class="px-4 py-3 text-center">
                        @if (alumno.pagoCorrecto) {
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style="background: var(--bg-success-muted, rgba(34,197,94,0.1)); color: var(--state-success)"
                          >
                            <app-icon name="check" [size]="11" />
                            Al día
                          </span>
                        } @else {
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style="background: var(--bg-warning-muted, rgba(234,179,8,0.1)); color: var(--state-warning)"
                          >
                            <app-icon name="alert-triangle" [size]="11" />
                            Pendiente
                          </span>
                        }
                      </td>
                      <!-- Estado certificado -->
                      <td class="px-4 py-3 text-center">
                        @if (alumno.certificadoStatus === 'generado') {
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style="background: var(--bg-success-muted, rgba(34,197,94,0.1)); color: var(--state-success)"
                          >
                            <app-icon name="check" [size]="12" />
                            Generado
                          </span>
                        } @else {
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style="background: var(--bg-warning-muted, rgba(234,179,8,0.1)); color: var(--state-warning)"
                          >
                            Pendiente
                          </span>
                        }
                      </td>
                      <!-- Acciones -->
                      <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                          @if (alumno.certificadoStatus === 'pendiente') {
                            <button
                              class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                              data-llm-action="generate-professional-certificate"
                              [disabled]="generatingId() !== null || !alumno.elegible"
                              [title]="
                                !alumno.elegible ? 'El alumno no cumple todos los requisitos' : ''
                              "
                              (click)="onClickGenerar(alumno)"
                            >
                              @if (generatingId() === alumno.enrollmentId) {
                                <app-icon name="loader-2" [size]="12" class="animate-spin" />
                                Generando...
                              } @else {
                                <span class="group-hover:hidden flex items-center gap-1.5">
                                  <app-icon name="file-check" [size]="12" />
                                  Generar
                                </span>
                                <span class="hidden group-hover:flex items-center gap-1.5">
                                  <app-icon name="mouse-pointer-click" [size]="12" />
                                  Generar
                                </span>
                              }
                            </button>
                          } @else {
                            <button
                              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors btn-secondary"
                              data-llm-action="view-professional-certificate-pdf"
                              (click)="
                                verCertificado.emit({
                                  storagePath: alumno.storagePath!,
                                  nombre: alumno.nombre,
                                })
                              "
                            >
                              <app-icon name="eye" [size]="13" />
                              Ver
                            </button>
                            <button
                              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors btn-secondary opacity-60 cursor-not-allowed"
                              data-llm-action="send-professional-certificate-email"
                              disabled
                              title="Próximamente"
                            >
                              <app-icon name="mail" [size]="13" />
                              Email
                            </button>
                          }
                        </div>
                      </td>
                    </tr>

                    <!-- Fila de confirmación inline — práctica < 100 % -->
                    @if (pendingConfirmId() === alumno.enrollmentId) {
                      <tr class="border-b border-(--border-default)">
                        <td colspan="9" class="px-4 pb-4 pt-0">
                          <div
                            class="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3"
                            style="background: var(--bg-warning-muted, rgba(234,179,8,0.08)); border: 1px solid var(--state-warning)"
                          >
                            <app-icon
                              name="alert-triangle"
                              [size]="18"
                              style="color: var(--state-warning); flex-shrink: 0"
                            />
                            <p class="text-sm flex-1" style="color: var(--text-secondary)">
                              <span class="font-semibold" style="color: var(--state-warning)">
                                Asistencia práctica incompleta:
                              </span>
                              Estudiante
                              {{ alumno.nombre.split(' ').at(1) || alumno.nombre }} registra
                              <strong>{{ alumno.pctAsistenciaPractica ?? 0 }}%</strong>
                              de asistencia a clases prácticas. ¿Confirmar generación del
                              certificado de todos modos?
                            </p>
                            <div class="flex items-center gap-2 shrink-0">
                              <button
                                class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                                data-llm-action="confirm-generate-professional-certificate-partial-practice"
                                [disabled]="generatingId() !== null"
                                (click)="confirmarGenerar()"
                              >
                                @if (generatingId() === pendingConfirmId()) {
                                  <app-icon name="loader-2" [size]="13" class="animate-spin" />
                                  Generando...
                                } @else {
                                  <span class="group-hover:hidden flex items-center gap-1.5">
                                    <app-icon name="check" [size]="13" />
                                    Confirmar de todos modos
                                  </span>
                                  <span class="hidden group-hover:flex items-center gap-1.5">
                                    <app-icon name="mouse-pointer-click" [size]="13" />
                                    Confirmar de todos modos
                                  </span>
                                }
                              </button>
                              <button
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer btn-outline"
                                data-llm-action="cancel-generate-professional-certificate"
                                (click)="cancelarGenerar()"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
      <!-- end @else (curso seleccionado) -->

      <!-- ── Historial de Emisiones — siempre visible ───────────────── -->
      <div>
        <h2 class="flex items-center gap-2 text-lg font-semibold text-primary mb-4">
          <app-icon name="scroll" [size]="20" />
          Historial de Emisiones (Log)
        </h2>

        <div class="card overflow-hidden">
          @if (isLoading()) {
            <div class="p-6 flex flex-col gap-4">
              @for (_ of skeletonRowsSmall; track $index) {
                <app-skeleton-block variant="text" width="100%" height="36px" />
              }
            </div>
          } @else if (log().length === 0) {
            <div class="p-6 text-center text-muted text-sm">
              No hay registros de emisión de certificados profesionales aún
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-(--border-default)">
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Fecha/Hora
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Acción
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Alumno
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      Usuario
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of log(); track entry.id) {
                    <tr
                      class="border-b border-(--border-default) last:border-b-0 hover:bg-(--bg-subtle) transition-colors"
                    >
                      <td class="px-4 py-3 text-muted text-xs font-mono">
                        {{ entry.fecha | date: 'yyyy-MM-dd HH:mm' }}
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          [style.background]="getAccionBg(entry.accion)"
                          [style.color]="getAccionColor(entry.accion)"
                        >
                          {{ getAccionLabel(entry.accion) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-primary">{{ entry.alumnoNombre }}</td>
                      <td class="px-4 py-3 text-muted">{{ entry.usuarioNombre }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class CertificacionProfesionalContentComponent {
  // ── Inputs ──
  /** Lista de promociones finalizadas para el selector (ordenada por fecha DESC). */
  readonly promociones = input<PromocionCertOption[]>([]);
  /** Cursos disponibles una vez seleccionada una promoción. */
  readonly cursos = input<CursoCertOption[]>([]);
  /** ID de la promoción actualmente seleccionada (null = ninguna). */
  readonly selectedPromocionId = input<number | null>(null);
  /** ID del curso actualmente seleccionado (null = ninguno). */
  readonly selectedCursoId = input<number | null>(null);
  readonly alumnos = input<CertificacionProfesionalAlumnoRow[]>([]);
  readonly kpis = input<CertificacionProfesionalKpis | null>(null);
  readonly log = input<CertificacionProfesionalLogRow[]>([]);
  /** true mientras se cargan las promociones (carga inicial). */
  readonly isLoading = input(false);
  /** true mientras se cargan los alumnos del curso seleccionado. */
  readonly isLoadingAlumnos = input(false);
  readonly generatingId = input<number | null>(null);

  // ── Outputs ──
  /** Emite el ID de la promoción elegida en el selector. */
  readonly promocionSelected = output<number | null>();
  /** Emite el ID del curso elegido en el selector. */
  readonly cursoSelected = output<number | null>();
  readonly generarCertificado = output<number>();
  readonly verCertificado = output<{ storagePath: string; nombre: string }>();
  readonly enviarEmail = output<number>();
  readonly generarPendientes = output<void>();
  readonly enviarEmailsMasivo = output<void>();
  readonly exportar = output<void>();

  // ── Local state ──
  readonly estadoFilter = signal<EstadoFilter>('todos');
  /**
   * ID del enrollment esperando confirmación por práctica incompleta.
   * null = ninguna confirmación pendiente.
   */
  readonly pendingConfirmId = signal<number | null>(null);

  readonly heroActions: SectionHeroAction[] = [];

  readonly estadoOptions = [
    { label: 'Todos', value: 'todos' },
    { label: 'Generados', value: 'generado' },
    { label: 'Pendientes', value: 'pendiente' },
  ];

  readonly skeletonRows = Array.from({ length: 5 });
  readonly skeletonRowsSmall = Array.from({ length: 3 });

  // ── Computed ──
  readonly filteredAlumnos = computed(() => {
    const filter = this.estadoFilter();
    const all = this.alumnos();
    if (filter === 'todos') return all;
    return all.filter((a) => a.certificadoStatus === filter);
  });

  readonly pendientesCount = computed(
    () => this.alumnos().filter((a) => a.certificadoStatus === 'pendiente').length,
  );

  // ── Handlers de generación ──

  /**
   * Punto de entrada del botón "Generar".
   * - Si práctica = 100 % (o sin registro) → emite directamente.
   * - Si práctica < 100 % → abre fila de confirmación inline.
   */
  onClickGenerar(alumno: CertificacionProfesionalAlumnoRow): void {
    const pct = alumno.pctAsistenciaPractica;
    if (pct === null || pct >= 100) {
      this.generarCertificado.emit(alumno.enrollmentId);
      return;
    }
    this.pendingConfirmId.set(alumno.enrollmentId);
  }

  confirmarGenerar(): void {
    const id = this.pendingConfirmId();
    if (id !== null) {
      this.generarCertificado.emit(id);
      this.pendingConfirmId.set(null);
    }
  }

  cancelarGenerar(): void {
    this.pendingConfirmId.set(null);
  }

  // ── Helpers de color ──

  getTeoriaColor(pct: number): string {
    if (pct >= 75) return 'var(--state-success)';
    return 'var(--state-warning)';
  }

  getTeoriaBg(pct: number): string {
    if (pct >= 75) return 'var(--bg-success-muted, rgba(34,197,94,0.1))';
    return 'var(--bg-warning-muted, rgba(234,179,8,0.1))';
  }

  getPracticaColor(pct: number): string {
    if (pct >= 100) return 'var(--state-success)';
    if (pct >= 75) return 'var(--state-info, var(--color-primary))';
    return 'var(--state-warning)';
  }

  getPracticaBg(pct: number): string {
    if (pct >= 100) return 'var(--bg-success-muted, rgba(34,197,94,0.1))';
    if (pct >= 75) return 'var(--bg-info-muted, rgba(59,130,246,0.1))';
    return 'var(--bg-warning-muted, rgba(234,179,8,0.1))';
  }

  getNotaColor(nota: number): string {
    if (nota >= 75) return 'var(--state-success)';
    return 'var(--state-warning)';
  }

  getNotaBg(nota: number): string {
    if (nota >= 75) return 'var(--bg-success-muted, rgba(34,197,94,0.1))';
    return 'var(--bg-warning-muted, rgba(234,179,8,0.1))';
  }

  getAccionLabel(accion: string): string {
    return ACCION_LABELS_PROF[accion] ?? accion;
  }

  getAccionColor(accion: string): string {
    switch (accion) {
      case 'generated':
        return 'var(--state-success)';
      case 'email_sent':
        return 'var(--color-primary)';
      case 'downloaded':
        return 'var(--state-info, var(--color-primary))';
      default:
        return 'var(--text-muted)';
    }
  }

  getAccionBg(accion: string): string {
    switch (accion) {
      case 'generated':
        return 'var(--bg-success-muted, rgba(34,197,94,0.1))';
      case 'email_sent':
        return 'var(--bg-brand-muted)';
      case 'downloaded':
        return 'var(--bg-info-muted, rgba(59,130,246,0.1))';
      default:
        return 'var(--bg-subtle)';
    }
  }
}
