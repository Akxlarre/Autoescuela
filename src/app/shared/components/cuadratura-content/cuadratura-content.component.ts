import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { formatCLP } from '@core/utils/date.utils';
import { buildCuadraturaHeroKpis } from '@core/utils/cuadratura-hero-kpis.utils';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import type { EgresoRow, IngresoRow } from '@core/models/ui/cuadratura.model';

@Component({
  selector: 'app-cuadratura-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    EmptyStateComponent,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen bento-grid--rows-fit"
      appBentoGridLayout
      #bentoGrid
      [class.force-compact]="isDrawerOpen()"
    >
      <!-- ── Header ─────────────────────────────────────────────────────────── -->
      <div class="bento-banner relative overflow-visible">
        <app-section-hero
          density="slim"
          [animateOnInit]="false"
          [loading]="isLoading()"
          title="Cuadratura Diaria"
          icon="calculator"
          [contextLine]="fechaHoy()"
          [chips]="heroChips()"
          [kpis]="heroKpis()"
          [loadingKpiCount]="4"
          [actions]="heroActions()"
          (actionClick)="onHeroAction($event)"
        />
        @if (exportMenuOpen()) {
          <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
          <div class="export-menu absolute top-14 right-4 z-20">
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('excel')"
              data-llm-action="export-cuadratura-excel"
            >
              <app-icon name="table-2" [size]="16" />
              Exportar como Excel
            </button>
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('pdf')"
              data-llm-action="export-cuadratura-pdf"
            >
              <app-icon name="file-text" [size]="16" />
              Exportar como PDF
            </button>
          </div>
        }
      </div>

      <!-- ── Contenido: Ingresos + Egresos como DOS columnas (fix-230-m) — los dos
           términos de la resta de caja, visibles juntos. "flex, no grid, para las
           columnas internas: solo flex propaga el alto" (spec 0031, visual-system.md).
           Cada columna tiene su propio scroll interno. Ingresos es el protagonista
           (flex-[3]), Egresos más compacto (flex-[2]).
           Layout row/col por CONTENEDOR, no por breakpoint de viewport (spec 0030):
           .cuadratura-cols va en fila cuando la celda supera ~900px (@container) y
           vuelve a columna con el drawer abierto (:host-context(.force-compact)).
           "Arqueo y Cierre" sigue siendo solo un botón del Hero, no una columna. ── -->
      <div class="bento-banner bento-fill cuadratura-stack flex flex-col min-h-0">
        <!-- Contenedor de medición: el container-type NO va en la celda .bento-fill
             (rompe su size-containment y deja de llenar la pantalla). Va en este
             wrapper interno, precedente en este mismo archivo. -->
        <div
          class="flex flex-col flex-1 min-h-0"
          style="container-type: inline-size; container-name: cuadratura-stack"
        >
          <div class="cuadratura-cols flex flex-col gap-6 flex-1 min-h-0">
            <!-- REGISTRO DE INGRESOS -->
            <div
              class="bento-card p-0 flex flex-col overflow-hidden shadow-sm cuadratura-stack-ingresos min-h-0"
              appCardHover
            >
              <!-- Header -->
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-border-muted/50"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0"
                  >
                    <app-icon name="trending-up" [size]="20" color="var(--color-primary)" />
                  </div>
                  <div>
                    <h2 class="font-bold text-text-primary">Registro de Ingresos</h2>
                    <p class="text-compact text-text-muted mt-0.5">
                      Detalle de pagos y boletas recibidos en el día.
                    </p>
                  </div>
                </div>
                <button
                  class="btn-primary flex items-center gap-2 text-compact px-5 py-2.5 rounded-xl shrink-0 transition-transform active:scale-[0.98] shadow-sm"
                  data-llm-action="agregar-ingreso-cuadratura"
                  [disabled]="cajaYaCerrada()"
                  [style.opacity]="cajaYaCerrada() ? '0.5' : '1'"
                  aria-label="Agregar nuevo ingreso"
                  (click)="abrirIngreso.emit()"
                >
                  <app-icon name="plus" [size]="16" />
                  <span class="font-bold">Agregar Ingreso</span>
                </button>
              </div>

              <!-- Tabla (Desktop) / Cards (Mobile) -->
              <div class="flex flex-col flex-1 min-h-0" style="container-type: inline-size;">
                <!-- Header Columnas (Desktop) — fijo, NO scrollea con las filas (spec 0004-i,
                   feedback: "no debería moverse con el app-like, solo los datos de abajo") -->
                <div class="hidden sm:block shrink-0" [class.!hidden]="isDrawerOpen()">
                  <div
                    class="px-6 py-3 grid items-center gap-2 text-2xs font-bold uppercase tracking-widest text-text-muted bg-subtle border-y border-border-muted/50"
                    style="grid-template-columns: 80px 1fr 85px 85px 85px 85px 100px 36px"
                  >
                    <span>N° Boleta</span>
                    <span>Glosa / Alumno</span>
                    <span class="text-right">Efectivo</span>
                    <span class="text-right">Transf.</span>
                    <span class="text-right">Voucher</span>
                    <span class="text-right">Tarjeta</span>
                    <span class="text-right text-text-primary">Total</span>
                    <span></span>
                  </div>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto overflow-x-auto flex flex-col">
                  @if (!isLoading() && pagosHoy().length === 0) {
                    <!-- Empty state: centrado en el alto disponible cuando la card
                         llena la pantalla; caja de ~200px cuando la card es de
                         alto natural (drawer abierto) — fix-230-m. -->
                    <div class="flex flex-1 items-center justify-center min-h-50">
                      <app-empty-state message="No hay ingresos registrados hoy." />
                    </div>
                  } @else {
                    <!-- Vista Desktop (Table) -->
                    <div class="hidden sm:block" [class.!hidden]="isDrawerOpen()">
                      <!-- Filas -->
                      @if (isLoading()) {
                        <div class="divide-y divide-border-muted/50">
                          @for (row of [1, 2, 3]; track row) {
                            <div
                              class="px-6 py-4 grid gap-2 items-center"
                              style="grid-template-columns: 80px 1fr 85px 85px 85px 85px 100px 36px"
                            >
                              <app-skeleton-block variant="text" width="60px" height="14px" />
                              <app-skeleton-block variant="text" width="80%" height="14px" />
                              <app-skeleton-block
                                variant="text"
                                width="50px"
                                height="14px"
                                class="ml-auto"
                              />
                              <app-skeleton-block
                                variant="text"
                                width="50px"
                                height="14px"
                                class="ml-auto"
                              />
                              <app-skeleton-block
                                variant="text"
                                width="50px"
                                height="14px"
                                class="ml-auto"
                              />
                              <app-skeleton-block
                                variant="text"
                                width="50px"
                                height="14px"
                                class="ml-auto"
                              />
                              <app-skeleton-block
                                variant="text"
                                width="70px"
                                height="18px"
                                class="ml-auto"
                              />
                              <div></div>
                            </div>
                          }
                        </div>
                      } @else {
                        <div class="divide-y divide-border-muted/50">
                          @for (fila of pagosHoy(); track fila.id) {
                            <div
                              class="px-6 py-3.5 grid gap-2 items-center hover:bg-subtle transition-colors group"
                              style="grid-template-columns: 80px 1fr 85px 85px 85px 85px 100px 36px"
                            >
                              <span class="text-compact font-mono font-medium text-text-secondary">
                                {{ fila.nBoleta ?? '—' }}
                              </span>
                              <span class="text-compact font-semibold text-text-primary truncate">
                                {{ fila.glosa }}
                              </span>
                              <span
                                class="text-compact text-right text-text-secondary tabular-nums"
                              >
                                {{ fila.claseB > 0 ? fila.claseB.toLocaleString('es-CL') : '—' }}
                              </span>
                              <span
                                class="text-compact text-right text-text-secondary tabular-nums"
                              >
                                {{ fila.claseA > 0 ? fila.claseA.toLocaleString('es-CL') : '—' }}
                              </span>
                              <span
                                class="text-compact text-right text-text-secondary tabular-nums"
                              >
                                {{ fila.sence > 0 ? fila.sence.toLocaleString('es-CL') : '—' }}
                              </span>
                              <span
                                class="text-compact text-right text-text-secondary tabular-nums"
                              >
                                {{ fila.otros > 0 ? fila.otros.toLocaleString('es-CL') : '—' }}
                              </span>
                              <span
                                class="text-sm text-right font-black text-text-primary tabular-nums tracking-tight"
                              >
                                {{ clp(fila.total) }}
                              </span>
                              <button
                                class="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:bg-error/10 hover:text-error transition-all focus-visible:opacity-100 ml-auto cursor-pointer"
                                [disabled]="cajaYaCerrada()"
                                [attr.aria-label]="'Eliminar ingreso ' + (fila.nBoleta ?? fila.id)"
                                (click)="onEliminarIngreso(fila, $event)"
                              >
                                <app-icon name="trash-2" [size]="15" />
                              </button>
                            </div>
                          }
                        </div>
                      }
                    </div>

                    <!-- Vista Mobile (Cards) se activa por Container Query o Drawer abierto -->
                    <div class="sm:hidden flex flex-col gap-3 p-4" [class.!flex]="isDrawerOpen()">
                      @if (isLoading()) {
                        @for (i of [1, 2]; track i) {
                          <div
                            class="p-4 rounded-xl border border-border-muted/50 flex flex-col gap-3"
                          >
                            <app-skeleton-block variant="text" width="60%" height="16px" />
                            <div class="flex justify-between">
                              <app-skeleton-block variant="text" width="30%" height="14px" />
                              <app-skeleton-block variant="text" width="30%" height="14px" />
                            </div>
                          </div>
                        }
                      } @else {
                        @for (fila of pagosHoy(); track fila.id) {
                          <div class="card-mobile-ingreso">
                            <div class="flex justify-between items-start mb-2">
                              <div class="flex flex-col">
                                <span
                                  class="text-2xs font-bold text-text-muted uppercase tracking-wider"
                                  >Boleta {{ fila.nBoleta ?? 'S/N' }}</span
                                >
                                <span class="item-title">{{ fila.glosa }}</span>
                              </div>
                              <button
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error transition-colors cursor-pointer"
                                [disabled]="cajaYaCerrada()"
                                aria-label="Eliminar ingreso"
                                (click)="onEliminarIngreso(fila, $event)"
                              >
                                <app-icon name="trash-2" [size]="14" />
                              </button>
                            </div>
                            <div
                              class="grid grid-cols-2 gap-y-2 mt-2 pt-2 border-t border-border-muted/30"
                            >
                              <div class="flex flex-col">
                                <span class="text-2xs text-text-muted uppercase">Conceptos</span>
                                <div class="flex flex-wrap gap-1 mt-0.5">
                                  @if (fila.claseB > 0) {
                                    <span class="badge-mini">Efectivo</span>
                                  }
                                  @if (fila.claseA > 0) {
                                    <span class="badge-mini">Transf.</span>
                                  }
                                  @if (fila.sence > 0) {
                                    <span class="badge-mini">Voucher</span>
                                  }
                                  @if (fila.otros > 0) {
                                    <span class="badge-mini">Tarjeta</span>
                                  }
                                </div>
                              </div>
                              <div class="flex flex-col items-end">
                                <span class="text-2xs text-text-muted uppercase">Total</span>
                                <span class="text-text-primary font-black">{{
                                  clp(fila.total)
                                }}</span>
                              </div>
                            </div>
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Footer: conteo a la izquierda; total (todos los métodos) +
                   subtotal en efectivo en pastilla de 2 líneas — fix-230-m. -->
              <div
                class="px-6 py-5 flex items-center justify-between gap-4 border-t border-border-muted/50 bg-surface mt-auto"
              >
                <span class="text-2xs font-bold uppercase tracking-widest text-text-muted">
                  Mostrando {{ pagosHoy().length }} ingresos
                </span>
                <div class="min-w-52 bg-brand/5 px-4 py-2 rounded-xl border border-brand/10">
                  <div class="flex items-center justify-between gap-4">
                    <span
                      class="text-2xs font-black uppercase tracking-widest opacity-80 text-brand"
                    >
                      Total Ingresos
                    </span>
                    <span class="text-xl font-black tabular-nums tracking-tight text-brand">
                      {{ clp(totalIngresosHoy()) }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-4 mt-0.5">
                    <span class="text-2xs font-semibold uppercase tracking-wide text-text-muted">
                      en efectivo
                    </span>
                    <span class="text-sm font-bold tabular-nums text-text-secondary">
                      {{ clp(ingresosEfectivoHoy()) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- REGISTRO DE EGRESOS (debajo de Ingresos, más compacto — spec 0004-i 3ª iteración) -->
            <div
              class="bento-card p-0 flex flex-col overflow-hidden shadow-sm cuadratura-stack-egresos min-h-0"
              appCardHover
            >
              <!-- Header simétrico con "Registro de Ingresos": mismo tamaño de
                   ícono, título + subtítulo, y botón que baja de línea en
                   contenedor angosto (fix-230-m). -->
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-border-muted/50"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0"
                  >
                    <app-icon name="trending-down" [size]="20" color="var(--state-warning)" />
                  </div>
                  <div>
                    <h2 class="font-bold text-text-primary">Egresos / Retiros</h2>
                    <p class="text-compact text-text-muted mt-0.5">
                      Retiros y gastos pagados desde la caja.
                    </p>
                  </div>
                </div>
                <button
                  class="btn-primary flex items-center gap-2 text-compact px-5 py-2.5 rounded-xl shrink-0 transition-transform active:scale-[0.98] shadow-sm"
                  data-llm-action="agregar-egreso-cuadratura"
                  [disabled]="cajaYaCerrada()"
                  [style.opacity]="cajaYaCerrada() ? '0.5' : '1'"
                  aria-label="Agregar nuevo egreso"
                  (click)="abrirEgreso.emit()"
                >
                  <app-icon name="plus" [size]="16" />
                  <span class="font-bold">Agregar Egreso</span>
                </button>
              </div>

              <!-- Header de columnas fijo (no scrollea con las filas), simétrico
                   con el de Ingresos: se ve también con la lista vacía. -->
              <div
                class="shrink-0 px-6 py-3 grid grid-cols-[1fr_116px_84px_24px] gap-3 text-2xs font-bold uppercase tracking-widest text-text-muted bg-subtle border-y border-border-muted/50"
              >
                <span>Motivo</span>
                <span>Método</span>
                <span class="text-right">Monto</span>
                <span></span>
              </div>

              <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
                @if (!isLoading() && gastosHoy().length === 0) {
                  <!-- Empty state: centrado en el alto disponible cuando la card
                       llena la pantalla; caja de ~200px cuando la card es de alto
                       natural (drawer abierto) — fix-230-m. -->
                  <div class="flex flex-1 items-center justify-center min-h-50">
                    <app-empty-state message="No hay egresos registrados hoy." />
                  </div>
                } @else {
                  @if (isLoading()) {
                    <div class="divide-y divide-border-muted/50">
                      @for (i of [1, 2]; track i) {
                        <div
                          class="px-6 py-3.5 grid grid-cols-[1fr_116px_84px_24px] gap-3 items-center"
                        >
                          <app-skeleton-block variant="text" width="80%" height="14px" />
                          <app-skeleton-block variant="text" width="64px" height="14px" />
                          <app-skeleton-block
                            variant="text"
                            width="60px"
                            height="14px"
                            class="ml-auto"
                          />
                          <div></div>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="divide-y divide-border-muted/50">
                      @for (egreso of gastosHoy(); track egreso.id + egreso.tipo) {
                        <div
                          class="px-6 py-3 grid grid-cols-[1fr_116px_84px_24px] gap-3 items-start group hover:bg-subtle transition-colors"
                        >
                          <span class="flex items-start gap-2 min-w-0">
                            @if (categoryIcon(egreso); as icon) {
                              <!-- El ícono de color ya identifica la categoría; su
                                   nombre va en title/aria en vez de un badge que
                                   robaba ancho a la descripción (fix-230-m). -->
                              <span
                                class="flex items-center justify-center w-6 h-6 rounded-md bg-warning/10 shrink-0 mt-px"
                                [attr.title]="categoryLabel(egreso)"
                                [attr.aria-label]="categoryLabel(egreso)"
                              >
                                <app-icon [name]="icon" [size]="12" color="var(--state-warning)" />
                              </span>
                            }
                            <span
                              class="text-compact font-medium text-text-primary line-clamp-2 min-w-0"
                            >
                              {{ egreso.descripcion }}
                            </span>
                          </span>
                          <span class="min-w-0">
                            <app-badge
                              [variant]="egreso.paymentMethod === 'efectivo' ? 'neutral' : 'info'"
                            >
                              {{ paymentMethodLabel(egreso) }}
                            </app-badge>
                          </span>
                          <span
                            class="text-compact text-right font-bold text-text-primary tabular-nums"
                          >
                            {{ clp(egreso.monto) }}
                          </span>
                          <button
                            class="flex items-center justify-center w-7 h-7 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:bg-error/10 hover:text-error transition-all focus-visible:opacity-100 cursor-pointer"
                            [disabled]="cajaYaCerrada()"
                            aria-label="Eliminar egreso"
                            (click)="onEliminarEgreso(egreso)"
                          >
                            <app-icon name="x" [size]="14" />
                          </button>
                        </div>
                      }
                    </div>
                  }
                }
              </div>

              <!-- Footer simétrico con el de Ingresos: conteo a la izquierda,
                   total (todos los métodos) + subtotal en efectivo en pastilla
                   de 2 líneas a la derecha (tono warning) — fix-230-m. -->
              <div
                class="px-6 py-5 flex items-center justify-between gap-4 border-t border-border-muted/50 bg-surface mt-auto"
              >
                <span class="text-2xs font-bold uppercase tracking-widest text-text-muted">
                  Mostrando {{ gastosHoy().length }} egresos
                </span>
                <div class="min-w-52 bg-warning/5 px-4 py-2 rounded-xl border border-warning/10">
                  <div class="flex items-center justify-between gap-4">
                    <span
                      class="text-2xs font-black uppercase tracking-widest opacity-80 text-warning"
                    >
                      Total Egresos
                    </span>
                    <span class="text-xl font-black tabular-nums tracking-tight text-warning">
                      {{ clp(totalEgresosHoy()) }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-4 mt-0.5">
                    <span class="text-2xs font-semibold uppercase tracking-wide text-text-muted">
                      en efectivo
                    </span>
                    <span class="text-sm font-bold tabular-nums text-text-secondary">
                      {{ clp(totalEgresosEfectivoHoy()) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .badge-mini {
      font-size: 9px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--brand-muted);
      color: var(--color-primary);
      border: 1px solid color-mix(in srgb, var(--color-primary) 10%, transparent);
    }

    .card-mobile-ingreso {
      background: var(--bg-surface);
      border: 1px solid var(--border-muted);
      border-radius: 12px;
      padding: 14px;
      transition: transform 0.2s ease;
    }

    .card-mobile-ingreso:active {
      transform: scale(0.98);
      background: var(--bg-subtle);
    }

    /* ── Ingresos + Egresos: alto de las cards (fix-230-m) ──────────────────
       Dos modos, segun si el shell esta en app-like / fill-screen o no:

       fill-screen ON  (contenedor main >= lg, SIN drawer que lo angoste): la
       celda bento-fill tiene alto definido (_bento-grid.scss lo da solo dentro
       de @container layoutmain min-width 1024px). Ahi las cards reparten ese
       alto por flex-grow (Ingresos 3 : Egresos 2) y scrollean internamente.

       fill-screen OFF (drawer abierto que angosta main a menos de 1024px, o
       pantalla chica): NO hay alto que repartir. Con flex 3 1 0% las cards
       colapsan a su alto minimo y dejan un hueco enorme abajo (el bug
       pre-refactor que reaparecia en la card de Egresos). Por eso el DEFAULT es
       flex none: cada card toma su alto natural y el panel/pagina scrollea. */
    .cuadratura-stack-ingresos,
    .cuadratura-stack-egresos {
      flex: none;
      min-width: 0;
      min-height: 0;
    }

    @container layoutmain (min-width: 1024px) {
      .cuadratura-stack-ingresos {
        flex: 3 1 0%;
      }
      .cuadratura-stack-egresos {
        flex: 2 1 0%;
      }
    }

    /* Dos columnas solo cuando la celda da para la tabla completa de Ingresos
       (~720px, 8 columnas) + el panel de Egresos al lado sin recortar. Por
       debajo se apila (comportamiento probado en 0004-i). Un cuadratura-stack
       de 1200px+ implica siempre layoutmain de 1024px+ (esta anidado en main),
       asi que la fila nunca aparece en modo fill-screen OFF. */
    @container cuadratura-stack (min-width: 1200px) {
      .cuadratura-cols {
        flex-direction: row;
      }
    }

    /* Drawer abierto: nunca dos columnas al lado del panel. */
    :host-context(.force-compact) .cuadratura-cols {
      flex-direction: column;
    }

    .export-menu {
      min-width: 200px;
      background: var(--bg-surface);
      border: 1px solid var(--border-muted);
      border-radius: var(--radius-lg);
      box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
      overflow: hidden;
    }

    .export-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--text-primary);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: background var(--duration-fast);
    }

    .export-menu-item:hover {
      background: var(--bg-elevated);
    }
  `,
})
export class CuadraturaContentComponent implements AfterViewInit {
  // ── Inputs (datos del facade, pasados por el smart component) ─────────────
  readonly pagosHoy = input.required<IngresoRow[]>();
  readonly gastosHoy = input.required<EgresoRow[]>();
  readonly fondoInicial = input<number>(0);
  readonly ingresosEfectivoHoy = input<number>(0);
  readonly totalIngresosHoy = input.required<number>();
  readonly totalEgresosHoy = input.required<number>();
  /** Solo egresos en efectivo — es lo que resta del arqueo físico (fix-211-m). */
  readonly totalEgresosEfectivoHoy = input<number>(0);
  readonly saldoTeorico = input<number>(0);
  readonly cajaYaCerrada = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  readonly isSaving = input<boolean>(false);
  readonly isExporting = input<boolean>(false);

  // ── Estado de Arqueo (spec 0004-i) — vive en CuadraturaFacade desde que el conteo se
  // movió a ArqueoCierreDrawerComponent (componente separado, no hijo de este). El Smart
  // wrapper pasa los computeds del Facade tal cual, para que "Cerrar Caja" en el Hero (que se
  // quedó acá) sepa si está habilitado sin que este Dumb inyecte el Facade directo. ──
  readonly realizarArqueo = input<boolean>(false);
  readonly diferenciaArqueo = input<number>(0);
  readonly notasArqueo = input<string>('');
  readonly puedeCerrarCaja = input<boolean>(false);
  readonly colorDiferencia = input<string>('var(--state-success)');

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  readonly isDrawerOpen = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  /** Emite cuando el usuario confirma "Cerrar Caja" desde el Hero — sin payload, el Facade
   * arma el CierrePayload con su propio estado de arqueo (spec 0004-i). */
  readonly cerrarCaja = output<void>();
  /** Abre el Drawer de Arqueo y Cierre Operativo (spec 0004-i). */
  readonly abrirArqueo = output<void>();
  readonly abrirIngreso = output<void>();
  readonly abrirEgreso = output<void>();
  readonly eliminarIngreso = output<IngresoRow>();
  readonly eliminarEgreso = output<EgresoRow>();
  readonly exportRequested = output<'excel' | 'pdf'>();

  protected readonly fechaHoy = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  });

  protected readonly heroChips = computed<SectionHeroChip[]>(() => {
    if (this.cajaYaCerrada()) {
      return [{ label: 'Caja Cerrada', style: 'error', icon: 'lock' }];
    } else {
      return [{ label: 'Caja Abierta', style: 'success', icon: 'unlock' }];
    }
  });

  /**
   * Franja de KPIs del hero (fix-230-m) — la cuadratura en efectivo de un
   * vistazo: apertura + ingresos efvo. − egresos efvo. = saldo esperado. Los 4
   * KPIs cuadran entre sí; los totales por todos los métodos de pago quedan en
   * el pie de cada panel. Mismo patrón que `servicios-especiales-content`.
   * Lógica pura en `cuadratura-hero-kpis.utils`.
   */
  protected readonly heroKpis = computed(() =>
    buildCuadraturaHeroKpis({
      fondoInicial: this.fondoInicial(),
      ingresosEfectivo: this.ingresosEfectivoHoy(),
      egresosEfectivo: this.totalEgresosEfectivoHoy(),
      saldoTeorico: this.saldoTeorico(),
    }),
  );

  protected readonly exportMenuOpen = signal(false);

  /** Etiqueta/ícono de "Cerrar Caja" — movido del card de Arqueo al Hero (spec 0004-i). */
  protected readonly cerrarCajaLabel = computed(() => {
    if (this.isSaving()) return 'Procesando...';
    if (this.cajaYaCerrada()) return 'Caja Cerrada';
    if (
      this.realizarArqueo() &&
      this.diferenciaArqueo() !== 0 &&
      this.notasArqueo().trim().length === 0
    ) {
      return 'Justifica la diferencia';
    }
    return 'Cerrar Caja';
  });

  protected readonly heroActions = computed<SectionHeroAction[]>(() => [
    {
      id: 'ver-historial',
      label: 'Ver Historial',
      icon: 'history',
      route: '../historial-cuadraturas',
      primary: false,
    },
    {
      id: 'exportar',
      label: this.isExporting() ? 'Exportando...' : 'Exportar',
      icon: this.isExporting() ? 'loader-circle' : 'download',
      loading: this.isExporting(),
      disabled: this.isExporting(),
      primary: false,
    },
    {
      id: 'ver-arqueo',
      label: 'Arqueo y Cierre',
      icon: 'wallet',
      primary: false,
    },
    {
      id: 'cerrar-caja',
      label: this.cerrarCajaLabel(),
      icon: this.isSaving() ? 'loader-circle' : 'lock',
      loading: this.isSaving(),
      disabled: !this.puedeCerrarCaja() || this.isSaving(),
      primary: true,
    },
  ]);

  // ── Helpers de template ───────────────────────────────────────────────────
  protected readonly clp = formatCLP;

  private static readonly CATEGORY_LABELS: Record<string, string> = {
    combustible: 'Combustible',
    gasto: 'Gasto',
  };

  private static readonly CATEGORY_ICONS: Record<string, string> = {
    combustible: 'fuel',
    gasto: 'receipt',
  };

  /** Etiqueta legible de la categoría del egreso (fix-006-i) — null si no aplica (ej. anticipos). */
  protected categoryLabel(egreso: EgresoRow): string | null {
    if (!egreso.category) return null;
    return CuadraturaContentComponent.CATEGORY_LABELS[egreso.category] ?? egreso.category;
  }

  /** Ícono de categoría del egreso (hotfix-001-i) — null si no aplica (ej. anticipos). */
  protected categoryIcon(egreso: EgresoRow): string | null {
    if (!egreso.category) return null;
    return CuadraturaContentComponent.CATEGORY_ICONS[egreso.category] ?? 'tag';
  }

  private static readonly PAYMENT_METHOD_LABELS: Record<string, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
  };

  /**
   * Etiqueta del método de pago del egreso. Desde fix-230-m también se usa para
   * `efectivo` (columna "Método" de la lista de Egresos), no solo para los
   * métodos que no tocan la caja física (fix-211-m).
   */
  protected paymentMethodLabel(egreso: EgresoRow): string {
    return (
      CuadraturaContentComponent.PAYMENT_METHOD_LABELS[egreso.paymentMethod] ?? egreso.paymentMethod
    );
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'exportar' && !this.isExporting()) {
      this.exportMenuOpen.set(!this.exportMenuOpen());
      return;
    }
    if (actionId === 'ver-arqueo') {
      this.abrirArqueo.emit();
      return;
    }
    if (actionId === 'cerrar-caja' && this.puedeCerrarCaja() && !this.isSaving()) {
      this.cerrarCaja.emit();
    }
  }

  protected requestExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    this.exportRequested.emit(format);
  }

  protected onEliminarIngreso(fila: IngresoRow, event: Event): void {
    event.stopPropagation();
    this.eliminarIngreso.emit(fila);
  }

  protected onEliminarEgreso(egreso: EgresoRow): void {
    this.eliminarEgreso.emit(egreso);
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
