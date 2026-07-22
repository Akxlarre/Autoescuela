import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsistenciaProfesionalFacade } from '@core/facades/asistencia-profesional.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { SelectModule } from 'primeng/select';
import { AdminSesionDrawerComponent } from './admin-sesion-drawer.component';
import { WeekMatrixComponent } from './week-matrix.component';
import { FirmaSemanalTableComponent } from './firma-semanal-table.component';
import { ResumenAlumnosTableComponent } from './resumen-alumnos-table.component';
import type { SesionProfesional } from '@core/models/ui/sesion-profesional.model';

/**
 * Página de Clases y Asistencia de Clase Profesional (admin; secretaría la
 * reutiliza vía thin-wrapper). Modo dual (spec 0033-b): fill-screen en desktop
 * (hero / mapa semanal / panel de tabs con scroll interno) y scroll nativo bajo lg.
 * El modificador fill-screen es incondicional para que la página nunca scrollee
 * en desktop (sin shift de scrollbar, canon spec 0031).
 */
@Component({
  selector: 'app-admin-profesional-asistencia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
    CardHoverDirective,
    WeekMatrixComponent,
    FirmaSemanalTableComponent,
    ResumenAlumnosTableComponent,
    SelectModule,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen-kpi" appBentoReveal appBentoGridLayout>
      <!-- ═══ Hero (fila 1, auto) ═══ -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Clases y Asistencia"
        subtitle="Gestión de sesiones teóricas y prácticas de Clase Profesional"
        [actions]="[]"
        [kpis]="heroKpis()"
      />

      <!-- ═══ Mapa semanal (fila 2, auto): toolbar + grilla de días ═══ -->
      <div class="bento-banner card p-0 flex flex-col overflow-hidden" appCardHover>
        <!-- TOOLBAR: Filtros + Navegación. Switch fila/columna por CONTENEDOR
             (isDesktop() = LayoutService.tier() por ResizeObserver de <main>),
             NUNCA por breakpoint de viewport (xl:/sm:) — con el drawer de
             sesión abierto, <main> se angosta pero el viewport sigue ancho;
             las utilities xl:/sm: no reaccionan y el toolbar se desborda
             (misma trampa documentada en spec 0030). -->
        <div
          class="px-4 py-3 lg:px-6 flex flex-col gap-4 border-b bg-surface border-border-muted"
          [class.flex-row]="isDesktop()"
          [class.items-center]="isDesktop()"
          [class.justify-between]="isDesktop()"
        >
          <!-- Selectores: flex-1 min-w-0 en cada wrapper permite que se
               achiquen cuando el contenedor no alcanza para 2×256px, en vez
               de desbordar (mismo patrón que el selector de ciclo en
               ciclos-teoricos-content). -->
          <div
            class="flex flex-col gap-3 w-full"
            [class.flex-row]="isDesktop()"
            [class.w-auto]="isDesktop()"
          >
            <div class="flex-1 min-w-0" [class.max-w-64]="isDesktop()">
              <p-select
                [options]="promoOptions()"
                optionLabel="name"
                optionValue="id"
                placeholder="Seleccione la promoción"
                [ngModel]="facade.selectedPromocionId()"
                (ngModelChange)="onPromoChange($event)"
                styleClass="w-full"
                data-llm-description="select professional promotion for attendance"
              />
            </div>
            <div class="flex-1 min-w-0" [class.max-w-64]="isDesktop()">
              <p-select
                [options]="cursoOptions()"
                optionLabel="courseCode"
                optionValue="id"
                placeholder="Módulo del Curso"
                [ngModel]="facade.selectedCursoId()"
                (ngModelChange)="onCursoChange($event)"
                styleClass="w-full"
                [disabled]="facade.cursos().length === 0"
                data-llm-description="select course module for attendance"
              />
            </div>
          </div>

          <!-- Navegación Semanal (solo se muestra si hay curso seleccionado) -->
          @if (facade.selectedCursoId()) {
            <div
              class="flex items-center gap-1 bg-elevated border border-subtle rounded-lg p-1 shrink-0"
            >
              <button
                class="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                (click)="facade.prevWeek()"
                title="Semana Anterior"
              >
                <app-icon name="chevron-left" [size]="16" />
              </button>

              <div class="px-3 flex flex-col items-center justify-center min-w-[160px]">
                <span class="text-sm font-semibold text-text-primary">{{
                  facade.weekLabel()
                }}</span>
                @if (!facade.isCurrentWeek()) {
                  <button
                    class="mt-0.5 text-2xs font-bold uppercase tracking-wider bg-brand text-white px-2 py-0.5 rounded-full transition-transform hover:scale-105 active:scale-95"
                    (click)="facade.goToCurrentWeek()"
                  >
                    Volver a Hoy
                  </button>
                }
              </div>

              <button
                class="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                (click)="facade.nextWeek()"
                title="Semana Siguiente"
              >
                <app-icon name="chevron-right" [size]="16" />
              </button>
            </div>
          }
        </div>

        <!-- MATRIZ SEMANAL compacta (refinamiento owner): columnas = días,
             filas = Teoría/Práctica. Banda mínima → máximo alto para el panel. -->
        <div class="p-3 bg-surface">
          @if (facade.isLoading()) {
            <div class="flex flex-col gap-2">
              <app-skeleton-block variant="text" width="100%" height="22px" />
              <app-skeleton-block variant="rect" width="100%" height="32px" />
              <app-skeleton-block variant="rect" width="100%" height="32px" />
            </div>
          } @else if (facade.selectedCursoId()) {
            <app-week-matrix [days]="facade.weekDays()" (selectSession)="openSesion($event)" />
          } @else {
            <div class="py-6 text-center">
              <app-icon name="calendar-check" [size]="40" color="var(--text-muted)" class="mb-2" />
              <h3 class="text-sm font-semibold text-text-primary">Información Semanal</h3>
              <p class="mt-1 text-xs text-text-secondary">
                Selecciona la Promoción y luego el Módulo de Curso para revisar su Calendario.
              </p>
            </div>
          }
        </div>
      </div>

      <!-- ═══ Panel de tablas (fila 3, fill): tabs Firma semanal | Resumen ═══ -->
      <!-- Celda .bento-fill: en desktop llena el resto del viewport (contain:size
           vía _bento-grid.scss) y el scroll vive en el cuerpo del panel; bajo lg
           mide su contenido natural y la página scrollea nativamente. -->
      <div class="bento-banner bento-fill card p-0 flex flex-col" appCardHover>
        <!-- Header: tabs + contexto del tab activo -->
        <div
          class="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap bg-surface border-border-muted"
        >
          <div
            class="flex gap-1.5 p-1 rounded-xl bg-subtle"
            role="tablist"
            aria-label="Tablas de asistencia"
          >
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'firma'"
              class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer border-0 flex items-center gap-2"
              [style.background]="activeTab() === 'firma' ? 'var(--bg-surface)' : 'transparent'"
              [style.color]="activeTab() === 'firma' ? 'var(--ds-brand)' : 'var(--text-muted)'"
              [style.boxShadow]="
                activeTab() === 'firma'
                  ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12)), inset 0 0 0 1.5px var(--ds-brand)'
                  : 'none'
              "
              data-llm-action="tab-firma-semanal"
              (click)="activeTab.set('firma')"
            >
              <app-icon name="pen-line" [size]="15" />
              Firma semanal
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'resumen'"
              class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer border-0 flex items-center gap-2"
              [style.background]="activeTab() === 'resumen' ? 'var(--bg-surface)' : 'transparent'"
              [style.color]="activeTab() === 'resumen' ? 'var(--ds-brand)' : 'var(--text-muted)'"
              [style.boxShadow]="
                activeTab() === 'resumen'
                  ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12)), inset 0 0 0 1.5px var(--ds-brand)'
                  : 'none'
              "
              data-llm-action="tab-resumen-alumnos"
              (click)="activeTab.set('resumen')"
            >
              <app-icon name="users" [size]="15" />
              Resumen por alumno
            </button>
          </div>

          @if (facade.selectedCursoId()) {
            @if (activeTab() === 'firma' && !facade.isLoadingFirmas()) {
              <span class="text-xs font-medium text-text-secondary">
                {{ facade.firmasSemanaCount().firmaron }}/{{
                  facade.firmasSemanaCount().total
                }}
                firmaron · {{ facade.weekLabel() }}
              </span>
            } @else if (activeTab() === 'resumen') {
              <span class="text-xs text-text-muted">Sesiones completadas</span>
            }
          }
        </div>

        <!-- Cuerpo con scroll interno (dueño del overflow en desktop) -->
        <div class="flex-1 min-h-0 overflow-y-auto">
          @if (!facade.selectedCursoId()) {
            <div class="p-8 text-center">
              <p class="text-sm text-text-muted">
                Selecciona la Promoción y el Módulo para ver la firma semanal y el resumen por
                alumno.
              </p>
            </div>
          } @else if (activeTab() === 'firma') {
            <app-firma-semanal-table
              [alumnos]="facade.firmasSemana()"
              [isLoading]="facade.isLoadingFirmas()"
              [isSaving]="facade.isSaving()"
              [sinSesionesSemana]="sinSesionesTeoriaSemana()"
              (registrarFirmas)="onRegistrarFirmas($event)"
            />
          } @else {
            <app-resumen-alumnos-table
              [alumnos]="facade.resumenAlumnos()"
              [isLoading]="facade.isLoadingResumen()"
            />
          }
        </div>
      </div>
    </div>
    <!-- /bento-grid -->
  `,
  styles: `
    .border-border-muted {
      border-color: var(--border-muted);
    }
  `,
})
export class AdminProfesionalAsistenciaComponent implements OnInit, OnDestroy {
  readonly facade = inject(AsistenciaProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly layoutService = inject(LayoutService);

  // ── Tab del panel de tablas ─────────────────────────────────────────────────
  readonly activeTab = signal<'firma' | 'resumen'>('firma');

  /** Tier por CONTENEDOR (<main>, ResizeObserver) — nunca viewport. Gobierna
   *  el switch fila/columna del toolbar: con el drawer de sesión abierto,
   *  <main> se angosta aunque el viewport siga ancho. */
  readonly isDesktop = computed(() => this.layoutService.tier() === 'desktop');

  readonly promoOptions = computed(() =>
    this.facade.promociones().map((p) => ({
      ...p,
      name: `${p.name} (${p.code})`,
    })),
  );

  readonly cursoOptions = computed(() =>
    this.facade.cursos().map((c) => ({
      ...c,
      courseCode: `${c.courseCode} — ${c.courseName}`,
    })),
  );

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'matriculados',
      label: 'Alumnos matriculados',
      value: this.facade.alumnosMatriculados(),
      icon: 'users',
    },
    {
      id: 'semanal',
      label: 'Asistencia semanal',
      value: this.facade.pctAsistenciaSemanal(),
      icon: 'bar-chart-2',
      suffix: '%',
      color: 'success',
    },
    {
      id: 'total',
      label: 'Asistencia total',
      value: this.facade.pctAsistenciaTotal(),
      icon: 'trending-up',
      suffix: '%',
    },
    {
      id: 'canceladas',
      label: 'Sesiones canceladas',
      value: this.facade.sesionesCanceladas(),
      icon: 'ban',
      color: 'warning',
    },
  ]);

  /** Semana visible sin sesiones de teoría (Lun/Mar sin carga) — la tabla de
   *  firma muestra "Sin sesiones" en vez de 0%. */
  readonly sinSesionesTeoriaSemana = computed(() => {
    const days = this.facade.weekDays();
    return (days[0]?.theory ?? null) === null && (days[1]?.theory ?? null) === null;
  });

  constructor() {
    // Recargar firmas cada vez que el usuario navega a otra semana
    effect(() => {
      const _week = this.facade.weekOffset();
      if (this.facade.selectedCursoId()) {
        void this.facade.fetchFirmasSemana();
      }
    });
  }

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    void this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  onPromoChange(id: number): void {
    void this.facade.selectPromocion(id);
  }

  onCursoChange(id: number): void {
    void this.facade.selectCurso(id);
  }

  openSesion(sesion: SesionProfesional): void {
    void this.facade.selectSesion(sesion);
    const tipo = sesion.tipo === 'theory' ? 'Teoría' : 'Práctica';
    const title = `${tipo} — ${this.formatDate(sesion.date)}`;
    this.layoutDrawer.open(AdminSesionDrawerComponent, title, 'clipboard-list');
  }

  async onRegistrarFirmas(enrollmentIds: number[]): Promise<void> {
    await this.facade.registrarFirmas(enrollmentIds);
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
  }
}
