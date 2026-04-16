import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { AlumnoDeudor } from '@core/models/ui/pagos.model';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { RegistrarPagoDrawerComponent } from './registrar-pago-drawer.component';
import { AdminPagoDetalleDrawerComponent } from './admin-pago-detalle-drawer.component';
import { RentabilidadCursosComponent } from './rentabilidad-cursos.component';
import { formatCLP, formatChileanDate } from '@core/utils/date.utils';

function toCompact(amount: number): { value: number; suffix: string } {
  if (amount >= 1_000_000) {
    return { value: parseFloat((amount / 1_000_000).toFixed(1)), suffix: 'M' };
  }
  if (amount >= 10_000) {
    return { value: parseFloat((amount / 1_000).toFixed(1)), suffix: 'K' };
  }
  return { value: amount, suffix: '' };
}

const POR_PAGINA = 5;

@Component({
  selector: 'app-admin-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    IconComponent,
    RentabilidadCursosComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Cabecera ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        #heroRef
        title="Gestión de Pagos"
        subtitle="Registro y seguimiento financiero"
        icon="wallet"
        [actions]="heroActions"
        [chips]="heroChips()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── KPIs ───────────────────────────────────────────────────────────────── -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Ingresos Hoy"
          [value]="ingresosHoyDisplay().value"
          [loading]="facade.isLoading()"
          icon="dollar-sign"
          prefix="$"
          [suffix]="ingresosHoyDisplay().suffix"
          [subValue]="clp(facade.ingresosHoy())"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Ingresos Mes"
          [value]="ingresosMesDisplay().value"
          [loading]="facade.isLoading()"
          icon="trending-up"
          prefix="$"
          [suffix]="ingresosMesDisplay().suffix"
          [subValue]="clp(facade.ingresosMes())"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Pagos Pendientes"
          [value]="pagosPendientesDisplay().value"
          [loading]="facade.isLoading()"
          icon="alert-circle"
          prefix="$"
          [suffix]="pagosPendientesDisplay().suffix"
          [subValue]="facade.totalDeudores() + ' alumnos'"
          color="warning"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Boletas Emitidas"
          [value]="facade.boletasMes()"
          [loading]="facade.isLoading()"
          icon="receipt"
          subValue="Este mes"
        />
      </div>

      <!-- ── Contenido principal ─────────────────────────────────────────────── -->
      <div class="bento-banner">
        <div class="flex flex-col gap-6">
          <!-- ── Alumnos con saldo pendiente ────────────────────────────────────── -->
          <div class="card p-0 overflow-hidden">
            <div
              class="flex items-center justify-between px-6 py-4 border-b"
              style="border-color: var(--border-muted)"
            >
              <div>
                <h2 class="text-base font-semibold" style="color: var(--text-primary)">
                  Alumnos con saldo pendiente
                </h2>
                <p class="text-xs mt-0.5" style="color: var(--color-primary)">
                  Alumnos con saldo por pagar. Registrar abonos para actualizar el saldo y habilitar
                  clase 7 cuando corresponda.
                </p>
              </div>
              <button
                class="text-sm font-medium flex items-center gap-1"
                style="color: var(--text-secondary)"
                data-llm-action="view-full-account-status"
              >
                Ver estado de cuenta completo
                <app-icon name="arrow-right" [size]="14" />
              </button>
            </div>

            @if (facade.isLoading()) {
              <div class="divide-y" style="border-color: var(--border-muted)">
                @for (row of [1, 2, 3, 4]; track row) {
                  <div
                    class="p-4 lg:px-6 lg:py-4 flex flex-col gap-3 lg:grid lg:grid-cols-6 lg:gap-4 lg:items-center"
                  >
                    <div class="lg:col-span-2 flex flex-col gap-1">
                      <app-skeleton-block variant="text" width="80%" height="14px" />
                      <app-skeleton-block
                        variant="text"
                        width="50%"
                        height="10px"
                        class="lg:hidden"
                      />
                    </div>
                    <app-skeleton-block
                      variant="text"
                      width="60%"
                      height="14px"
                      class="hidden lg:block"
                    />
                    <div class="grid grid-cols-3 gap-2 lg:contents mt-2 lg:mt-0">
                      <app-skeleton-block variant="text" width="60%" height="14px" />
                      <app-skeleton-block variant="text" width="60%" height="14px" />
                      <app-skeleton-block variant="text" width="60%" height="14px" />
                    </div>
                    <div class="flex gap-2 justify-end mt-2 lg:mt-0">
                      <app-skeleton-block variant="rect" width="80px" height="28px" />
                      <app-skeleton-block variant="rect" width="100px" height="28px" />
                    </div>
                  </div>
                }
              </div>
            } @else if (facade.alumnosConDeuda().length === 0) {
              <div class="px-6 py-10 flex flex-col items-center gap-2 text-center">
                <app-icon name="check-circle" [size]="32" color="var(--state-success)" />
                <p class="text-sm font-medium" style="color: var(--text-primary)">
                  ¡Sin saldos pendientes!
                </p>
                <p class="text-xs" style="color: var(--text-muted)">
                  Todos los alumnos están al día con sus pagos.
                </p>
              </div>
            } @else {
              <div [class.force-compact]="layoutDrawer.isOpen()">
                <div
                  class="hidden lg:grid px-6 py-2 grid-cols-6 gap-4 text-xs font-semibold tracking-wide uppercase border-b"
                  style="color: var(--text-muted); background: var(--bg-surface); border-color: var(--border-muted)"
                >
                  <span>Alumno</span>
                  <span>RUT</span>
                  <span class="text-right">Total a Pagar</span>
                  <span class="text-right">Pagado</span>
                  <span class="text-right">Saldo</span>
                  <span class="text-right">Acciones</span>
                </div>
                <div class="divide-y" style="border-color: var(--border-muted)">
                  @for (alumno of facade.alumnosConDeuda(); track alumno.enrollmentId) {
                    <div
                      class="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-6 lg:gap-4 lg:items-center hover:bg-[color-mix(in_srgb,var(--bg-surface)_60%,transparent)] transition-colors"
                    >
                      <!-- Identidad Mobile (Alumno + RUT) / Alumno Desktop -->
                      <div class="flex flex-col min-w-0">
                        <span
                          class="text-sm font-semibold truncate"
                          style="color: var(--text-primary)"
                        >
                          {{ alumno.alumno }}
                        </span>
                        <!-- RUT Mobile only -->
                        <span class="text-xs lg:hidden mt-0.5" style="color: var(--color-primary)">
                          RUT: {{ alumno.rut }}
                        </span>
                      </div>

                      <!-- RUT Desktop only -->
                      <span class="hidden lg:block text-sm" style="color: var(--color-primary)">
                        {{ alumno.rut }}
                      </span>

                      <!-- Finanzas -->
                      <div
                        class="grid grid-cols-3 gap-2 lg:contents mt-3 lg:mt-0 p-3 lg:p-0 rounded-lg lg:rounded-none"
                        style="background: color-mix(in srgb, var(--bg-surface) 60%, transparent)"
                      >
                        <div class="flex flex-col lg:block text-center lg:text-right">
                          <span
                            class="text-[10px] uppercase font-bold lg:hidden mb-1"
                            style="color: var(--text-muted)"
                            >Total</span
                          >
                          <span class="text-sm" style="color: var(--text-primary)">{{
                            clp(alumno.totalAPagar)
                          }}</span>
                        </div>
                        <div class="flex flex-col lg:block text-center lg:text-right">
                          <span
                            class="text-[10px] uppercase font-bold lg:hidden mb-1"
                            style="color: var(--text-muted)"
                            >Pagado</span
                          >
                          <span class="text-sm font-medium" style="color: var(--state-success)">{{
                            clp(alumno.pagado)
                          }}</span>
                        </div>
                        <div class="flex flex-col lg:block text-center lg:text-right">
                          <span
                            class="text-[10px] uppercase font-bold lg:hidden mb-1"
                            style="color: var(--text-muted)"
                            >Saldo</span
                          >
                          <span class="text-sm font-bold" style="color: var(--state-warning)">{{
                            clp(alumno.saldo)
                          }}</span>
                        </div>
                      </div>

                      <!-- Acciones -->
                      <div class="flex items-center gap-2 mt-4 lg:mt-0 lg:justify-end">
                        <button
                          class="text-xs font-medium flex-1 lg:flex-none justify-center py-2 lg:py-0 border lg:border-none rounded-lg lg:rounded-none"
                          style="color: var(--text-secondary); border-color: var(--border-muted)"
                          (click)="openDetalle(alumno.enrollmentId)"
                        >
                          Ver detalle
                        </button>
                        <button
                          class="btn-primary text-xs flex-1 lg:flex-none justify-center px-3 py-2 lg:py-1.5"
                          (click)="openDrawer(alumno.enrollmentId)"
                        >
                          Registrar pago
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- ── Layout: Pagos Recientes | Sidebar ────────────────── -->
          <div
            class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:col-span-12 items-start"
            [class.force-compact]="layoutDrawer.isOpen()"
          >
            <!-- ─ Pagos Recientes (lg:col-span-8) ─────────────────────────────────────────── -->
            <div class="lg:col-span-8 card p-0 overflow-hidden">
              <div
                class="p-4 lg:px-6 lg:py-4 flex flex-col gap-4 border-b"
                style="border-color: var(--border-muted); background: var(--bg-surface)"
              >
                <h2 class="text-base font-semibold" style="color: var(--text-primary)">
                  Pagos Recientes
                </h2>

                <!-- ── Barra de búsqueda + filtros (Integrada como Toolbar) ── -->
                <div class="flex flex-col xl:flex-row gap-3 w-full">
                  <!-- Input de búsqueda -->
                  <div class="relative flex-1">
                    <div
                      class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                    >
                      <app-icon name="search" [size]="16" color="var(--text-muted)" />
                    </div>
                    <input
                      type="search"
                      placeholder="Buscar por alumno o N° boleta..."
                      class="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg transition-colors focus:outline-none bg-base hover:border-text-muted focus:border-brand"
                      style="border: 1px solid var(--border-muted); color: var(--text-primary);"
                      (input)="onSearch($event)"
                    />
                  </div>

                  <div class="flex flex-col sm:flex-row gap-3">
                    <!-- Select Estado -->
                    <div class="relative">
                      <select
                        class="w-full sm:w-auto text-sm pl-4 pr-10 py-2.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-brand transition-colors bg-base hover:border-text-muted"
                        style="border: 1px solid var(--border-muted); color: var(--text-primary);"
                        [value]="filtroEstado()"
                        (change)="onFiltroEstado($event)"
                      >
                        <option value="todos">Todos los estados</option>
                        <option value="completado">Completado</option>
                        <option value="pendiente">Pendiente</option>
                      </select>
                      <div
                        class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
                      >
                        <app-icon name="chevron-down" [size]="16" color="var(--text-muted)" />
                      </div>
                    </div>

                    <!-- Select Método -->
                    <div class="relative">
                      <select
                        class="w-full sm:w-auto text-sm pl-4 pr-10 py-2.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-brand transition-colors bg-base hover:border-text-muted"
                        style="border: 1px solid var(--border-muted); color: var(--text-primary);"
                        [value]="filtroMetodo()"
                        (change)="onFiltroMetodo($event)"
                      >
                        <option value="todos">Todos los métodos</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Débito/Crédito">Débito/Crédito</option>
                        <option value="WebPay">WebPay</option>
                        <option value="Mixto">Mixto</option>
                      </select>
                      <div
                        class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
                      >
                        <app-icon name="chevron-down" [size]="16" color="var(--text-muted)" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              @if (facade.isLoading()) {
                <div class="divide-y" style="border-color: var(--border-muted)">
                  @for (row of [1, 2, 3, 4, 5]; track row) {
                    <div
                      class="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-7 gap-3 lg:items-center"
                    >
                      <div class="flex justify-between items-center lg:contents">
                        <app-skeleton-block variant="text" width="60%" height="14px" />
                        <app-skeleton-block
                          variant="rect"
                          width="60px"
                          height="20px"
                          class="lg:hidden"
                        />
                      </div>
                      <div class="flex flex-col lg:contents gap-1 lg:gap-0">
                        <app-skeleton-block variant="text" width="90%" height="14px" />
                        <app-skeleton-block variant="text" width="70%" height="12px" />
                      </div>
                      <div
                        class="grid grid-cols-2 lg:contents mt-2 lg:mt-0 pt-2 lg:pt-0 border-t lg:border-none"
                        style="border-color: var(--border-muted)"
                      >
                        <app-skeleton-block variant="text" width="70%" height="12px" />
                        <app-skeleton-block variant="text" width="80%" height="12px" />
                        <app-skeleton-block
                          variant="text"
                          width="80%"
                          height="12px"
                          class="col-span-2 lg:col-span-1 mt-1 lg:mt-0 lg:justify-self-center"
                        />
                      </div>
                      <app-skeleton-block
                        variant="rect"
                        width="80px"
                        height="22px"
                        class="hidden lg:block justify-self-center"
                      />
                    </div>
                  }
                </div>
              } @else if (pagosVisibles().length === 0) {
                <div class="px-6 py-10 flex flex-col items-center gap-2 text-center">
                  <app-icon name="search" [size]="28" color="var(--text-muted)" />
                  <p class="text-sm" style="color: var(--text-muted)">
                    No se encontraron pagos con los filtros seleccionados.
                  </p>
                </div>
              } @else {
                <div
                  class="hidden lg:grid px-6 py-2 grid-cols-7 gap-3 text-xs font-semibold tracking-wide uppercase border-b"
                  style="color: var(--text-muted); background: var(--bg-surface); border-color: var(--border-muted)"
                >
                  <span>Fecha</span>
                  <span>Alumno</span>
                  <span>Concepto</span>
                  <span class="text-right">Monto</span>
                  <span>Método</span>
                  <span>N° Documento</span>
                  <span class="text-center">Estado</span>
                </div>

                <div class="divide-y" style="border-color: var(--border-muted)">
                  @for (pago of pagosVisibles(); track pago.id) {
                    <div
                      class="p-4 lg:px-6 lg:py-3.5 flex flex-col lg:grid lg:grid-cols-7 gap-3 lg:items-center hover:bg-[color-mix(in_srgb,var(--bg-surface)_60%,transparent)] transition-colors"
                    >
                      <div class="flex items-center justify-between lg:contents">
                        <span class="text-xs font-medium" style="color: var(--color-primary)">
                          {{ fechaCorta(pago.fecha) }}
                        </span>
                        <span
                          class="lg:hidden inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          [style.background]="estadoBg(pago.estado)"
                          [style.color]="estadoColor(pago.estado)"
                        >
                          @if (pago.estado === 'completado') {
                            <app-icon name="check" [size]="10" />
                          }
                          {{ estadoLabel(pago.estado) }}
                        </span>
                      </div>
                      <div class="flex flex-col lg:contents min-w-0">
                        <span
                          class="text-sm font-semibold truncate"
                          style="color: var(--text-primary)"
                        >
                          {{ pago.alumno }}
                        </span>
                        <span
                          class="text-xs truncate lg:text-secondary mt-0.5 lg:mt-0"
                          style="color: var(--text-muted)"
                        >
                          {{ pago.concepto ?? '—' }}
                        </span>
                      </div>
                      <div
                        class="flex flex-col lg:contents mt-2 lg:mt-0 pt-2 lg:pt-0 border-t lg:border-none"
                        style="border-color: var(--border-muted)"
                      >
                        <div class="flex justify-between items-center lg:contents">
                          <span
                            class="text-xs uppercase font-bold lg:hidden"
                            style="color: var(--text-muted)"
                            >Monto</span
                          >
                          <span
                            class="text-sm font-bold lg:text-right"
                            style="color: var(--text-primary)"
                          >
                            {{ clp(pago.monto) }}
                          </span>
                        </div>
                        <div class="flex items-center justify-between lg:contents mt-2 lg:mt-0">
                          <span
                            class="flex items-center gap-1.5 text-xs"
                            style="color: var(--text-secondary)"
                          >
                            <app-icon [name]="pago.metodoIcono" [size]="13" />
                            {{ pago.metodo }}
                          </span>
                          <span
                            class="text-[10px] lg:text-xs font-mono px-1.5 py-0.5 rounded"
                            style="color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-muted);"
                          >
                            {{ pago.nroDocumento ?? '—' }}
                          </span>
                        </div>
                      </div>
                      <div class="hidden lg:flex justify-center">
                        <span
                          class="inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          [style.background]="estadoBg(pago.estado)"
                          [style.color]="estadoColor(pago.estado)"
                        >
                          @if (pago.estado === 'completado') {
                            <app-icon name="check" [size]="10" />
                          }
                          {{ estadoLabel(pago.estado) }}
                        </span>
                      </div>
                    </div>
                  }
                </div>

                <div
                  class="px-6 py-3 flex items-center justify-between border-t"
                  style="border-color: var(--border-muted)"
                >
                  <span class="text-xs" style="color: var(--color-primary)">
                    {{ rangoMostrando() }}
                  </span>
                  <div class="flex gap-2">
                    <button
                      class="text-sm px-4 py-1.5 rounded-lg border font-medium"
                      style="border-color: var(--border-muted); color: var(--text-primary); background: var(--bg-surface);"
                      [disabled]="paginaActual() <= 1"
                      [style.opacity]="paginaActual() <= 1 ? '0.4' : '1'"
                      (click)="paginaAnterior()"
                    >
                      Anterior
                    </button>
                    <button
                      class="text-sm px-4 py-1.5 rounded-lg border font-medium"
                      style="border-color: var(--border-muted); color: var(--text-primary); background: var(--bg-surface);"
                      [disabled]="paginaActual() >= totalPaginas()"
                      [style.opacity]="paginaActual() >= totalPaginas() ? '0.4' : '1'"
                      (click)="paginaSiguiente()"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              }
            </div>

            <div class="lg:col-span-4 flex flex-col gap-4">
              <div class="card p-5 flex flex-col gap-4">
                <h3 class="text-sm font-semibold" style="color: var(--text-primary)">
                  Métodos de Pago ({{ mesActual() }})
                </h3>

                @if (facade.isLoading()) {
                  @for (i of [1, 2, 3]; track i) {
                    <div class="flex flex-col gap-1.5">
                      <app-skeleton-block variant="text" width="60%" height="12px" />
                      <app-skeleton-block variant="rect" width="100%" height="6px" />
                    </div>
                  }
                } @else {
                  @for (metodo of facade.metodosPagoMes(); track metodo.metodo) {
                    <div class="flex flex-col gap-1.5">
                      <div class="flex items-center justify-between">
                        <span
                          class="flex items-center gap-1.5 text-xs font-medium"
                          [style.color]="metodo.color"
                        >
                          <app-icon [name]="metodo.icono" [size]="12" />
                          {{ metodo.metodo }}
                        </span>
                        <span class="text-xs font-semibold" style="color: var(--text-primary)"
                          >{{ metodo.porcentaje }}%</span
                        >
                      </div>
                      <div
                        class="h-1.5 rounded-full overflow-hidden"
                        style="background: var(--border-muted)"
                      >
                        <div
                          class="h-full rounded-full"
                          [style.width.%]="metodo.porcentaje"
                          [style.background]="metodo.color"
                        ></div>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </div>

          <div class="card p-6" [class.force-compact]="layoutDrawer.isOpen()">
            <app-rentabilidad-cursos />
          </div>

          @if (facade.error()) {
            <div
              class="card p-4 flex items-center gap-3"
              style="border-color: var(--state-error); background: color-mix(in srgb, var(--state-error) 8%, transparent)"
            >
              <app-icon name="alert-circle" [size]="18" color="var(--state-error)" />
              <p class="text-sm" style="color: var(--state-error)">{{ facade.error() }}</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .force-compact .hidden.lg\\:grid {
        display: none !important;
      }
      .force-compact .lg\\:hidden {
        display: block !important;
      }
      .force-compact .lg\\:grid-cols-6,
      .force-compact .lg\\:grid-cols-7,
      .force-compact .lg\\:grid-cols-12 {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 1rem !important;
      }
      .force-compact .lg\\:contents {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        border-top: 1px solid var(--border-muted) !important;
        padding-top: 0.5rem !important;
        width: 100% !important;
      }
      .force-compact .lg\\:text-right,
      .force-compact .lg\\:text-center {
        text-align: left !important;
      }
      .force-compact app-rentabilidad-cursos .flex.flex-col.lg\\:grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 0.75rem !important;
      }
    `,
  ],
})
export class AdminPagosComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(PagosFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild('heroRef', { read: ElementRef });
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly heroActions: SectionHeroAction[] = [
    {
      id: 'generate-report',
      label: 'Generar Reporte',
      icon: 'file-text',
      primary: false,
    },
    {
      id: 'view-pending',
      label: 'Ver Pendientes',
      icon: 'clock',
      primary: false,
    },
    {
      id: 'register-payment',
      label: 'Registrar Pago',
      icon: 'plus',
      primary: true,
    },
  ];

  readonly heroChips = computed(() => {
    return [
      { label: `${this.facade.boletasMes()} boletas emitidas`, style: 'default' as const },
      { label: `${this.facade.totalDeudores()} con deuda`, style: 'default' as const },
    ];
  });

  // Funciones puras expuestas al template
  protected readonly clp = formatCLP;

  // ── Computed: display values KPI (K / M) ─────────────────────────────────────
  protected readonly ingresosHoyDisplay = computed(() => toCompact(this.facade.ingresosHoy()));
  protected readonly ingresosMesDisplay = computed(() => toCompact(this.facade.ingresosMes()));
  protected readonly pagosPendientesDisplay = computed(() =>
    toCompact(this.facade.pagosPendientesTotales()),
  );

  // ── Estado local: búsqueda / filtros / paginación ────────────────────────────
  protected readonly searchQuery = signal('');
  protected readonly filtroEstado = signal('todos');
  protected readonly filtroMetodo = signal('todos');
  protected readonly paginaActual = signal(1);

  // ── Computed: tabla filtrada y paginada ──────────────────────────────────────
  protected readonly pagosFiltrados = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const estado = this.filtroEstado();
    const metodo = this.filtroMetodo();

    return this.facade.pagosRecientes().filter((p) => {
      const matchSearch =
        !q ||
        p.alumno.toLowerCase().includes(q) ||
        (p.nroDocumento ?? '').toLowerCase().includes(q);
      const matchEstado = estado === 'todos' || p.estado === estado;
      const matchMetodo = metodo === 'todos' || p.metodo === metodo;
      return matchSearch && matchEstado && matchMetodo;
    });
  });

  protected readonly totalFiltrados = computed(() => this.pagosFiltrados().length);

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalFiltrados() / POR_PAGINA)),
  );

  protected readonly pagosVisibles = computed(() => {
    const start = (this.paginaActual() - 1) * POR_PAGINA;
    return this.pagosFiltrados().slice(start, start + POR_PAGINA);
  });

  protected readonly rangoMostrando = computed(() => {
    const total = this.totalFiltrados();
    if (total === 0) return 'Sin resultados';
    const start = (this.paginaActual() - 1) * POR_PAGINA + 1;
    const end = Math.min(this.paginaActual() * POR_PAGINA, total);
    return `Mostrando ${start}-${end} de ${total} pagos`;
  });

  protected readonly mesActual = computed(() => {
    const now = new Date();
    const mes = now.toLocaleDateString('es-Cl', { month: 'long' });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.facade.initialize();
  }

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();

    if (hero) this.gsap.animateHero(hero.nativeElement);
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'register-payment') {
      this.openDrawer(null);
    } else if (actionId === 'view-pending') {
      this.filtroEstado.set('pendiente');
      this.paginaActual.set(1);

      // Asegurar que scroll al listado
      const hero = this.heroRef();
      if (hero) hero.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } else if (actionId === 'generate-report') {
      console.info('Generar reporte - a implementar');
    }
  }

  // ── Handlers de búsqueda / filtros ───────────────────────────────────────────

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.paginaActual.set(1);
  }

  protected onFiltroEstado(event: Event): void {
    this.filtroEstado.set((event.target as HTMLSelectElement).value);
    this.paginaActual.set(1);
  }

  protected onFiltroMetodo(event: Event): void {
    this.filtroMetodo.set((event.target as HTMLSelectElement).value);
    this.paginaActual.set(1);
  }

  // ── Paginación ───────────────────────────────────────────────────────────────

  protected paginaAnterior(): void {
    if (this.paginaActual() > 1) this.paginaActual.update((p) => p - 1);
  }

  protected paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) this.paginaActual.update((p) => p + 1);
  }

  // ── Helpers de display ───────────────────────────────────────────────────────

  protected fechaCorta(fecha: string | null): string {
    if (!fecha) return '—';
    return formatChileanDate(fecha, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected estadoBg(estado: string | null): string {
    switch (estado) {
      case 'completado':
        return 'color-mix(in srgb, var(--state-success) 15%, transparent)';
      case 'pendiente':
        return 'color-mix(in srgb, var(--state-warning) 15%, transparent)';
      default:
        return 'color-mix(in srgb, var(--text-muted) 10%, transparent)';
    }
  }

  protected estadoColor(estado: string | null): string {
    switch (estado) {
      case 'completado':
        return 'var(--state-success)';
      case 'pendiente':
        return 'var(--state-warning)';
      default:
        return 'var(--text-muted)';
    }
  }

  protected estadoLabel(estado: string | null): string {
    switch (estado) {
      case 'completado':
        return 'Completado';
      case 'pendiente':
        return 'Pendiente';
      default:
        return estado ?? '—';
    }
  }

  // ── Drawer: abrir / guardar ───────────────────────────────────────────────────

  protected openDetalle(enrollmentId: number): void {
    this.facade.seleccionarEnrollment(enrollmentId);
    this.layoutDrawer.open(AdminPagoDetalleDrawerComponent, 'Estado de Cuenta', 'file-text');
  }

  protected openDrawer(enrollmentId: number | null): void {
    void this.facade.seleccionarParaPago(enrollmentId);
    this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card');
  }
}
