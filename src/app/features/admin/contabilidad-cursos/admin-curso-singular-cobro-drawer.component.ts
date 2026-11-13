import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import type {
  InscriptoCursoSingular,
  SingularPaymentMethod,
} from '@core/models/ui/cursos-singulares.model';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';

type MetodoCobro = Exclude<SingularPaymentMethod, 'pendiente'>;
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
    AlertCardComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="false">
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-4">
            <!-- Resumen del curso (card-tinted) -->
            <app-skeleton-block variant="rect" width="100%" height="66px" />
            <!-- Resumen de cobros (3 stat-boxes) -->
            <div class="grid grid-cols-3 gap-3">
              <app-skeleton-block variant="rect" width="100%" height="50px" />
              <app-skeleton-block variant="rect" width="100%" height="50px" />
              <app-skeleton-block variant="rect" width="100%" height="50px" />
            </div>
            <!-- Lista de cobros por alumno (header + filas) -->
            <div class="flex flex-col gap-0 rounded-xl border border-border-muted overflow-hidden">
              <app-skeleton-block variant="rect" width="100%" height="44px" borderRadius="0" />
              @for (i of [1, 2, 3]; track i) {
                <div
                  class="px-4 py-3 flex items-center justify-between gap-3 border-t border-border-muted"
                >
                  <div class="flex flex-col gap-1.5">
                    <app-skeleton-block variant="text" width="140px" height="14px" />
                    <app-skeleton-block variant="text" width="90px" height="11px" />
                  </div>
                  <app-skeleton-block variant="rect" width="76px" height="28px" />
                </div>
              }
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          @if (facade.selectedCurso(); as curso) {
            <div class="flex flex-col gap-4">
              <!-- fix-075-i: un cobro rechazado (p. ej. la caja del día ya está cerrada) dice por qué -->
              @if (facade.error(); as error) {
                <app-alert-card severity="error" title="No se registró el cobro">
                  <span class="text-compact text-text-secondary">{{ error }}</span>
                </app-alert-card>
              }

              <!-- ── Resumen del curso ─────────────────────────────────────────────── -->
              <div
                class="card card-tinted rounded-xl px-4 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p class="item-title">
                    {{ curso.nombre }}
                  </p>
                  <p class="text-xs mt-0.5 font-medium text-text-muted">
                    Precio:
                    <strong class="text-text-secondary">{{ formatCLP(curso.precio) }}</strong>
                    ·
                    {{ billingLabel(curso.billingType) }}
                  </p>
                </div>
                <app-badge [variant]="curso.tipo === 'sence' ? 'brand' : 'neutral'">
                  {{ curso.tipo === 'sence' ? 'SENCE' : 'Part.' }}
                </app-badge>
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
                  <p class="item-title">Estado de cobro por alumno</p>
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
                    <p class="text-sm text-text-muted">Sin inscritos registrados.</p>
                  </div>
                } @else {
                  @for (alumno of facade.inscriptos(); track alumno.enrollmentId) {
                    <div class="border-b last:border-b-0 border-border-muted">
                      <div class="px-4 py-3 flex items-center justify-between gap-3">
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
                          } @else if (cobrandoId() !== alumno.enrollmentId) {
                            <button
                              class="btn-primary text-xs"
                              [disabled]="facade.isSaving()"
                              data-llm-action="marcar-cobrado-inscripto"
                              (click)="onIniciarCobro(alumno)"
                            >
                              <app-icon name="dollar-sign" [size]="12" />
                              Marcar cobrado
                            </button>
                          }
                        </div>
                      </div>

                      <!-- fix-075-i: con qué se pagó, para que la Caja Diaria lo sume en su columna -->
                      @if (cobrandoId() === alumno.enrollmentId) {
                        <div class="px-4 pb-3 flex flex-col gap-2">
                          <span class="micro-label">¿Con qué pagó?</span>
                          <div
                            class="flex flex-wrap gap-2"
                            role="radiogroup"
                            aria-label="Medio de pago del cobro"
                          >
                            @for (m of metodosCobro; track m.value) {
                              <button
                                type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-semibold text-text-primary cursor-pointer transition-colors"
                                role="radio"
                                [attr.aria-checked]="metodo() === m.value"
                                [style.border-color]="
                                  metodo() === m.value ? 'var(--ds-brand)' : 'var(--border-muted)'
                                "
                                [style.background]="
                                  metodo() === m.value
                                    ? 'color-mix(in srgb, var(--ds-brand) 8%, transparent)'
                                    : 'var(--bg-surface)'
                                "
                                [attr.data-llm-action]="'seleccionar-medio-cobro-' + m.value"
                                (click)="metodo.set(m.value)"
                              >
                                @if (metodo() === m.value) {
                                  <app-icon name="check" [size]="12" />
                                }
                                {{ m.label }}
                              </button>
                            }
                          </div>
                          <div class="flex justify-end gap-2">
                            <button
                              type="button"
                              class="btn-secondary"
                              data-llm-action="cancelar-cobro-inscripto"
                              [disabled]="facade.isSaving()"
                              (click)="onCancelarCobro()"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              class="btn-primary"
                              data-llm-action="confirmar-cobro-inscripto"
                              [disabled]="facade.isSaving()"
                              (click)="onConfirmarCobro(alumno)"
                            >
                              @if (guardandoId() === alumno.enrollmentId) {
                                <app-icon name="loader-circle" [size]="12" class="animate-spin" />
                                Guardando…
                              } @else {
                                Confirmar cobro de {{ formatCLP(alumno.montoAPagar) }}
                              }
                            </button>
                          </div>
                        </div>
                      }
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
        </ng-template>
      </app-drawer-content-loader>
    </app-drawer-form>
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

  /** Medios con que se puede cobrar (sin "pendiente": esto ES el cobro). */
  protected readonly metodosCobro: { value: MetodoCobro; label: string }[] = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta', label: 'Tarjeta' },
  ];

  /**
   * Inscripción cuyo cobro se está confirmando (fix-075-i): "Marcar cobrado" ya no registra al
   * tiro, primero pregunta con qué se pagó para que la Caja Diaria lo ponga en su columna.
   */
  private readonly _cobrandoId = signal<number | null>(null);
  protected readonly cobrandoId = this._cobrandoId.asReadonly();
  protected readonly metodo = signal<MetodoCobro>('efectivo');

  protected onIniciarCobro(alumno: InscriptoCursoSingular): void {
    this.metodo.set('efectivo');
    this._cobrandoId.set(alumno.enrollmentId);
  }

  protected onCancelarCobro(): void {
    this._cobrandoId.set(null);
  }

  protected async onConfirmarCobro(alumno: InscriptoCursoSingular): Promise<void> {
    this._guardandoId.set(alumno.enrollmentId);
    const ok = await this.facade.marcarEnrollmentPagado(alumno.enrollmentId, this.metodo());
    this._guardandoId.set(null);
    // Si falló (p. ej. la caja del día ya está cerrada) la elección queda abierta y el motivo
    // se ve en el aviso de error de arriba.
    if (ok) this._cobrandoId.set(null);
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
