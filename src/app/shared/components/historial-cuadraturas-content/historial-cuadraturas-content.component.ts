import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  AfterViewInit,
  ElementRef,
  viewChild,
  inject,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface CalendarDay {
  day: number | null;
  dateStr: string | null;
  cierre: HistorialCierre | null;
  isToday: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// ─── Helper formato CLP ───────────────────────────────────────────────────────

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-historial-cuadraturas-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, SectionHeroComponent, BentoGridLayoutDirective],
  styles: `
    .cal-cell {
      min-height: 120px;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: var(--bg-surface);
    }
    .cal-cell--empty {
      background: var(--bg-elevated);
    }
    .cal-cell--clickable {
      cursor: pointer;
      transition: background 150ms ease;
    }
    .cal-cell--clickable:hover {
      background: color-mix(in srgb, var(--ds-brand) 4%, var(--bg-surface));
    }
    .badge-cuadrado {
      display: block;
      width: 100%;
      text-align: center;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-success) 15%, transparent);
      color: var(--color-success);
    }
    .badge-descuadre {
      display: block;
      width: 100%;
      text-align: center;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-error) 12%, transparent);
      color: var(--color-error);
    }
    .day-circle {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--ds-brand);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.68rem;
      font-weight: 800;
      flex-shrink: 0;
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
  template: `
    <div class="bento-grid" appBentoGridLayout #pageRef>
      <!-- ── Hero (slim, hijo directo del grid) ──────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Historial de Cuadraturas"
        subtitle="Registro y visualización del calendario financiero mensual para arqueo de caja."
        icon="calendar"
        [backRoute]="backRoute()"
        [backLabel]="backLabel()"
        [actions]="[]"
      />

      <!-- ── Barra: navegación de mes + exportación ─────────────────────────── -->
      <div
        class="bento-banner card px-4 py-2.5 flex items-center justify-between relative overflow-visible"
      >
        <div class="flex items-center border border-border-subtle rounded-xl overflow-hidden">
          <button
            class="px-3 py-2 text-text-secondary transition-colors cursor-pointer hover:bg-subtle border-0 bg-transparent"
            (click)="mesAnterior.emit()"
            aria-label="Mes anterior"
            data-llm-action="historial-mes-anterior"
          >
            <app-icon name="chevron-left" [size]="16" />
          </button>
          <span
            class="text-sm font-bold px-4 text-text-primary uppercase tracking-wide"
            style="min-width: 140px; text-align: center"
          >
            {{ mesLabel() }}
          </span>
          <button
            class="px-3 py-2 text-text-secondary transition-colors cursor-pointer hover:bg-subtle border-0 bg-transparent"
            (click)="mesSiguiente.emit()"
            aria-label="Mes siguiente"
            data-llm-action="historial-mes-siguiente"
          >
            <app-icon name="chevron-right" [size]="16" />
          </button>
        </div>
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary border border-border-subtle rounded-lg hover:bg-subtle transition-colors cursor-pointer bg-transparent"
          [disabled]="isExporting()"
          (click)="exportMenuOpen.set(!exportMenuOpen())"
          data-llm-action="toggle-export-menu"
        >
          <app-icon [name]="isExporting() ? 'loader-circle' : 'download'" [size]="15" />
          {{ isExporting() ? 'Exportando...' : 'Exportar' }}
        </button>
        @if (exportMenuOpen()) {
          <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
          <div class="export-menu absolute top-12 right-0 z-20">
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('excel')"
              data-llm-action="export-historial-excel"
            >
              <app-icon name="table-2" [size]="16" />
              Exportar como Excel
            </button>
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('pdf')"
              data-llm-action="export-historial-pdf"
            >
              <app-icon name="file-text" [size]="16" />
              Exportar como PDF
            </button>
          </div>
        }
      </div>

      <!-- ── Calendario ─────────────────────────────────────────────────────────── -->
      <div
        class="bento-banner overflow-hidden"
        style="border: 1px solid var(--border-color); border-radius: var(--radius-lg, 10px)"
      >
        <!-- Cabecera de días (LUN–DOM) | DESKTOP SOLO -->
        <div
          class="hidden lg:grid grid-cols-7 gap-[1px] bg-border-muted/50 border-b border-border-muted/50"
        >
          @for (dia of diasSemana; track dia) {
            <div
              class="px-2 py-3.5 text-center text-[10px] font-bold text-text-muted bg-subtle uppercase tracking-widest"
            >
              {{ dia }}
            </div>
          }
        </div>

        <!-- Grid de celdas | DESKTOP SOLO -->
        <div class="hidden lg:grid grid-cols-7 gap-[1px] bg-border-muted/30 flex-1">
          @if (isLoading()) {
            @for (i of skeletonCells; track i) {
              <div class="cal-cell bg-elevated p-2 flex flex-col justify-between">
                <app-skeleton-block variant="text" width="40%" height="13px" />
              </div>
            }
          } @else {
            @for (celda of calendarDays(); track $index) {
              <div
                class="cal-cell"
                [class.cal-cell--empty]="!celda.day"
                [class.cal-cell--clickable]="!!celda.cierre"
                [attr.role]="celda.cierre ? 'button' : null"
                [attr.aria-label]="
                  celda.cierre ? 'Ver detalle del cierre del día ' + celda.day : null
                "
                [attr.tabindex]="celda.cierre ? 0 : null"
                (click)="celda.cierre && cierreClicked.emit(celda.cierre)"
                (keydown.enter)="celda.cierre && cierreClicked.emit(celda.cierre)"
              >
                @if (celda.day) {
                  <!-- Fila superior: número + candado -->
                  <div class="flex items-start justify-between">
                    @if (celda.isToday) {
                      <span class="day-circle" aria-label="Hoy">{{ celda.day }}</span>
                    } @else {
                      <span class="text-sm font-medium text-text-secondary">
                        {{ celda.day }}
                      </span>
                    }
                    @if (celda.cierre) {
                      <app-icon name="lock" [size]="11" color="var(--text-muted)" />
                    }
                  </div>

                  <!-- Centro: badge + diferencia -->
                  @if (celda.cierre; as cierre) {
                    <div class="flex flex-col gap-1 my-1">
                      @if (cierre.estadoDiferencia === 'balanced') {
                        <span class="badge-cuadrado">Cuadrado</span>
                      } @else {
                        <span class="badge-descuadre">Descuadre</span>
                      }
                      <p
                        class="text-xs font-semibold text-center"
                        [style.color]="
                          cierre.estadoDiferencia === 'shortage'
                            ? 'var(--color-error)'
                            : cierre.estadoDiferencia === 'surplus'
                              ? 'var(--color-warning)'
                              : 'var(--color-success)'
                        "
                      >
                        {{ formatDiferencia(cierre.diferencia) }}
                      </p>
                    </div>

                    <!-- Fila inferior: cajero -->
                    <div class="flex items-center gap-1">
                      <app-icon name="user" [size]="10" color="var(--text-muted)" />
                      <span
                        class="text-xs truncate text-text-muted"
                        [style.max-width]="'calc(100% - 16px)'"
                        >{{ cierre.cajero }}</span
                      >
                    </div>
                  } @else if (celda.isToday) {
                    <p class="text-xs font-semibold text-center my-auto text-brand">En curso</p>
                    <span></span>
                  } @else {
                    <span></span><span></span>
                  }
                }
              </div>
            }
          }
        </div>

        <!-- ── VISTA MÓVIL (Feed/List View) ── -->
        <div class="flex lg:hidden flex-col divide-y divide-border-muted/30">
          @if (isLoading()) {
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="p-4 flex items-center justify-between bg-surface">
                <div class="flex gap-3 items-center w-full">
                  <app-skeleton-block variant="circle" width="44px" height="44px" />
                  <div class="flex flex-col gap-2 flex-1">
                    <app-skeleton-block variant="text" width="60%" height="14px" />
                    <app-skeleton-block variant="text" width="40%" height="10px" />
                  </div>
                </div>
              </div>
            }
          } @else {
            @for (celda of calendarDays(); track $index) {
              @if (celda.day && (celda.cierre || celda.isToday)) {
                <button
                  class="flex items-center justify-between p-4 bg-surface hover:bg-subtle active:bg-border-muted/30 transition-colors w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand cursor-pointer"
                  (click)="celda.cierre && cierreClicked.emit(celda.cierre)"
                  [attr.aria-disabled]="!celda.cierre"
                >
                  <div class="flex items-center gap-4">
                    <div
                      class="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                      [class.bg-brand]="celda.isToday"
                      [class.text-white]="celda.isToday"
                      [class.bg-subtle]="!celda.isToday"
                      [class.border]="!celda.isToday"
                      [class.border-border-muted]="!celda.isToday"
                    >
                      <span
                        class="text-[10px] font-bold uppercase tracking-widest"
                        [class.text-white]="celda.isToday"
                        [class.text-text-muted]="!celda.isToday"
                      >
                        {{ getMesCorto(mesActual()) }}
                      </span>
                      <span
                        class="text-lg font-black leading-none"
                        [class.text-text-primary]="!celda.isToday"
                      >
                        {{ celda.day }}
                      </span>
                    </div>

                    <div class="flex flex-col flex-1">
                      @if (celda.cierre; as cierre) {
                        <div class="flex items-center gap-1.5 mb-0.5">
                          @if (cierre.estadoDiferencia === 'balanced') {
                            <div class="w-1.5 h-1.5 rounded-full bg-success"></div>
                            <span class="text-[13px] font-bold text-text-primary">Cuadrado</span>
                          } @else if (cierre.estadoDiferencia === 'surplus') {
                            <div class="w-1.5 h-1.5 rounded-full bg-warning"></div>
                            <span class="text-[13px] font-bold text-text-primary">Sobrante</span>
                          } @else {
                            <div class="w-1.5 h-1.5 rounded-full bg-error"></div>
                            <span class="text-[13px] font-bold text-text-primary">Descuadre</span>
                          }
                        </div>
                        <div class="flex items-center gap-1 text-text-muted text-xs">
                          <app-icon name="user" [size]="10" />
                          <span class="truncate max-w-[120px] lg:max-w-none">{{
                            cierre.cajero
                          }}</span>
                        </div>
                      } @else if (celda.isToday) {
                        <div class="flex items-center gap-1.5 mb-1 text-brand">
                          <app-icon name="loader" [size]="14" class="animate-spin" />
                          <span class="text-[13px] font-bold">Sesión en curso</span>
                        </div>
                        <span class="text-text-muted text-[11px] font-semibold"
                          >Esperando cierre operativo</span
                        >
                      }
                    </div>
                  </div>

                  <div class="flex flex-col items-end gap-1">
                    @if (celda.cierre; as cierre) {
                      <span
                        class="text-[13px] font-black tabular-nums tracking-tight"
                        [class.text-error]="cierre.estadoDiferencia === 'shortage'"
                        [class.text-warning]="cierre.estadoDiferencia === 'surplus'"
                        [class.text-success]="cierre.estadoDiferencia === 'balanced'"
                      >
                        {{ formatDiferencia(cierre.diferencia) }}
                      </span>
                      <app-icon
                        name="chevron-right"
                        [size]="16"
                        class="text-text-muted opacity-50"
                      />
                    }
                  </div>
                </button>
              }
            }

            @if (mesSinCierresMobile()) {
              <div
                class="flex flex-col items-center justify-center py-12 px-4 shadow-inner text-center bg-subtle text-text-muted"
              >
                <div
                  class="w-12 h-12 rounded-full bg-surface border border-border-muted flex items-center justify-center mb-3"
                >
                  <app-icon name="calendar-x" [size]="20" class="opacity-50" />
                </div>
                <h3 class="text-sm font-bold text-text-primary mb-1">Sin Actividad</h3>
                <p class="text-xs max-w-[200px]">
                  No existen cierres ni registros arqueados en este mes.
                </p>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class HistorialCuadraturasContentComponent implements AfterViewInit {
  // ── Inputs ────────────────────────────────────────────────────────────────
  cierres = input<HistorialCierre[]>([]);
  isLoading = input(false);
  mesActual = input<number>(new Date().getMonth() + 1);
  anioActual = input<number>(new Date().getFullYear());
  backRoute = input<string | null>(null);
  backLabel = input<string>('Volver');
  isExporting = input(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  mesAnterior = output<void>();
  mesSiguiente = output<void>();
  exportarMes = output<'excel' | 'pdf'>();
  cierreClicked = output<HistorialCierre>();

  // ── Estado interno ────────────────────────────────────────────────────────
  protected readonly exportMenuOpen = signal(false);

  private readonly gsap = inject(GsapAnimationsService);
  private readonly pageRef = viewChild<ElementRef<HTMLElement>>('pageRef');

  // ── Constantes y Configuración de Hero ─────────────────────────────────────
  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly skeletonCells = Array.from({ length: 35 });

  ngAfterViewInit(): void {
    const el = this.pageRef()?.nativeElement;
    if (el) this.gsap.animateBentoGrid(el);
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  protected readonly mesLabel = computed(
    () => `${MESES[this.mesActual() - 1]} ${this.anioActual()}`,
  );

  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const mes = this.mesActual();
    const anio = this.anioActual();
    const cierresMap = new Map(this.cierres().map((c) => [c.fecha, c]));

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const firstDay = new Date(anio, mes - 1, 1);
    const daysInMonth = new Date(anio, mes, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;

    const days: CalendarDay[] = [];

    for (let i = 0; i < offset; i++) {
      days.push({ day: null, dateStr: null, cierre: null, isToday: false });
    }

    const yyyy = String(anio);
    const mm = String(mes).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yyyy}-${mm}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        cierre: cierresMap.get(dateStr) ?? null,
        isToday: dateStr === todayStr,
      });
    }

    const remainder = days.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        days.push({ day: null, dateStr: null, cierre: null, isToday: false });
      }
    }

    return days;
  });

  protected readonly mesSinCierresMobile = computed(() => {
    return !this.calendarDays().some((c) => c.day && (c.cierre || c.isToday));
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  protected formatDiferencia(diff: number): string {
    const formatted = formatCLP(diff);
    if (diff > 0) return `+ ${formatted}`;
    if (diff < 0) return `- ${formatted}`;
    return formatted;
  }

  protected requestExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    this.exportarMes.emit(format);
  }

  protected getMesCorto(numeroMes: number): string {
    const ms = MESES[numeroMes - 1];
    return ms ? ms.substring(0, 3) : '';
  }
}
