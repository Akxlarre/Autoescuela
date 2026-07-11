import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import type { InscriptoCursoSingular } from '@core/models/ui/cursos-singulares.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { formatCLP } from '@core/utils/date.utils';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

/**
 * AdminCursoSingularCobroDrawerComponent — Registro de cobro (RF-035).
 *
 * Cargado dinámicamente por LayoutDrawerFacadeService desde AdminContabilidadCursosComponent.
 * Lee el contexto del singleton CursosSingularesFacade.
 *
 * Muestra la lista de inscriptos con su estado de pago y permite marcar
 * individualmente como "Pagado" cada inscripción pendiente.
 */
@Component({
  selector: 'app-admin-curso-singular-cobro-drawer',
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
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-4">
          <app-skeleton-block variant="text" width="100%" height="60px" />
          <div class="grid grid-cols-3 gap-3">
            <app-skeleton-block variant="text" width="100%" height="50px" />
            <app-skeleton-block variant="text" width="100%" height="50px" />
            <app-skeleton-block variant="text" width="100%" height="50px" />
          </div>
          <app-skeleton-block variant="rect" width="100%" height="120px" />
        </div>
      </ng-template>
      <ng-template #content>
        <app-drawer-form [hasFooter]="false">
          @if (facade.selectedCurso(); as curso) {
            <div class="flex flex-col gap-4">
              <!-- ── Resumen del curso ─────────────────────────────────────────────── -->
              <div
                class="card card-tinted rounded-xl px-4 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p class="text-sm font-bold text-text-primary">
                    {{ curso.nombre }}
                  </p>
                  <p class="text-xs mt-0.5 font-medium text-text-muted">
                    Precio:
                    <strong class="text-text-secondary">{{ formatCLP(curso.precio) }}</strong>
                    ·
                    {{ billingLabel(curso.billingType) }}
                  </p>
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
                  {{ curso.tipo === 'sence' ? 'SENCE' : 'Part.' }}
                </span>
              </div>

              <!-- ── Resumen de cobros ─────────────────────────────────────────────── -->
              <div class="grid grid-cols-3 gap-3">
                <app-stat-box
                  label="Pendientes"
                  [value]="pendientes()"
                  variant="warning"
                  [compact]="true"
                />

                <app-stat-box
                  label="Cobrados"
                  [value]="cobrados()"
                  variant="success"
                  [compact]="true"
                />

                <app-stat-box
                  label="Total"
                  [value]="formatCLP(totalCobrado())"
                  variant="success"
                  [compact]="true"
                  [useMono]="true"
                />
              </div>

              <!-- ── Lista de cobros por alumno ────────────────────────────────────── -->
              <div class="card p-0 overflow-hidden">
                <div class="px-4 py-3 border-b flex items-center gap-2 border-border-muted">
                  <app-icon name="dollar-sign" [size]="16" color="var(--text-muted)" />
                  <p class="text-sm font-semibold text-text-primary">Estado de cobro por alumno</p>
                </div>

                @if (facade.isLoadingInscriptos()) {
                  @for (i of [1, 2, 3]; track i) {
                    <div
                      class="px-4 py-3 flex items-center justify-between border-b border-border-muted"
                    >
                      <div class="flex flex-col gap-2">
                        <app-skeleton-block variant="text" width="140px" height="14px" />
                        <app-skeleton-block variant="text" width="80px" height="12px" />
                      </div>
                      <app-skeleton-block variant="rect" width="80px" height="32px" />
                    </div>
                  }
                } @else if (facade.inscriptos().length === 0) {
                  <div class="px-4 py-8 text-center">
                    <p class="text-sm text-text-muted">Sin inscriptos registrados.</p>
                  </div>
                } @else {
                  @for (alumno of facade.inscriptos(); track alumno.enrollmentId) {
                    <div
                      class="px-4 py-3 flex items-center justify-between gap-3 border-b last:border-b-0 border-border-muted"
                    >
                      <!-- Datos alumno -->
                      <div class="min-w-0">
                        <p class="text-sm font-medium truncate text-text-primary">
                          {{ alumno.nombreAlumno }}
                        </p>
                        <p class="text-xs text-text-muted">
                          {{ alumno.rutAlumno }}
                          ·
                          {{
                            alumno.paymentStatus === 'paid'
                              ? formatCLP(alumno.montoPagado)
                              : 'A cobrar: ' + formatCLP(alumno.montoAPagar)
                          }}
                        </p>
                        @if (alumno.descuento > 0) {
                          <p class="text-xs text-success">
                            Descuento {{ formatCLP(alumno.descuento) }}
                            @if (alumno.descuentoMotivo) {
                              · {{ alumno.descuentoMotivo }}
                            }
                          </p>
                        }
                      </div>

                      <!-- Estado + acción -->
                      <div class="shrink-0 flex items-center gap-2">
                        @if (alumno.paymentStatus === 'paid') {
                          <app-badge variant="success">
                            <app-icon name="check-circle" [size]="12" />
                            Cobrado
                          </app-badge>
                        } @else {
                          <button
                            class="btn-primary text-xs"
                            [disabled]="facade.isSaving()"
                            data-llm-action="marcar-cobrado-inscripto"
                            (click)="onMarcarPagado(alumno)"
                          >
                            @if (guardandoId() === alumno.enrollmentId) {
                              <app-icon name="loader-2" [size]="12" />
                              Guardando…
                            } @else {
                              <app-icon name="dollar-sign" [size]="12" />
                              Marcar cobrado
                            }
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              </div>

              <!-- Nota SENCE -->
              @if (curso.tipo === 'sence') {
                <div
                  class="px-4 py-3 rounded-lg text-xs text-text-secondary bg-brand/6 border border-brand/20"
                >
                  <strong class="text-brand">SENCE:</strong>
                  Los cursos SENCE se facturan al organismo. El cobro al alumno es $0 si está 100%
                  financiado. Confirma el ingreso al recibir el pago de SENCE.
                </div>
              }
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center py-16 gap-3">
              <app-icon name="dollar-sign" [size]="32" color="var(--text-muted)" />
              <p class="text-sm text-text-muted">Sin curso seleccionado.</p>
            </div>
          }
        </app-drawer-form>
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class AdminCursoSingularCobroDrawerComponent {
  protected readonly facade = inject(CursosSingularesFacade);
  protected readonly formatCLP = formatCLP;

  private readonly _guardandoId = signal<number | null>(null);
  protected readonly guardandoId = computed(() =>
    this.facade.isSaving() ? this._guardandoId() : null,
  );

  protected readonly pendientes = computed(
    () => this.facade.inscriptos().filter((i) => i.paymentStatus !== 'paid').length,
  );

  protected readonly cobrados = computed(
    () => this.facade.inscriptos().filter((i) => i.paymentStatus === 'paid').length,
  );

  /** Suma del dinero efectivamente recibido (respeta descuentos). */
  protected readonly totalCobrado = computed(() =>
    this.facade.inscriptos().reduce((s, i) => s + i.montoPagado, 0),
  );

  protected async onMarcarPagado(alumno: InscriptoCursoSingular): Promise<void> {
    this._guardandoId.set(alumno.enrollmentId);
    await this.facade.marcarEnrollmentPagado(alumno.enrollmentId);
    this._guardandoId.set(null);
  }

  protected billingLabel(bt: string): string {
    const MAP: Record<string, string> = {
      sence_franchise: 'Franquicia SENCE',
      boleta: 'Boleta',
      factura: 'Factura',
    };
    return MAP[bt] ?? bt;
  }
}
