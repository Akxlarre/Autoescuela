import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnInit,
  viewChild,
} from '@angular/core';
import { AnticiosFacade } from '@core/facades/anticipos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import type { AnticipoCuentaCorriente, AnticipoHistorial } from '@core/models/ui/anticipos.model';
import { RegistrarAnticipoDrawerComponent } from './registrar-anticipo-drawer.component';

// ─── Formatter ───────────────────────────────────────────────────────────────

const clpFmt = new Intl.NumberFormat('es-CL', { style: 'decimal', maximumFractionDigits: 0 });
function clp(n: number): string {
  return `$${clpFmt.format(n)}`;
}

@Component({
  selector: 'app-admin-contabilidad-anticipos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
    AlertCardComponent,
  ],
  template: `
    <div class="page-wide flex flex-col gap-6 pb-8" #pageRef>
      <!-- ── Hero ─────────────────────────────────────────────────────────── -->
      <app-section-hero
        title="Anticipos a Instructores"
        contextLine="Contabilidad"
        subtitle="RF-038 · Cuenta corriente interna y gestión de anticipos"
        icon="banknote"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── Error ─────────────────────────────────────────────────────────── -->
      @if (facade.error()) {
        <app-alert-card severity="error" title="Error al cargar anticipos">
          {{ facade.error() }}
        </app-alert-card>
      }

      <!-- ── KPIs ───────────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4" #kpiGrid>
        <!-- Anticipos Pendientes -->
        <div
          class="card p-5 flex flex-col gap-2"
          style="border-left: 3px solid var(--state-warning)"
        >
          @if (facade.isLoading()) {
            <app-skeleton-block variant="text" width="60%" height="14px" />
            <app-skeleton-block variant="rect" width="70%" height="36px" />
            <app-skeleton-block variant="text" width="40%" height="12px" />
          } @else {
            <span class="kpi-label" style="color: var(--state-warning)">Anticipos Pendientes</span>
            <span class="kpi-value" style="color: var(--state-warning)">
              {{ clp(facade.kpis().totalPendiente) }}
            </span>
            <span class="text-xs" style="color: var(--text-muted)">
              {{ facade.kpis().instructoresConSaldo }}
              {{ facade.kpis().instructoresConSaldo === 1 ? 'instructor' : 'instructores' }}
              con saldo
            </span>
          }
        </div>

        <!-- Total Histórico -->
        <div class="card p-5 flex flex-col gap-2">
          @if (facade.isLoading()) {
            <app-skeleton-block variant="text" width="60%" height="14px" />
            <app-skeleton-block variant="rect" width="70%" height="36px" />
            <app-skeleton-block variant="text" width="40%" height="12px" />
          } @else {
            <span class="kpi-label">Total Anticipado (histórico)</span>
            <span class="kpi-value" style="color: var(--state-info)">
              {{ clp(facade.kpis().totalHistorico) }}
            </span>
            <span class="text-xs" style="color: var(--text-muted)"
              >desde inicio de operaciones</span
            >
          }
        </div>

        <!-- Ya Descontados -->
        <div class="card p-5 flex flex-col gap-2" style="border: 2px solid var(--state-success)">
          @if (facade.isLoading()) {
            <app-skeleton-block variant="text" width="60%" height="14px" />
            <app-skeleton-block variant="rect" width="70%" height="36px" />
            <app-skeleton-block variant="text" width="40%" height="12px" />
          } @else {
            <span class="kpi-label" style="color: var(--state-success)">Ya Descontados</span>
            <span class="kpi-value" style="color: var(--state-success)">
              {{ clp(facade.kpis().totalDescontado) }}
            </span>
            <span class="text-xs" style="color: var(--text-muted)"
              >en liquidaciones anteriores</span
            >
          }
        </div>
      </div>

      <!-- ── Cuenta Corriente por Instructor ───────────────────────────────── -->
      <div class="card p-0 overflow-hidden">
        <div
          class="flex items-center gap-2 px-5 py-4"
          style="border-bottom: 1px solid var(--border-subtle)"
        >
          <span class="indicator-live"></span>
          <span class="text-sm font-semibold" style="color: var(--text-primary)">
            Cuenta Corriente por Instructor
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle)">
                <th
                  class="text-left px-5 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Instructor
                </th>
                <th
                  class="text-left px-4 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Tipo
                </th>
                <th
                  class="text-right px-4 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Anticipos Totales
                </th>
                <th
                  class="text-right px-4 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Saldo Pendiente
                </th>
                <th
                  class="text-center px-4 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Último Anticipo
                </th>
                <th
                  class="text-center px-4 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Estado
                </th>
                <th
                  class="text-center px-4 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              @if (facade.isLoading()) {
                @for (i of skeletonRows; track i) {
                  <tr style="border-bottom: 1px solid var(--border-subtle)">
                    @for (j of skeletonCols; track j) {
                      <td class="px-5 py-3">
                        <app-skeleton-block variant="text" width="80%" height="14px" />
                      </td>
                    }
                  </tr>
                }
              } @else if (facade.cuentaCorriente().length === 0) {
                <tr>
                  <td
                    colspan="7"
                    class="px-5 py-10 text-center text-sm"
                    style="color: var(--text-muted)"
                  >
                    No hay instructores registrados.
                  </td>
                </tr>
              } @else {
                @for (row of facade.cuentaCorriente(); track row.instructorId) {
                  <tr style="border-bottom: 1px solid var(--border-subtle)" class="hover-row">
                    <!-- Instructor -->
                    <td class="px-5 py-3 font-semibold" style="color: var(--text-primary)">
                      {{ row.nombre }}
                    </td>
                    <!-- Tipo -->
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                        style="background: var(--bg-surface-elevated); color: var(--text-secondary)"
                      >
                        {{ row.tipoLabel }}
                      </span>
                    </td>
                    <!-- Anticipos Totales -->
                    <td class="px-4 py-3 text-right" style="color: var(--text-primary)">
                      {{ clp(row.anticiposTotales) }}
                    </td>
                    <!-- Saldo Pendiente -->
                    <td class="px-4 py-3 text-right font-semibold">
                      @if (row.saldoPendiente > 0) {
                        <span style="color: var(--state-warning)">{{
                          clp(row.saldoPendiente)
                        }}</span>
                      } @else {
                        <span style="color: var(--state-success)">{{ clp(0) }}</span>
                      }
                    </td>
                    <!-- Último Anticipo -->
                    <td class="px-4 py-3 text-center">
                      @if (row.ultimoAnticipo) {
                        <span style="color: var(--ds-brand)">{{ row.ultimoAnticipo }}</span>
                      } @else {
                        <span style="color: var(--text-muted)">—</span>
                      }
                    </td>
                    <!-- Estado -->
                    <td class="px-4 py-3 text-center">
                      @if (row.estado === 'pendiente') {
                        <span
                          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                          style="background: var(--state-warning-bg, rgba(251,146,60,0.12)); color: var(--state-warning)"
                        >
                          Saldo pendiente
                        </span>
                      } @else {
                        <span
                          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                          style="background: var(--state-success-bg, rgba(34,197,94,0.12)); color: var(--state-success)"
                        >
                          <app-icon name="check" [size]="10" />
                          Al día
                        </span>
                      }
                    </td>
                    <!-- Acciones -->
                    <td class="px-4 py-3 text-center">
                      <div class="flex items-center justify-center gap-2">
                        <button
                          class="btn-ghost p-1.5 rounded-lg"
                          title="Ver historial de este instructor"
                          data-llm-action="ver-historial-instructor"
                          style="color: var(--text-muted)"
                        >
                          <app-icon name="file-text" [size]="16" />
                        </button>
                        @if (row.estado === 'pendiente') {
                          <button
                            class="btn-ghost p-1.5 rounded-lg"
                            title="Registrar anticipo"
                            data-llm-action="registrar-anticipo-instructor"
                            style="color: var(--text-muted)"
                            (click)="onRegistrarAnticipo()"
                          >
                            <app-icon name="check" [size]="16" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Historial de Anticipos ─────────────────────────────────────────── -->
      <div class="card p-0 overflow-hidden">
        <div
          class="flex items-center justify-between px-5 py-4"
          style="border-bottom: 1px solid var(--border-subtle)"
        >
          <span class="text-sm font-semibold" style="color: var(--text-primary)">
            Historial de Anticipos
          </span>
          @if (!facade.isLoading()) {
            <span class="text-sm font-medium" style="color: var(--ds-brand)">
              {{ facade.historial().length }} registros
            </span>
          }
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle)">
                <th
                  class="text-left px-5 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Fecha
                </th>
                <th
                  class="text-left px-5 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Instructor
                </th>
                <th
                  class="text-left px-5 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Motivo
                </th>
                <th
                  class="text-right px-5 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Monto
                </th>
                <th
                  class="text-center px-5 py-3 font-medium uppercase tracking-wide text-xs"
                  style="color: var(--text-muted)"
                >
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              @if (facade.isLoading()) {
                @for (i of skeletonRows; track i) {
                  <tr style="border-bottom: 1px solid var(--border-subtle)">
                    @for (j of histSkelCols; track j) {
                      <td class="px-5 py-3">
                        <app-skeleton-block variant="text" width="75%" height="14px" />
                      </td>
                    }
                  </tr>
                }
              } @else if (facade.historial().length === 0) {
                <tr>
                  <td
                    colspan="5"
                    class="px-5 py-10 text-center text-sm"
                    style="color: var(--text-muted)"
                  >
                    No hay anticipos registrados aún.
                  </td>
                </tr>
              } @else {
                @for (adv of facade.historial(); track adv.id) {
                  <tr class="hover-row" style="border-bottom: 1px solid var(--border-subtle)">
                    <td class="px-5 py-3">
                      <span style="color: var(--ds-brand)">{{ adv.fecha }}</span>
                    </td>
                    <td class="px-5 py-3 font-semibold" style="color: var(--text-primary)">
                      {{ adv.instructorNombre }}
                    </td>
                    <td class="px-5 py-3" style="color: var(--text-secondary)">
                      {{ adv.motivo }}
                    </td>
                    <td
                      class="px-5 py-3 text-right font-semibold"
                      style="color: var(--state-warning)"
                    >
                      {{ clp(adv.monto) }}
                    </td>
                    <td class="px-5 py-3 text-center">
                      <span [class]="badgeClass(adv)">
                        @if (adv.estado !== 'pending') {
                          <app-icon name="check" [size]="10" />
                        }
                        {{ adv.estado === 'pending' ? 'Pendiente' : 'Descontado' }}
                      </span>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Nota informativa al pie -->
        <div
          class="px-5 py-3 text-xs"
          style="border-top: 1px solid var(--border-subtle); background: var(--state-warning-bg, rgba(251,146,60,0.06)); color: var(--text-muted)"
        >
          <span class="font-semibold" style="color: var(--text-secondary)">Nota:</span>
          Los anticipos pendientes se descuentan automáticamente en la liquidación de sueldo
          mensual. El instructor puede solicitar anticipos hasta un máximo del 50% de su sueldo
          mensual.
        </div>
      </div>
    </div>
  `,
  styles: `
    .hover-row:hover {
      background: var(--bg-surface-elevated);
    }
    .hover-row {
      transition: background 0.15s;
    }
    .badge-pending {
      background: var(--state-warning-bg, rgba(251, 146, 60, 0.12));
      color: var(--state-warning);
    }
    .badge-discounted {
      background: var(--state-success-bg, rgba(34, 197, 94, 0.12));
      color: var(--state-success);
    }
  `,
})
export class AdminContabilidadAnticiposComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(AnticiosFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly pageRef = viewChild<ElementRef<HTMLElement>>('pageRef');

  protected readonly clp = clp;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly skeletonCols = [1, 2, 3, 4, 5, 6, 7];
  protected readonly histSkelCols = [1, 2, 3, 4, 5];

  protected readonly heroActions: SectionHeroAction[] = [
    {
      id: 'registrar-anticipo',
      label: 'Registrar Anticipo',
      icon: 'plus',
      primary: true,
    },
  ];

  ngOnInit(): void {
    this.facade.initialize();
  }

  ngAfterViewInit(): void {
    const el = this.pageRef()?.nativeElement;
    if (el) this.gsap.animateBentoGrid(el);
  }

  protected onHeroAction(id: string): void {
    if (id === 'registrar-anticipo') this.onRegistrarAnticipo();
  }

  protected onRegistrarAnticipo(): void {
    this.drawer.open(RegistrarAnticipoDrawerComponent, 'Registrar Anticipo', 'banknote');
  }

  protected badgeClass(adv: AnticipoHistorial): string {
    const base = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium';
    return adv.estado === 'pending' ? `${base} badge-pending` : `${base} badge-discounted`;
  }
}
