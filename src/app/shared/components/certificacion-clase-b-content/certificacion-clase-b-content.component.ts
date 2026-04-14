import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import type {
  CertificacionAlumnoRow,
  CertificacionKpis,
  CertificacionLogRow,
} from '@core/models/ui/certificacion-clase-b.model';
import { ACCION_LABELS } from '@core/models/ui/certificacion-clase-b.model';

type EstadoFilter = 'todos' | 'generado' | 'pendiente';

/**
 * CertificacionClaseBContentComponent — Dumb component.
 *
 * Vista de certificación Clase B:
 *  - Section Hero compacto
 *  - 4 KPIs (Total alumnos, Generados, Pendientes Generación, Pendientes Envío)
 *  - Toolbar con acciones masivas + filtro de estado
 *  - Tabla de alumnos elegibles (certificate_enabled = true)
 *    · Columna "Teoría" con % de asistencia a clases teóricas inscritas
 *    · Generar directo si teoría = 100 % (o sin registro)
 *    · Confirmación inline si teoría < 100 % (requisito flexible)
 *  - Historial de emisiones (log)
 */
@Component({
  selector: 'app-certificacion-clase-b-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
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
      title="Gestión de Certificados"
      subtitle="Certificación de finalización de curso Clase B"
      icon="award"
      [actions]="heroActions"
      variant="compact"
    />

    <div class="flex flex-col gap-6 p-4 md:p-6">
      <!-- ── KPIs ────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <app-kpi-card-variant
          label="Total Alumnos"
          [value]="kpis()?.totalAlumnos ?? 0"
          icon="graduation-cap"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          label="Certificados Generados"
          [value]="kpis()?.certificadosGenerados ?? 0"
          icon="check-circle"
          color="success"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          label="Pendientes Generación"
          [value]="kpis()?.pendientesGeneracion ?? 0"
          icon="clock"
          color="warning"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          label="Pendientes Envío"
          [value]="kpis()?.pendientesEnvio ?? 0"
          icon="mail"
          [loading]="isLoading()"
        />
      </div>

      <!-- ── Toolbar ─────────────────────────────────────────────────── -->
      <div class="flex flex-wrap items-center gap-3">
        @if (pendientesCount() > 0) {
          <button
            class="btn-primary flex items-center gap-2 text-sm"
            data-llm-action="generate-pending-certificates"
            (click)="generarPendientes.emit()"
          >
            <app-icon name="file-check" [size]="16" />
            Generar Pendientes ({{ pendientesCount() }})
          </button>
        }

        <button
          class="btn-secondary text-sm"
          data-llm-action="send-bulk-emails"
          (click)="enviarEmailsMasivo.emit()"
        >
          <app-icon name="send" [size]="16" />
          Enviar Emails Masivo
        </button>

        <!-- Filtro de estado -->
        <p-select
          [options]="estadoOptions"
          [ngModel]="estadoFilter()"
          (ngModelChange)="estadoFilter.set($event)"
          optionLabel="label"
          optionValue="value"
          class="h-9"
          data-llm-description="Filter certificates by status"
        />

        <button
          class="btn-secondary text-sm ml-auto"
          data-llm-action="export-certificates"
          (click)="exportar.emit()"
        >
          <app-icon name="download" [size]="16" />
          Exportar
        </button>
      </div>

      <!-- ── Tabla principal ─────────────────────────────────────────── -->
      <div class="card overflow-hidden">
        @if (isLoading()) {
          <div class="p-6 flex flex-col gap-4">
            @for (_ of skeletonRows; track $index) {
              <app-skeleton-block variant="text" width="100%" height="48px" />
            }
          </div>
        } @else if (filteredAlumnos().length === 0) {
          <div class="p-8">
            <app-empty-state
              icon="award"
              message="No hay alumnos elegibles para certificación"
              subtitle="Los alumnos aparecerán aquí cuando completen sus 12 clases prácticas de Clase B"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-[var(--border-default)]">
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
                    Curso
                  </th>
                  <th
                    class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    Prácticas
                  </th>
                  <th
                    class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    Teoría
                  </th>
                  <th
                    class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    Fecha Término
                  </th>
                  <th
                    class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    N° Certificado
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
                    class="border-b border-[var(--border-default)] last:border-b-0 transition-colors"
                    [class.bg-[var(--bg-subtle)]]="pendingConfirmId() === alumno.enrollmentId"
                  >
                    <td class="px-4 py-3 font-medium text-primary">
                      {{ alumno.nombre }}
                    </td>
                    <td class="px-4 py-3" style="color: var(--color-primary)">
                      {{ alumno.rut }}
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style="background: var(--bg-brand-muted); color: var(--color-primary)"
                      >
                        {{ alumno.curso }}
                      </span>
                    </td>
                    <!-- Prácticas: siempre 12/12 si aparece en esta lista -->
                    <td class="px-4 py-3 text-center">
                      <span class="font-semibold" style="color: var(--state-success)">
                        {{ alumno.clasesCompletadas }}/{{ alumno.clasesTotales }}
                      </span>
                    </td>
                    <!-- Teoría: % de asistencia a clases inscritas -->
                    <td class="px-4 py-3 text-center">
                      @if (alumno.pctAsistenciaTeoria === null) {
                        <span class="text-xs text-muted">Sin registro</span>
                      } @else {
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          [style.background]="getTeoriaBg(alumno.pctAsistenciaTeoria)"
                          [style.color]="getTeoriaColor(alumno.pctAsistenciaTeoria)"
                        >
                          @if (alumno.pctAsistenciaTeoria < 100) {
                            <app-icon name="alert-triangle" [size]="11" />
                          }
                          {{ alumno.pctAsistenciaTeoria }}%
                        </span>
                      }
                    </td>
                    <td class="px-4 py-3 text-muted">
                      {{ alumno.fechaTermino ?? '—' }}
                    </td>
                    <td class="px-4 py-3" style="color: var(--color-primary)">
                      {{ alumno.certificadoFolio ?? '—' }}
                    </td>
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
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-2">
                        @if (alumno.certificadoStatus === 'pendiente') {
                          <button
                            class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                            data-llm-action="generate-certificate"
                            [disabled]="generatingId() !== null"
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
                            data-llm-action="view-certificate-pdf"
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
                            data-llm-action="send-certificate-email"
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

                  <!-- Fila de confirmación inline — visible solo si teoría < 100 % -->
                  @if (pendingConfirmId() === alumno.enrollmentId) {
                    <tr class="border-b border-[var(--border-default)]">
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
                              Asistencia teórica incompleta:
                            </span>
                            {{ alumno.nombre }} registra
                            <strong>{{ alumno.pctAsistenciaTeoria }}%</strong>
                            de asistencia a sus clases teóricas. Las prácticas están completas
                            (12/12). ¿Confirmar generación del certificado de todos modos?
                          </p>
                          <div class="flex items-center gap-2 flex-shrink-0">
                            <button
                              class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                              data-llm-action="confirm-generate-certificate-partial-theory"
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
                              data-llm-action="cancel-generate-certificate"
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

      <!-- ── Historial de Emisiones (Log) ────────────────────────────── -->
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
            <div class="p-6 text-center text-muted text-sm">No hay registros de emisión aún</div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--border-default)]">
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
                      class="border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-subtle)] transition-colors"
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
                      <td class="px-4 py-3 text-primary">
                        {{ entry.alumnoNombre }}
                      </td>
                      <td class="px-4 py-3 text-muted">
                        {{ entry.usuarioNombre }}
                      </td>
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
export class CertificacionClaseBContentComponent {
  // ── Inputs ──
  readonly alumnos = input<CertificacionAlumnoRow[]>([]);
  readonly kpis = input<CertificacionKpis | null>(null);
  readonly log = input<CertificacionLogRow[]>([]);
  readonly isLoading = input(false);
  /** ID del enrollment cuyo certificado se está generando. null = ninguno en curso. */
  readonly generatingId = input<number | null>(null);

  // ── Outputs ──
  readonly generarCertificado = output<number>();
  readonly verCertificado = output<{ storagePath: string; nombre: string }>();
  readonly enviarEmail = output<number>();
  readonly generarPendientes = output<void>();
  readonly enviarEmailsMasivo = output<void>();
  readonly exportar = output<void>();

  // ── Local state ──
  readonly estadoFilter = signal<EstadoFilter>('todos');
  /**
   * ID de la matrícula esperando confirmación por asistencia teórica incompleta.
   * null = ninguna confirmación pendiente.
   */
  readonly pendingConfirmId = signal<number | null>(null);

  // ── Hero config ──
  readonly heroActions: SectionHeroAction[] = [];

  // ── Filter options ──
  readonly estadoOptions = [
    { label: 'Todos', value: 'todos' },
    { label: 'Generados', value: 'generado' },
    { label: 'Pendientes', value: 'pendiente' },
  ];

  // ── Skeleton helpers ──
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
   * - Si teoría = 100 % o sin registro → emite directamente.
   * - Si teoría < 100 % → abre la fila de confirmación inline.
   */
  onClickGenerar(alumno: CertificacionAlumnoRow): void {
    const pct = alumno.pctAsistenciaTeoria;
    if (pct === null || pct >= 100) {
      this.generarCertificado.emit(alumno.enrollmentId);
      return;
    }
    // Teoría incompleta: solicitar confirmación al usuario.
    this.pendingConfirmId.set(alumno.enrollmentId);
  }

  /** Confirmó generar a pesar de teoría incompleta. */
  confirmarGenerar(): void {
    const id = this.pendingConfirmId();
    if (id !== null) {
      this.generarCertificado.emit(id);
      this.pendingConfirmId.set(null);
    }
  }

  /** Canceló la confirmación. */
  cancelarGenerar(): void {
    this.pendingConfirmId.set(null);
  }

  // ── Helpers de color ──

  getTeoriaColor(pct: number): string {
    if (pct >= 100) return 'var(--state-success)';
    if (pct >= 75) return 'var(--state-info, var(--color-primary))';
    return 'var(--state-warning)';
  }

  getTeoriaBg(pct: number): string {
    if (pct >= 100) return 'var(--bg-success-muted, rgba(34,197,94,0.1))';
    if (pct >= 75) return 'var(--bg-info-muted, rgba(59,130,246,0.1))';
    return 'var(--bg-warning-muted, rgba(234,179,8,0.1))';
  }

  getAccionLabel(accion: string): string {
    return ACCION_LABELS[accion] ?? accion;
  }

  getAccionColor(accion: string): string {
    switch (accion) {
      case 'generated':
        return 'var(--state-success)';
      case 'email_sent':
        return 'var(--color-primary)';
      case 'downloaded':
        return 'var(--state-info, var(--color-primary))';
      case 'printed':
        return 'var(--text-secondary)';
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
      case 'printed':
        return 'var(--bg-subtle)';
      default:
        return 'var(--bg-subtle)';
    }
  }
}
