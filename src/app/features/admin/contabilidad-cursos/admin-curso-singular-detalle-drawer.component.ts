import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { formatCLP, formatChileanDate } from '@core/utils/date.utils';

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo',
  upcoming: 'Próximo',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
};

const BILLING_LABEL: Record<string, string> = {
  sence_franchise: 'Franquicia SENCE',
  boleta: 'Boleta',
  factura: 'Factura',
};

const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  partial: 'Parcial',
};

/**
 * AdminCursoSingularDetalleDrawerComponent — Detalle de un Curso Singular (RF-035).
 *
 * Cargado dinámicamente por LayoutDrawerFacadeService desde AdminContabilidadCursosComponent.
 * Lee el contexto del singleton CursosSingularesFacade.selectedCurso().
 *
 * Secciones:
 *   1. Datos del curso (nombre, tipo, precio, duración, cupos, estado, facturación)
 *   2. KPIs mini: Inscritos · Ingreso Estimado · Cupos libres
 *   3. Tabla de inscriptos con estado de pago
 */
@Component({
  selector: 'app-admin-curso-singular-detalle-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, KpiCardComponent],
  template: `
    <div class="flex flex-col gap-5 p-1">
      @if (facade.selectedCurso(); as curso) {
        <!-- ── Ficha del curso ──────────────────────────────────────────────── -->
        <div class="card card-tinted p-4 flex flex-col gap-4">
          <!-- Nombre + tipo badge -->
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-base font-bold" style="color: var(--text-primary)">
                {{ curso.nombre }}
              </p>
              <div class="flex items-center gap-1.5 mt-1">
                <app-icon name="calendar" [size]="12" color="var(--text-muted)" />
                <p class="text-xs font-medium" style="color: var(--text-muted)">
                  Inicio: {{ formatChileanDate(curso.inicio) }}
                </p>
              </div>
            </div>
            <span
              class="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
              [style.background]="
                curso.tipo === 'sence'
                  ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                  : 'color-mix(in srgb, var(--color-purple) 14%, transparent)'
              "
              [style.color]="
                curso.tipo === 'sence' ? 'var(--color-primary)' : 'var(--color-purple)'
              "
            >
              {{ curso.tipo === 'sence' ? 'SENCE' : 'Particular' }}
            </span>
          </div>

          <!-- Datos en grid -->
          <div class="grid grid-cols-2 gap-x-4 gap-y-3">
            @for (item of fichaItems(curso); track item.label) {
              <div class="flex flex-col gap-0.5">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest"
                  style="color: var(--text-muted)"
                >
                  {{ item.label }}
                </p>
                <p class="text-sm font-semibold" style="color: var(--text-secondary)">
                  {{ item.value }}
                </p>
              </div>
            }
          </div>
        </div>

        <!-- ── KPIs mini ────────────────────────────────────────────────────── -->
        <div class="grid grid-cols-3 gap-3">
          <app-kpi-card
            label="Inscritos"
            [value]="curso.inscritos"
            [suffix]="' / ' + curso.cupos"
            size="md"
          />

          <app-kpi-card
            label="Ingreso Est."
            [value]="curso.estado !== 'upcoming' ? curso.ingresoEstimado : 0"
            prefix="$"
            [color]="curso.estado !== 'upcoming' ? 'success' : 'default'"
            size="md"
          />

          <app-kpi-card
            label="Libres"
            [value]="curso.cupos - curso.inscritos"
            [color]="curso.cupos - curso.inscritos > 0 ? 'success' : 'error'"
            size="md"
          />
        </div>

        <!-- ── Inscriptos ───────────────────────────────────────────────────── -->
        <div class="card p-0 overflow-hidden">
          <div
            class="px-4 py-3 border-b flex items-center gap-2"
            style="border-color: var(--border-muted)"
          >
            <app-icon name="users" [size]="16" color="var(--text-muted)" />
            <p class="text-sm font-semibold" style="color: var(--text-primary)">Inscriptos</p>
          </div>

          @if (facade.isLoadingInscriptos()) {
            @for (i of [1, 2, 3]; track i) {
              <div
                class="px-4 py-3 flex items-center justify-between border-b"
                style="border-color: var(--border-muted)"
              >
                <app-skeleton-block variant="text" width="55%" height="14px" />
                <app-skeleton-block variant="text" width="20%" height="20px" />
              </div>
            }
          } @else if (facade.inscriptos().length === 0) {
            <div class="px-4 py-8 text-center">
              <p class="text-sm" style="color: var(--text-muted)">Sin inscriptos registrados.</p>
            </div>
          } @else {
            @for (alumno of facade.inscriptos(); track alumno.enrollmentId) {
              <div
                class="px-4 py-3 flex items-center justify-between border-b last:border-b-0"
                style="border-color: var(--border-muted)"
              >
                <div>
                  <p class="text-sm font-medium" style="color: var(--text-primary)">
                    {{ alumno.nombreAlumno }}
                  </p>
                  <p class="text-xs" style="color: var(--text-muted)">{{ alumno.rutAlumno }}</p>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    [style.background]="getPaymentBg(alumno.paymentStatus)"
                    [style.color]="getPaymentColor(alumno.paymentStatus)"
                  >
                    {{ paymentLabel(alumno.paymentStatus) }}
                  </span>
                  <p class="text-xs" style="color: var(--text-muted)">
                    {{ formatCLP(alumno.montoPagado) }}
                  </p>
                </div>
              </div>
            }
          }
        </div>
      } @else {
        <div class="flex flex-col items-center justify-center py-16 gap-3">
          <app-icon name="graduation-cap" [size]="32" color="var(--text-muted)" />
          <p class="text-sm" style="color: var(--text-muted)">Sin curso seleccionado.</p>
        </div>
      }
    </div>
  `,
})
export class AdminCursoSingularDetalleDrawerComponent {
  protected readonly facade = inject(CursosSingularesFacade);
  protected readonly formatCLP = formatCLP;
  protected readonly formatChileanDate = formatChileanDate;

  protected fichaItems(
    curso: ReturnType<typeof this.facade.selectedCurso>,
  ): { label: string; value: string }[] {
    if (!curso) return [];
    return [
      { label: 'Precio unitario', value: formatCLP(curso.precio) },
      { label: 'Duración', value: `${curso.duracionHoras} horas` },
      { label: 'Facturación', value: BILLING_LABEL[curso.billingType] ?? curso.billingType },
      { label: 'Estado', value: ESTADO_LABEL[curso.estado] ?? curso.estado },
    ];
  }

  protected getPaymentBg(status: string): string {
    if (status === 'paid') return 'color-mix(in srgb, var(--state-success) 12%, transparent)';
    if (status === 'partial') return 'color-mix(in srgb, var(--state-warning) 12%, transparent)';
    return 'color-mix(in srgb, var(--text-muted) 12%, transparent)';
  }

  protected getPaymentColor(status: string): string {
    if (status === 'paid') return 'var(--state-success)';
    if (status === 'partial') return 'var(--state-warning)';
    return 'var(--text-muted)';
  }

  protected paymentLabel(status: string): string {
    return PAYMENT_LABEL[status] ?? status;
  }
}
