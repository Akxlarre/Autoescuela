import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type { AnticipoCuentaCorriente, AnticipoHistorial } from '@core/models/ui/anticipos.model';
import { RegistrarAnticipoDrawerComponent } from './registrar-anticipo-drawer.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { BadgeComponent } from '@shared/components/badge/badge.component';

type AnticiposTab = 'cuenta-corriente' | 'historial';

// ─── Formatter ───────────────────────────────────────────────────────────────

const clpFmt = new Intl.NumberFormat('es-CL', { style: 'decimal', maximumFractionDigits: 0 });
function clp(n: number): string {
  return `$${clpFmt.format(n)}`;
}

@Component({
  selector: 'app-admin-contabilidad-anticipos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    SectionHeroComponent,
    IconComponent,
    SkeletonBlockComponent,
    AlertCardComponent,
    TabsComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen-kpi"
      [class.force-compact]="drawer.isOpen()"
      appBentoGridLayout
      #pageRef
    >
      <!-- ── Hero ─────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Anticipos a Instructores"
        contextLine="Contabilidad"
        subtitle="RF-038 · Cuenta corriente interna y gestión de anticipos"
        icon="banknote"
        [actions]="heroActions"
        [kpis]="heroKpis()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── Error ─────────────────────────────────────────────────────────── -->
      @if (facade.error()) {
        <div class="bento-banner">
          <app-alert-card severity="error" title="Error al cargar anticipos">
            {{ facade.error() }}
          </app-alert-card>
        </div>
      }

      <!-- ── Tabs (Cuenta Corriente / Historial) ─────────────────────────────── -->
      <app-tabs
        class="bento-banner"
        [tabs]="tabOptions()"
        [activeId]="activeTab()"
        variant="segmented"
        (activeIdChange)="setActiveTab($event)"
      />

      <!-- ── Panel (celda única .bento-fill, sin importar la tab activa) ─────── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col h-full dual-viewport-container"
        appCardHover
      >
        @switch (activeTab()) {
          @case ('cuenta-corriente') {
            <div
              class="shrink-0 flex items-center gap-2 px-5 py-4"
              style="border-bottom: 1px solid var(--border-subtle)"
            >
              <span class="indicator-live"></span>
              <span class="item-title"> Cuenta Corriente por Instructor </span>
            </div>

            <!-- VISTA Desktop: tabla -->
            <div
              class="desktop-view hide-on-squeeze flex-1 min-h-0 overflow-y-auto overflow-x-auto"
            >
              <table class="w-full text-sm">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-subtle)">
                    <th class="micro-label text-left px-5 py-3">Instructor</th>
                    <th class="micro-label text-left px-4 py-3">Tipo</th>
                    <th class="micro-label text-right px-4 py-3">Anticipos Totales</th>
                    <th class="micro-label text-right px-4 py-3">Saldo Pendiente</th>
                    <th class="micro-label text-center px-4 py-3">Último Anticipo</th>
                    <th class="micro-label text-center px-4 py-3">Estado</th>
                    <th class="micro-label text-center px-4 py-3">Acciones</th>
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
                      <td colspan="7" class="px-5 py-10 text-center text-sm text-text-muted">
                        No hay instructores registrados.
                      </td>
                    </tr>
                  } @else {
                    @for (row of facade.cuentaCorriente(); track row.instructorId) {
                      <tr style="border-bottom: 1px solid var(--border-subtle)" class="hover-row">
                        <!-- Instructor -->
                        <td class="px-5 py-3 font-semibold text-text-primary">
                          {{ row.nombre }}
                        </td>
                        <!-- Tipo -->
                        <td class="px-4 py-3">
                          <app-badge variant="neutral">{{ row.tipoLabel }}</app-badge>
                        </td>
                        <!-- Anticipos Totales -->
                        <td class="px-4 py-3 text-right text-text-primary">
                          {{ clp(row.anticiposTotales) }}
                        </td>
                        <!-- Saldo Pendiente -->
                        <td class="px-4 py-3 text-right font-semibold">
                          @if (row.saldoPendiente > 0) {
                            <span class="text-warning">{{ clp(row.saldoPendiente) }}</span>
                          } @else {
                            <span class="text-success">{{ clp(0) }}</span>
                          }
                        </td>
                        <!-- Último Anticipo -->
                        <td class="px-4 py-3 text-center">
                          @if (row.ultimoAnticipo) {
                            <span class="text-brand">{{ row.ultimoAnticipo }}</span>
                          } @else {
                            <span class="text-text-muted">—</span>
                          }
                        </td>
                        <!-- Estado -->
                        <td class="px-4 py-3 text-center">
                          @if (row.estado === 'pendiente') {
                            <app-badge variant="warning"> Saldo pendiente </app-badge>
                          } @else {
                            <app-badge variant="success">
                              <app-icon name="check" [size]="10" />
                              Al día
                            </app-badge>
                          }
                        </td>
                        <!-- Acciones -->
                        <td class="px-4 py-3 text-center">
                          <div class="flex items-center justify-center gap-2">
                            @if (row.estado === 'pendiente') {
                              <button
                                aria-label="Registrar anticipo"
                                class="btn-ghost w-8 h-8 text-text-muted"
                                title="Registrar anticipo"
                                data-llm-action="registrar-anticipo-instructor"
                                (click)="onRegistrarAnticipo(row.instructorId)"
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

            <!-- VISTA Mobile: cards -->
            <div class="mobile-view show-on-squeeze flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              @if (facade.isLoading()) {
                @for (i of skeletonRows; track i) {
                  <div class="rounded-xl p-4 flex flex-col gap-3 border border-border-muted">
                    <div class="h-4 rounded w-3/4 bg-text-muted/14"></div>
                    <div class="h-3 rounded w-1/2 bg-text-muted/10"></div>
                    <div class="h-8 rounded w-full bg-text-muted/8"></div>
                  </div>
                }
              } @else if (facade.cuentaCorriente().length === 0) {
                <div class="py-12 text-center">
                  <p class="text-sm text-text-muted">No hay instructores registrados.</p>
                </div>
              } @else {
                @for (row of facade.cuentaCorriente(); track row.instructorId) {
                  <div class="rounded-xl border overflow-hidden border-border-muted bg-surface">
                    <div class="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="item-title truncate">{{ row.nombre }}</p>
                        <div class="mt-1">
                          <app-badge variant="neutral">{{ row.tipoLabel }}</app-badge>
                        </div>
                      </div>
                      @if (row.estado === 'pendiente') {
                        <app-badge variant="warning">Saldo pendiente</app-badge>
                      } @else {
                        <app-badge variant="success">
                          <app-icon name="check" [size]="10" />
                          Al día
                        </app-badge>
                      }
                    </div>
                    <div
                      class="grid grid-cols-2 divide-x divide-border-muted border-t border-b border-border-muted"
                    >
                      <div class="py-3 px-4 flex flex-col gap-0.5">
                        <p class="micro-label">Anticipos Totales</p>
                        <p class="item-title">{{ clp(row.anticiposTotales) }}</p>
                      </div>
                      <div class="py-3 px-4 flex flex-col gap-0.5">
                        <p class="micro-label">Saldo Pendiente</p>
                        @if (row.saldoPendiente > 0) {
                          <p class="text-sm font-semibold text-warning">
                            {{ clp(row.saldoPendiente) }}
                          </p>
                        } @else {
                          <p class="text-sm font-semibold text-success">{{ clp(0) }}</p>
                        }
                      </div>
                    </div>
                    <div class="px-4 py-2 flex items-center justify-between gap-2">
                      <p class="text-xs text-text-muted">
                        Último:
                        @if (row.ultimoAnticipo) {
                          <span class="text-brand">{{ row.ultimoAnticipo }}</span>
                        } @else {
                          —
                        }
                      </p>
                      <div class="flex items-center gap-1 shrink-0">
                        @if (row.estado === 'pendiente') {
                          <button
                            aria-label="Registrar anticipo"
                            class="btn-ghost w-8 h-8 text-text-muted"
                            data-llm-action="registrar-anticipo-instructor"
                            (click)="onRegistrarAnticipo(row.instructorId)"
                          >
                            <app-icon name="check" [size]="16" />
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                }
              }
            </div>
          }
          @case ('historial') {
            <div
              class="shrink-0 flex items-center justify-between px-5 py-4"
              style="border-bottom: 1px solid var(--border-subtle)"
            >
              <span class="item-title"> Historial de Anticipos </span>
              @if (!facade.isLoading()) {
                <span class="text-sm font-medium text-brand">
                  {{ facade.historial().length }} registros
                </span>
              }
            </div>

            <!-- VISTA Desktop: tabla -->
            <div
              class="desktop-view hide-on-squeeze flex-1 min-h-0 overflow-y-auto overflow-x-auto"
            >
              <table class="w-full text-sm">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-subtle)">
                    <th class="micro-label text-left px-5 py-3">Fecha</th>
                    <th class="micro-label text-left px-5 py-3">Instructor</th>
                    <th class="micro-label text-left px-5 py-3">Motivo</th>
                    <th class="micro-label text-right px-5 py-3">Monto</th>
                    <th class="micro-label text-center px-5 py-3">Estado</th>
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
                      <td colspan="5" class="px-5 py-10 text-center text-sm text-text-muted">
                        No hay anticipos registrados aún.
                      </td>
                    </tr>
                  } @else {
                    @for (adv of facade.historial(); track adv.id) {
                      <tr class="hover-row" style="border-bottom: 1px solid var(--border-subtle)">
                        <td class="px-5 py-3">
                          <span class="text-brand">{{ adv.fecha }}</span>
                        </td>
                        <td class="px-5 py-3 font-semibold text-text-primary">
                          {{ adv.instructorNombre }}
                        </td>
                        <td class="px-5 py-3 text-text-secondary">
                          {{ adv.motivo }}
                        </td>
                        <td class="px-5 py-3 text-right font-semibold text-warning">
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

            <!-- VISTA Mobile: cards -->
            <div class="mobile-view show-on-squeeze flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              @if (facade.isLoading()) {
                @for (i of skeletonRows; track i) {
                  <div class="rounded-xl p-4 flex flex-col gap-2 border border-border-muted">
                    <div class="h-4 rounded w-3/4 bg-text-muted/14"></div>
                    <div class="h-3 rounded w-1/2 bg-text-muted/10"></div>
                  </div>
                }
              } @else if (facade.historial().length === 0) {
                <div class="py-12 text-center">
                  <p class="text-sm text-text-muted">No hay anticipos registrados aún.</p>
                </div>
              } @else {
                @for (adv of facade.historial(); track adv.id) {
                  <div
                    class="rounded-xl border overflow-hidden border-border-muted bg-surface p-4 flex flex-col gap-2"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="item-title truncate">{{ adv.instructorNombre }}</p>
                        <p class="text-xs text-text-muted">
                          <span class="text-brand">{{ adv.fecha }}</span>
                        </p>
                      </div>
                      <span [class]="badgeClass(adv)">
                        @if (adv.estado !== 'pending') {
                          <app-icon name="check" [size]="10" />
                        }
                        {{ adv.estado === 'pending' ? 'Pendiente' : 'Descontado' }}
                      </span>
                    </div>
                    <p class="text-xs text-text-secondary">{{ adv.motivo }}</p>
                    <p class="text-sm font-semibold text-warning">{{ clp(adv.monto) }}</p>
                  </div>
                }
              }
            </div>

            <!-- Nota informativa al pie -->
            <div
              class="shrink-0 px-5 py-3 text-xs text-text-muted"
              style="border-top: 1px solid var(--border-subtle); background: var(--state-warning-bg, rgba(251,146,60,0.06))"
            >
              <span class="font-semibold text-text-secondary">Nota:</span>
              Los anticipos pendientes se descuentan automáticamente en la liquidación de sueldo
              mensual. El instructor puede solicitar anticipos hasta un máximo del 50% de su sueldo
              mensual.
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .hover-row:hover {
      background: var(--bg-elevated);
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
    .dual-viewport-container {
      container-type: inline-size;
      container-name: anticiposContainer;
    }
    .show-on-squeeze {
      display: none;
    }
    @container anticiposContainer (max-width: 900px) {
      .hide-on-squeeze {
        display: none !important;
      }
      .show-on-squeeze {
        display: block !important;
      }
    }
  `,
})
export class AdminContabilidadAnticiposComponent implements AfterViewInit {
  protected readonly facade = inject(AnticiposFacade);
  private readonly branchFacade = inject(BranchFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly pageRef = viewChild<ElementRef<HTMLElement>>('pageRef');

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId(); // tracking
      this.facade.initialize();
    });
  }

  protected readonly clp = clp;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly skeletonCols = [1, 2, 3, 4, 5, 6, 7];
  protected readonly histSkelCols = [1, 2, 3, 4, 5];

  // ── Tabs (Cuenta Corriente / Historial) ─────────────────────────────────────
  protected readonly activeTab = signal<AnticiposTab>('cuenta-corriente');

  protected readonly tabOptions = computed((): TabOption[] => [
    { id: 'cuenta-corriente', label: 'Cuenta Corriente', icon: 'wallet' },
    { id: 'historial', label: 'Historial', icon: 'history', count: this.facade.historial().length },
  ]);

  protected setActiveTab(tabId: string): void {
    this.activeTab.set(tabId as AnticiposTab);
  }

  protected readonly heroActions: SectionHeroAction[] = [
    {
      id: 'registrar-anticipo',
      label: 'Registrar Anticipo',
      icon: 'plus',
      primary: true,
    },
  ];

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'pendiente',
      label: 'Anticipos Pendientes',
      value: clp(this.facade.kpis().totalPendiente),
      icon: 'banknote',
      color: 'warning',
    },
    {
      id: 'historico',
      label: 'Total Anticipado',
      value: clp(this.facade.kpis().totalHistorico),
      icon: 'history',
    },
    {
      id: 'descontado',
      label: 'Ya Descontados',
      value: clp(this.facade.kpis().totalDescontado),
      icon: 'check-circle',
      color: 'success',
    },
  ]);

  ngAfterViewInit(): void {
    const el = this.pageRef()?.nativeElement;
    if (el) this.gsap.animateBentoGrid(el);
  }

  protected onHeroAction(id: string): void {
    if (id === 'registrar-anticipo') this.onRegistrarAnticipo();
  }

  protected onRegistrarAnticipo(instructorId?: number): void {
    this.facade.selectInstructor(instructorId ?? null);
    this.drawer.open(RegistrarAnticipoDrawerComponent, 'Registrar Anticipo', 'banknote');
  }

  protected badgeClass(adv: AnticipoHistorial): string {
    const base = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium';
    return adv.estado === 'pending' ? `${base} badge-pending` : `${base} badge-discounted`;
  }
}
