import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

// Shared
import { IconComponent } from '../icon/icon.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '../section-hero/section-hero.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

// Services
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// Models
import type {
  AlumnoProfesionalTableRow,
  SemaforoAsistencia,
} from '@core/models/ui/alumno-profesional-table-row.model';
import type { AlumnoStatus } from '@core/models/ui/alumno-table-row.model';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';

interface SemaforoInfo {
  label: string;
  severity: 'success' | 'warn' | 'danger' | 'secondary';
}

@Component({
  selector: 'app-alumnos-profesional-list-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    SelectModule,
    TagModule,
    TooltipModule,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    AnimateInDirective,
    CardHoverDirective,
  ],
  template: `
    <div
      class="bento-grid"
      appBentoGridLayout
      #bentoGrid
      aria-label="Panel de alumnos profesionales"
    >
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Alumnos Profesional"
        [subtitle]="heroSubtitle()"
        [chips]="heroChips()"
        [kpis]="heroKpis()"
        [actions]="heroActions()"
        [backClickable]="trashView()"
        backLabel="Alumnos Profesional"
        (backClicked)="trashViewToggled.emit()"
        (actionClick)="handleHeroAction($event)"
      />


      <!-- Filtros + Tabla -->
      <div class="bento-banner card p-0 overflow-hidden shadow-sm" appCardHover>
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default">
          <div class="relative flex-1 min-w-52 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar por nombre, RUT o Nº Matrícula..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              data-llm-description="Search professional students by name, RUT or enrollment number"
              [(ngModel)]="searchTerm"
            />
          </div>

          <p-select
            [options]="claseOptions"
            [(ngModel)]="selectedClase"
            optionLabel="label"
            optionValue="value"
            class="h-9"
            data-llm-description="Filter professional students by license class"
          />
          <p-select
            [options]="estadoOptions"
            [(ngModel)]="selectedEstado"
            optionLabel="label"
            optionValue="value"
            class="h-9"
            data-llm-description="Filter professional students by enrollment status"
          />

          <span class="ml-auto text-sm text-text-muted">
            {{ filteredAlumnos().length }} resultado{{ filteredAlumnos().length !== 1 ? 's' : '' }}
          </span>
        </div>

        @if (isLoading()) {
          <div class="p-4 space-y-3" appAnimateIn>
            @for (i of skeletonRows; track i) {
              <app-skeleton-block variant="rect" width="100%" height="44px" />
            }
          </div>
        } @else {
          <!-- Tabla (desktop) -->
          <div class="hidden md:block" appAnimateIn>
            <p-table
              [value]="filteredAlumnos()"
              [rows]="10"
              [paginator]="filteredAlumnos().length > 10"
              styleClass="p-datatable-sm p-datatable-striped"
              [showCurrentPageReport]="true"
              currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} alumnos"
            >
              <ng-template pTemplate="header">
                <tr
                  class="bg-subtle text-text-muted uppercase text-xs tracking-wider font-medium text-left"
                >
                  <th class="pl-6 py-4">Alumno</th>
                  <th>Nº Mat.</th>
                  <th>Promoción</th>
                  <th>Módulos</th>
                  <th>Asistencia</th>
                  <th>Estado</th>
                  <th>Saldo</th>
                  <th class="pr-6 text-right">Acciones</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-alumno>
                <tr class="hover:bg-subtle transition-colors border-b border-border-subtle">
                  <td class="pl-6 py-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                      >
                        {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                      </div>
                      <div class="flex flex-col">
                        <span class="font-bold text-sm text-text-primary"
                          >{{ alumno.apellido }} {{ alumno.nombre }}</span
                        >
                        <span class="text-xs text-text-muted">{{ alumno.rut }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="text-xs text-text-muted font-mono">{{ alumno.nroMatricula }}</td>
                  <td>
                    <span
                      class="text-xs px-2 py-0.5 rounded-full border border-border-subtle text-text-secondary bg-brand-muted"
                    >
                      {{ alumno.promocion }}
                    </span>
                  </td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="w-16 h-1.5 rounded-full bg-elevated overflow-hidden">
                        <div
                          class="h-full bg-brand rounded-full"
                          [style.width.%]="moduloPct(alumno)"
                        ></div>
                      </div>
                      <span class="text-xs text-text-secondary font-mono"
                        >{{ alumno.modulosAprobados }}/{{ alumno.modulosTotal }}</span
                      >
                    </div>
                  </td>
                  <td>
                    @let sem = getSemaforo(alumno.semaforo);
                    <p-tag
                      [value]="sem.label"
                      [severity]="sem.severity"
                      styleClass="text-xs font-bold px-2 py-0.5"
                    ></p-tag>
                  </td>
                  <td>
                    <p-tag
                      [value]="alumno.estado"
                      [severity]="getStatusSeverity(alumno.estado)"
                      styleClass="text-xs font-bold px-2 py-0.5"
                    ></p-tag>
                  </td>
                  <td class="text-xs font-medium text-text-secondary">
                    {{ alumno.saldo | currency: 'CLP' : 'symbol' : '1.0-0' }}
                  </td>
                  <td class="pr-6 text-right">
                    <div class="inline-flex items-center justify-end gap-0.5">
                      @if (trashView()) {
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-success"
                          pTooltip="Restaurar alumno"
                          (click)="restaurarRequested.emit(alumno.id)"
                          data-llm-action="restore-professional-student"
                        >
                          <app-icon name="rotate-ccw" [size]="16" />
                        </button>
                      } @else {
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center"
                          pTooltip="Ver ficha"
                          [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                        >
                          <app-icon name="eye" [size]="16" />
                        </button>
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-error"
                          pTooltip="Archivar alumno"
                          (click)="archivarRequested.emit(alumno.id)"
                          data-llm-action="archive-professional-student"
                        >
                          <app-icon name="trash-2" [size]="16" />
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="8" class="p-0">
                    <app-empty-state
                      icon="graduation-cap"
                      message="No hay alumnos profesionales"
                      subtitle="Ajusta los filtros o registra nuevas matrículas profesionales."
                      actionLabel="Limpiar filtros"
                      actionIcon="refresh-cw"
                      (action)="resetFilters()"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <!-- Cards (mobile) -->
          <div class="md:hidden p-4 space-y-3" appAnimateIn>
            @for (alumno of filteredAlumnos(); track alumno.id) {
              <div class="bg-base border border-border-subtle rounded-xl p-4 shadow-sm">
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="shrink-0 w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-border-default text-text-primary font-black text-sm uppercase"
                    >
                      {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="font-bold text-sm text-text-primary truncate"
                        >{{ alumno.apellido }} {{ alumno.nombre }}</span
                      >
                      <span class="text-xs text-text-muted truncate">{{ alumno.promocion }}</span>
                    </div>
                  </div>
                  <p-tag
                    [value]="alumno.estado"
                    [severity]="getStatusSeverity(alumno.estado)"
                    styleClass="text-[10px] font-bold px-2 py-0.5 shrink-0"
                  ></p-tag>
                </div>
                <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div class="flex flex-col">
                    <span class="text-[11px] text-text-muted mb-0.5">Módulos</span>
                    <span class="font-medium text-text-secondary text-xs font-mono"
                      >{{ alumno.modulosAprobados }}/{{ alumno.modulosTotal }}</span
                    >
                  </div>
                  <div class="flex flex-col">
                    <span class="text-[11px] text-text-muted mb-0.5">Asistencia</span>
                    @let semM = getSemaforo(alumno.semaforo);
                    <div>
                      <p-tag
                        [value]="semM.label"
                        [severity]="semM.severity"
                        styleClass="text-[10px] font-bold px-1.5 py-0.5"
                      ></p-tag>
                    </div>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-[11px] text-text-muted mb-0.5">Saldo</span>
                    <span class="font-medium text-text-secondary text-xs">{{
                      alumno.saldo | currency: 'CLP' : 'symbol' : '1.0-0'
                    }}</span>
                  </div>
                  <div class="flex items-end justify-end gap-0.5">
                    @if (trashView()) {
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-success"
                        pTooltip="Restaurar"
                        (click)="restaurarRequested.emit(alumno.id)"
                        data-llm-action="restore-professional-student-card"
                      >
                        <app-icon name="rotate-ccw" [size]="16" />
                      </button>
                    } @else {
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center"
                        pTooltip="Ver ficha"
                        [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                      >
                        <app-icon name="eye" [size]="16" />
                      </button>
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-error"
                        pTooltip="Archivar"
                        (click)="archivarRequested.emit(alumno.id)"
                        data-llm-action="archive-professional-student-card"
                      >
                        <app-icon name="trash-2" [size]="16" />
                      </button>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <app-empty-state
                icon="graduation-cap"
                message="No hay alumnos profesionales"
                subtitle="Ajusta los filtros o registra nuevas matrículas profesionales."
                actionLabel="Limpiar filtros"
                actionIcon="refresh-cw"
                (action)="resetFilters()"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AlumnosProfesionalListContentComponent implements AfterViewInit {
  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly alumnos = input.required<AlumnoProfesionalTableRow[]>();
  readonly isLoading = input(false);
  readonly trashView = input(false);
  readonly basePath = input<string>('/app/admin');

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly refreshRequested = output<void>();
  readonly preInscritosRequested = output<void>();
  readonly archivarRequested = output<string>();
  readonly restaurarRequested = output<string>();
  readonly trashViewToggled = output<void>();

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly skeletonRows = Array(6).fill(0);

  searchTerm = '';
  selectedClase = '';
  selectedEstado = '';

  readonly claseOptions = [
    { label: 'Todas las clases', value: '' },
    { label: 'A2', value: 'A2' },
    { label: 'A3', value: 'A3' },
    { label: 'A4', value: 'A4' },
    { label: 'A5', value: 'A5' },
  ];
  readonly estadoOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Activo', value: 'Activo' },
    { label: 'Finalizado', value: 'Finalizado' },
    { label: 'Inactivo', value: 'Inactivo' },
    { label: 'Retirado', value: 'Retirado' },
  ];

  // ── Derivados ─────────────────────────────────────────────────────────────
  readonly heroSubtitle = computed(() =>
    this.trashView()
      ? 'Papelera — Alumnos profesionales archivados'
      : 'Listado de alumnos de Clase Profesional',
  );

  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.alumnos().length} alumnos`, icon: 'graduation-cap', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] => {
    const isTrash = this.trashView();
    return [
      { id: 'preinscritos', label: 'Pre-inscritos', icon: 'users', primary: false },
      { id: 'papelera', label: 'Papelera', icon: 'trash-2', primary: false, danger: isTrash },
    ];
  });

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Total',
      value: this.alumnos().length,
      icon: 'graduation-cap',
      color: 'default',
    },
    {
      id: 'activos',
      label: 'Activos',
      value: this.activos(),
      icon: 'user-check',
      color: 'success',
    },
    {
      id: 'deuda',
      label: 'Con deuda',
      value: this.conDeuda(),
      icon: 'circle-alert',
      color: 'warning',
    },
    {
      id: 'riesgo',
      label: 'En riesgo',
      value: this.enRiesgo(),
      icon: 'alert-triangle',
      color: 'error',
    },
  ]);

  readonly activos = computed(() => this.alumnos().filter((a) => a.estado === 'Activo').length);
  readonly conDeuda = computed(() => this.alumnos().filter((a) => a.saldo > 0).length);
  readonly enRiesgo = computed(() => this.alumnos().filter((a) => a.semaforo === 'red').length);

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  filteredAlumnos(): AlumnoProfesionalTableRow[] {
    const term = this.searchTerm.toLowerCase();
    return this.alumnos().filter((a) => {
      const matchSearch =
        !term ||
        a.nombre.toLowerCase().includes(term) ||
        a.apellido.toLowerCase().includes(term) ||
        a.rut.includes(term) ||
        a.nroMatricula.toLowerCase().includes(term);
      const matchClase = !this.selectedClase || a.licenseClass === this.selectedClase;
      const matchEstado = !this.selectedEstado || a.estado === this.selectedEstado;
      return matchSearch && matchClase && matchEstado;
    });
  }

  moduloPct(a: AlumnoProfesionalTableRow): number {
    return a.modulosTotal > 0 ? Math.round((a.modulosAprobados / a.modulosTotal) * 100) : 0;
  }

  getSemaforo(flag: SemaforoAsistencia | null): SemaforoInfo {
    switch (flag) {
      case 'green':
        return { label: 'Al día', severity: 'success' };
      case 'yellow':
        return { label: 'En riesgo', severity: 'warn' };
      case 'red':
        return { label: 'Crítico', severity: 'danger' };
      default:
        return { label: 'Sin datos', severity: 'secondary' };
    }
  }

  getStatusSeverity(
    status: AlumnoStatus,
  ): 'success' | 'secondary' | 'info' | 'danger' | 'warn' | undefined {
    switch (status) {
      case 'Activo':
        return 'success';
      case 'Finalizado':
        return 'info';
      case 'Retirado':
        return 'danger';
      case 'Inactivo':
        return 'secondary';
      default:
        return 'warn';
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedClase = '';
    this.selectedEstado = '';
  }

  handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'preinscritos':
        this.preInscritosRequested.emit();
        break;
      case 'papelera':
        this.trashViewToggled.emit();
        break;
      default:
        break;
    }
  }
}
