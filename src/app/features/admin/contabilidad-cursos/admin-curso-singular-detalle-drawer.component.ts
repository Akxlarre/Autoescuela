import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminCursoSingularInscribirDrawerComponent } from './admin-curso-singular-inscribir-drawer.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { formatCLP, formatChileanDate } from '@core/utils/date.utils';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

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
  imports: [
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    StatBoxComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="false">
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-4">
            <!-- Ficha del curso (nombre + badge + grid 2x2 de datos) -->
            <div class="card card-tinted p-4 flex flex-col gap-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="160px" height="16px" />
                  <app-skeleton-block variant="text" width="110px" height="11px" />
                </div>
                <app-skeleton-block
                  variant="rect"
                  width="64px"
                  height="22px"
                  borderRadius="999px"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <app-skeleton-block variant="rect" width="100%" height="46px" />
                <app-skeleton-block variant="rect" width="100%" height="46px" />
                <app-skeleton-block variant="rect" width="100%" height="46px" />
                <app-skeleton-block variant="rect" width="100%" height="46px" />
              </div>
            </div>
            <!-- KPIs mini -->
            <div class="grid grid-cols-3 gap-3">
              <app-skeleton-block variant="rect" width="100%" height="50px" />
              <app-skeleton-block variant="rect" width="100%" height="50px" />
              <app-skeleton-block variant="rect" width="100%" height="50px" />
            </div>
            <!-- Inscritos (header + filas) -->
            <div class="flex flex-col gap-0 rounded-xl border border-border-muted overflow-hidden">
              <app-skeleton-block variant="rect" width="100%" height="44px" borderRadius="0" />
              @for (i of [1, 2, 3]; track i) {
                <div
                  class="px-4 py-3 flex items-center justify-between border-t border-border-muted"
                >
                  <app-skeleton-block variant="text" width="55%" height="14px" />
                  <app-skeleton-block
                    variant="rect"
                    width="70px"
                    height="22px"
                    borderRadius="999px"
                  />
                </div>
              }
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          @if (facade.selectedCurso(); as curso) {
            <div class="flex flex-col gap-4">
              <!-- ── Ficha del curso ──────────────────────────────────────────────── -->
              <div class="card card-tinted p-4 flex flex-col gap-4">
                <!-- Nombre + tipo badge -->
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-bold text-text-primary">
                      {{ curso.nombre }}
                    </p>
                    <div class="flex items-center gap-1.5 mt-1">
                      <app-icon name="calendar" [size]="12" color="var(--text-muted)" />
                      <p class="text-xs font-medium text-text-muted">
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
                <div class="grid grid-cols-2 gap-3">
                  @for (item of fichaItems(curso); track item.label) {
                    <app-stat-box
                      [label]="item.label"
                      [value]="item.value"
                      variant="surface"
                      [compact]="true"
                    />
                  }
                </div>
              </div>

              <!-- ── KPIs mini ────────────────────────────────────────────────────── -->
              <div class="grid grid-cols-3 gap-3">
                <app-stat-box
                  label="Inscritos"
                  [value]="curso.inscritos"
                  [suffix]="'/ ' + curso.cupos"
                  [compact]="true"
                />

                <app-stat-box
                  label="Cobrado"
                  [value]="formatCLP(curso.ingresoCobrado)"
                  [variant]="curso.ingresoCobrado > 0 ? 'success' : 'default'"
                  [compact]="true"
                  [useMono]="true"
                />

                <app-stat-box
                  label="Libres"
                  [value]="curso.cupos - curso.inscritos"
                  [variant]="curso.cupos - curso.inscritos > 0 ? 'success' : 'error'"
                  [compact]="true"
                />
              </div>

              <!-- ── Acciones de estado ──────────────────────────────────────────── -->
              @if (curso.estado === 'active' || curso.estado === 'upcoming') {
                <div class="card p-4 flex flex-col gap-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Cambiar estado
                  </p>

                  @if (confirmingAction() === null) {
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="btn-success-soft text-xs flex-1"
                        [disabled]="facade.isSaving()"
                        (click)="confirmingAction.set('completed')"
                        data-llm-action="marcar-curso-singular-finalizado"
                      >
                        <app-icon name="check-circle" [size]="13" />
                        Marcar como finalizado
                      </button>
                      <button
                        type="button"
                        class="btn-danger-ghost text-xs flex-1"
                        [disabled]="facade.isSaving()"
                        (click)="confirmingAction.set('cancelled')"
                        data-llm-action="cancelar-curso-singular"
                      >
                        <app-icon name="x-circle" [size]="13" />
                        Cancelar curso
                      </button>
                    </div>
                  } @else {
                    <div
                      class="rounded-lg p-3 flex items-center justify-between gap-3"
                      [style.background]="
                        confirmingAction() === 'completed'
                          ? 'var(--state-success-bg)'
                          : 'var(--state-error-bg)'
                      "
                    >
                      <p class="text-xs font-medium text-text-primary">
                        @if (confirmingAction() === 'completed') {
                          ¿Marcar el curso como finalizado?
                        } @else {
                          ¿Cancelar el curso? Esta acción no se puede revertir.
                        }
                      </p>
                      <div class="flex gap-2 shrink-0">
                        <button
                          type="button"
                          class="btn-ghost text-xs"
                          [disabled]="facade.isSaving()"
                          (click)="confirmingAction.set(null)"
                        >
                          No
                        </button>
                        <button
                          type="button"
                          [class]="
                            confirmingAction() === 'completed'
                              ? 'btn-success-soft text-xs'
                              : 'btn-danger-solid text-xs'
                          "
                          [disabled]="facade.isSaving()"
                          (click)="onConfirmarCambioEstado(curso.id)"
                          data-llm-action="confirmar-cambio-estado-curso-singular"
                        >
                          @if (facade.isSaving()) {
                            Guardando…
                          } @else if (confirmingAction() === 'completed') {
                            Sí, finalizar
                          } @else {
                            Sí, cancelar
                          }
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- ── Inscriptos ───────────────────────────────────────────────────── -->
              <div class="card p-0 overflow-hidden">
                <div
                  class="px-4 py-3 border-b flex items-center justify-between gap-2 border-border-muted"
                >
                  <div class="flex items-center gap-2">
                    <app-icon name="users" [size]="16" color="var(--text-muted)" />
                    <p class="text-sm font-semibold text-text-primary">Inscritos</p>
                  </div>
                  @if (curso.estado !== 'cancelled' && curso.inscritos < curso.cupos) {
                    <button
                      type="button"
                      class="btn-primary text-xs"
                      (click)="onInscribir()"
                      data-llm-action="abrir-inscripcion-curso-singular"
                    >
                      <app-icon name="user-plus" [size]="13" />
                      Inscribir alumno
                    </button>
                  }
                </div>

                @if (facade.isLoadingInscriptos()) {
                  @for (i of [1, 2, 3]; track i) {
                    <div
                      class="px-4 py-3 flex items-center justify-between border-b border-border-muted"
                    >
                      <app-skeleton-block variant="text" width="55%" height="14px" />
                      <app-skeleton-block variant="text" width="20%" height="20px" />
                    </div>
                  }
                } @else if (facade.inscriptos().length === 0) {
                  <div class="px-4 py-8 text-center">
                    <p class="text-sm text-text-muted">Sin inscriptos registrados.</p>
                  </div>
                } @else {
                  @for (alumno of facade.inscriptos(); track alumno.enrollmentId) {
                    <div
                      class="px-4 py-3 flex items-center justify-between border-b last:border-b-0 border-border-muted"
                    >
                      <div>
                        <p class="text-sm font-medium text-text-primary">
                          {{ alumno.nombreAlumno }}
                        </p>
                        <p class="text-xs text-text-muted">{{ alumno.rutAlumno }}</p>
                      </div>
                      <div class="flex flex-col items-end gap-1">
                        <app-badge [variant]="getPaymentVariant(alumno.paymentStatus)">
                          {{ paymentLabel(alumno.paymentStatus) }}
                        </app-badge>
                        <p class="text-xs text-text-muted">
                          {{ formatCLP(alumno.montoPagado) }}
                        </p>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center py-16 gap-3">
              <app-icon name="graduation-cap" [size]="32" color="var(--text-muted)" />
              <p class="text-sm text-text-muted">Sin curso seleccionado.</p>
            </div>
          }
        </ng-template>
      </app-drawer-content-loader>
    </app-drawer-form>
  `,
})
export class AdminCursoSingularDetalleDrawerComponent {
  protected readonly facade = inject(CursosSingularesFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  protected readonly formatCLP = formatCLP;
  protected readonly formatChileanDate = formatChileanDate;

  protected readonly confirmingAction = signal<'completed' | 'cancelled' | null>(null);

  protected async onConfirmarCambioEstado(cursoId: number): Promise<void> {
    const action = this.confirmingAction();
    if (!action) return;
    const ok =
      action === 'completed'
        ? await this.facade.marcarCursoFinalizado(cursoId)
        : await this.facade.cancelarCurso(cursoId);
    if (ok) this.confirmingAction.set(null);
  }

  protected onInscribir(): void {
    this.layoutDrawer.push(
      AdminCursoSingularInscribirDrawerComponent,
      'Inscribir Alumno',
      'user-plus',
    );
  }

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

  protected getPaymentVariant(status: string): 'success' | 'warning' | 'neutral' {
    if (status === 'paid') return 'success';
    if (status === 'partial') return 'warning';
    return 'neutral';
  }

  protected paymentLabel(status: string): string {
    return PAYMENT_LABEL[status] ?? status;
  }
}
