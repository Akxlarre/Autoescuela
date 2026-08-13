import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { SelectModule } from 'primeng/select';
import { StudentDrawerDetailComponent } from './components/student-drawer-detail.component';
import type { InstructorStudentCard } from '@core/models/ui/instructor-portal.model';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { formatKpiEsCl } from '@core/utils/kpi-es-cl-format.util';
import { LayoutService } from '@core/services/ui/layout.service';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import { avatarPalette } from '@core/utils/avatar-palette';

const PAGE_SIZE = 9;

@Component({
  selector: 'app-instructor-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    DatePipe,
    TagModule,
    TableModule,
    SectionHeroComponent,
    EmptyStateComponent,
    IconComponent,
    SkeletonBlockComponent,
    CardHoverDirective,
    BentoGridLayoutDirective,
    BentoRevealDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoReveal appBentoGridLayout>
      <!-- ══ HERO ══ -->
      <app-section-hero
        [animateOnInit]="false"
        title="Mis Alumnos"
        subtitle="Gestiona y haz seguimiento a tus alumnos asignados"
        [actions]="heroActions"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="facade.isLoading()"
        [loadingKpiCount]="4"
      />

      <!-- ══ MAIN CONTENT (Dual-Viewport — mismo canon que alumnos-list-content) ══ -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden shadow-sm dual-viewport-container flex flex-col w-full h-full"
        appCardHover
      >
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default">
          <!-- Buscador -->
          <div class="search-field flex-1 min-w-52 max-w-xs">
            <app-icon name="search" [size]="18" class="text-text-muted" />
            <input
              type="text"
              class="search-field__input"
              placeholder="Buscar alumno por nombre o RUT..."
              [ngModel]="searchTerm()"
              (ngModelChange)="onSearch($event)"
            />
            @if (searchTerm()) {
              <button
                class="search-field__clear"
                aria-label="Limpiar búsqueda"
                (click)="onSearch('')"
              >
                <app-icon name="x" [size]="14" />
              </button>
            }
          </div>

          <!-- Filtro por estado -->
          <div class="flex gap-2 overflow-x-auto no-scrollbar">
            @for (f of statusFilters; track f.value) {
              <button
                class="filter-pill"
                [class.filter-pill--active]="filterStatus() === f.value"
                (click)="setFilter(f.value)"
              >
                <span
                  class="filter-pill__dot"
                  [class.filter-pill__dot--active]="filterStatus() === f.value"
                ></span>
                <span>{{ f.label }}</span>
                <span class="filter-pill__badge">{{ f.count() }}</span>
              </button>
            }
          </div>

          <!-- Sort -->
          <p-select
            [options]="sortOptions"
            optionLabel="label"
            optionValue="value"
            [ngModel]="sortBy()"
            (ngModelChange)="sortBy.set($event)"
            styleClass="w-44 ml-auto"
            data-llm-description="sort student list by field"
          />
        </div>

        @if (facade.isLoading()) {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <!-- VISTA 1: TABLA SKELETON (oculta cuando se comprime) -->
            <div
              class="desktop-view hide-on-squeeze p-4 space-y-0 flex flex-col flex-1 min-h-0 h-full w-full"
            >
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                <app-skeleton-block variant="text" width="28%" height="11px" />
                <app-skeleton-block variant="text" width="20%" height="11px" />
                <app-skeleton-block variant="text" width="20%" height="11px" />
                <app-skeleton-block variant="text" width="18%" height="11px" />
                <app-skeleton-block variant="text" width="14%" height="11px" />
              </div>
              @for (row of skeletonItems; track row) {
                <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                  <div class="flex items-center gap-3 w-[28%]">
                    <app-skeleton-block variant="circle" width="36px" height="36px" />
                    <div class="flex flex-col gap-1.5 flex-1">
                      <app-skeleton-block variant="text" width="70%" height="12px" />
                      <app-skeleton-block variant="text" width="45%" height="10px" />
                    </div>
                  </div>
                  <app-skeleton-block variant="text" width="20%" height="12px" />
                  <app-skeleton-block variant="rect" width="20%" height="6px" />
                  <app-skeleton-block variant="text" width="18%" height="12px" />
                  <app-skeleton-block variant="rect" width="64px" height="22px" />
                </div>
              }
            </div>

            <!-- VISTA 2: TARJETAS SKELETON (visible cuando se comprime o en móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="bento-grid">
                @for (i of skeletonItems; track i) {
                  <div class="student-card bento-wide" aria-hidden="true" data-col-span="4">
                    <div class="student-card__accent bg-subtle"></div>
                    <div class="p-5 flex flex-col gap-4 h-full">
                      <div class="flex justify-between items-start gap-4">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                          <app-skeleton-block variant="circle" width="42px" height="42px" />
                          <div class="flex-1 space-y-2">
                            <app-skeleton-block variant="text" width="65%" />
                            <app-skeleton-block variant="text" width="40%" />
                          </div>
                        </div>
                        <app-skeleton-block variant="rect" width="64px" height="22px" />
                      </div>
                      <app-skeleton-block variant="text" width="75%" />
                      <div class="space-y-2">
                        <div class="flex justify-between">
                          <app-skeleton-block variant="text" width="45%" />
                          <app-skeleton-block variant="text" width="20%" />
                        </div>
                        <app-skeleton-block variant="rect" height="6px" />
                      </div>
                      <div class="pt-4 mt-auto border-t border-border-subtle">
                        <div class="flex items-center justify-between">
                          <app-skeleton-block variant="text" width="50%" />
                          <app-skeleton-block variant="rect" width="48px" height="22px" />
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <!-- VISTA 1: LA TABLA CLÁSICA (oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
              <p-table
                [value]="filteredStudents()"
                [rows]="9"
                [paginator]="true"
                [scrollable]="true"
                scrollHeight="flex"
                responsiveLayout="scroll"
                styleClass="p-datatable-sm p-datatable-striped h-full flex flex-col"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} alumnos"
              >
                <ng-template pTemplate="header">
                  <tr class="micro-label text-left">
                    <th class="pl-6 py-4">Alumno</th>
                    <th>Curso</th>
                    <th>Progreso Práctico</th>
                    <th>Próxima Clase</th>
                    <th class="pr-6">Estado</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-s>
                  <tr
                    class="list-item-hover transition-colors border-b border-border-subtle cursor-pointer"
                    (click)="openDetail(s)"
                  >
                    <td class="pl-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase shrink-0"
                        >
                          {{ initials(s.name) }}
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="item-title truncate">{{ s.name }}</span>
                          <span class="text-xs text-text-muted font-mono">{{ s.rut }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-sm text-text-secondary">{{ s.courseName }}</td>
                    <td>
                      <div class="flex items-center gap-2 min-w-[140px]">
                        <div class="progress-track flex-1">
                          <div
                            class="progress-fill"
                            [style.width.%]="s.practicePercent"
                            [style.background]="getPalette(s.name).bg"
                          ></div>
                        </div>
                        <span class="text-xs font-bold text-text-primary whitespace-nowrap"
                          >{{ s.practiceProgress }}/{{ s.totalSessions }}</span
                        >
                      </div>
                    </td>
                    <td class="text-xs text-text-secondary">
                      {{
                        s.nextClassDate ? (s.nextClassDate | date: 'dd MMM, HH:mm') : 'Sin agendar'
                      }}
                    </td>
                    <td class="pr-6">
                      <p-tag
                        [value]="s.statusLabel"
                        [severity]="$any(s.statusColor)"
                        styleClass="text-xs font-bold px-2 py-0.5"
                      ></p-tag>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="5" class="p-0">
                      <app-empty-state
                        icon="search"
                        message="No se encontraron alumnos"
                        subtitle="Refina tus términos de búsqueda o filtros."
                        actionLabel="Ver todos"
                        (action)="clearFilters()"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>

            <!-- VISTA 2: TARJETAS APILADAS (visible cuando se comprime o en móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="bento-grid">
                @for (s of visibleStudents(); track s.studentId) {
                  <div
                    class="student-card group bento-wide"
                    appCardHover
                    (click)="openDetail(s)"
                    data-col-span="4"
                  >
                    <!-- Accent gradient top bar -->
                    <div
                      class="student-card__accent"
                      [style.background]="getPalette(s.name).bg"
                    ></div>

                    <div class="p-5 flex flex-col gap-4 h-full relative">
                      <!-- Header -->
                      <div class="flex justify-between items-start gap-4">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="avatar-ring" [style.background]="getPalette(s.name).bg">
                            {{ initials(s.name) }}
                          </div>
                          <div class="min-w-0">
                            <h3
                              class="text-sm font-bold truncate"
                              [style.color]="'var(--text-primary)'"
                            >
                              {{ s.name }}
                            </h3>
                            <p class="text-xs" [style.color]="'var(--text-muted)'">{{ s.rut }}</p>
                          </div>
                        </div>
                        <p-tag [value]="s.statusLabel" [severity]="$any(s.statusColor)" />
                      </div>

                      <!-- Curso -->
                      <div
                        class="flex items-center gap-2 text-xs"
                        [style.color]="'var(--text-secondary)'"
                      >
                        <app-icon name="book-open" [size]="14" />
                        <span class="truncate" [attr.title]="s.courseName">{{ s.courseName }}</span>
                      </div>

                      <!-- Progreso -->
                      <div class="space-y-2">
                        <div
                          class="flex justify-between text-xs"
                          [style.color]="'var(--text-muted)'"
                        >
                          <span>Progreso Práctico</span>
                          <span class="font-bold" [style.color]="'var(--text-primary)'"
                            >{{ s.practiceProgress }}/{{ s.totalSessions }}</span
                          >
                        </div>
                        <div class="progress-track">
                          <div
                            class="progress-fill"
                            [style.width.%]="s.practicePercent"
                            [style.background]="getPalette(s.name).bg"
                          ></div>
                        </div>
                      </div>

                      <!-- Footer -->
                      <div
                        class="pt-4 mt-auto flex items-center justify-between border-t border-border-subtle"
                      >
                        <div
                          class="flex items-center gap-2 text-xs"
                          [style.color]="'var(--text-muted)'"
                        >
                          <app-icon name="calendar" [size]="14" />
                          <span>{{
                            s.nextClassDate
                              ? (s.nextClassDate | date: 'dd MMM, HH:mm')
                              : 'Sin agendar'
                          }}</span>
                        </div>
                        <div class="details-link">
                          <span>Ficha</span>
                          <app-icon name="chevron-right" [size]="14" />
                        </div>
                      </div>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      icon="search"
                      message="No se encontraron alumnos"
                      subtitle="Refina tus términos de búsqueda o filtros."
                      actionLabel="Ver todos"
                      (action)="clearFilters()"
                    />
                  </div>
                }

                <!-- Densidad adaptativa: "Cargar más" solo en tablet/mobile (maxVisible() no-null) -->
                @if (remainingStudents() > 0) {
                  <div class="col-span-full pt-1">
                    <button
                      type="button"
                      class="btn-ghost w-full flex items-center justify-center gap-2 font-medium"
                      (click)="loadMoreStudents()"
                      data-llm-action="cargar-mas-alumnos"
                    >
                      <app-icon name="chevron-down" [size]="16" />
                      Cargar más ({{ remainingStudents() }} restantes)
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* ══ Search field premium ══ */
      .search-field {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        background: var(--bg-elevated);
        border: 1.5px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        transition: all var(--duration-fast) var(--ease-standard);
      }
      .search-field:focus-within {
        background: var(--bg-surface);
        border-color: var(--color-primary);
        box-shadow:
          var(--shadow-sm),
          0 0 0 3px color-mix(in sRGB, var(--color-primary) 10%, transparent);
      }
      .search-field__input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-primary);
      }
      .search-field__clear {
        width: 20px;
        height: 20px;
        border-radius: var(--radius-full);
        background: var(--bg-subtle);
        color: var(--text-muted);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      /* ══ Filters & Tools ══ */
      .filter-pill {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        background: var(--bg-elevated);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        cursor: pointer;
        white-space: nowrap;
        transition: 0.15s;
      }
      .filter-pill--active {
        background: var(--color-primary);
        color: #fff;
        border-color: transparent;
      }
      .filter-pill__dot {
        width: 6px;
        height: 6px;
        border-radius: var(--radius-full);
        background: var(--border-subtle);
      }
      .filter-pill__dot--active {
        background: #fff;
      }
      .filter-pill__badge {
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        opacity: 0.6;
      }

      /* ══ Student Card (mobile) ══ */
      .student-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        position: relative;
        overflow: hidden;
        cursor: pointer;
        height: 100%;
        /* Hover gestionado por appCardHover (GSAP) — sin CSS transition aquí */
      }
      .student-card__accent {
        height: 4px;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0.8;
      }

      .avatar-ring {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        box-shadow: var(--shadow-sm);
      }

      .progress-track {
        height: 6px;
        width: 100%;
        background: var(--bg-subtle);
        border-radius: var(--radius-full);
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        transition: width var(--duration-slow) var(--ease-standard);
      }

      .details-link {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        color: var(--color-primary);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        background: color-mix(in sRGB, var(--color-primary) 8%, transparent);
        opacity: 0.7;
        transition: 0.2s;
      }
      .group:hover .details-link {
        opacity: 1;
        transform: translateX(2px);
      }

      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      /* ══ Dual Viewport — mismo canon que alumnos-list-content (spec 0036-b) ══ */
      .dual-viewport-container {
        container-type: inline-size;
        container-name: instructorAlumnosContainer;
      }
      .show-on-squeeze {
        display: none;
      }
      @container instructorAlumnosContainer (max-width: 900px) {
        .hide-on-squeeze {
          display: none !important;
        }
        .show-on-squeeze {
          display: block !important;
        }
      }
    `,
  ],
})
export class InstructorAlumnosComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorAlumnosFacade);
  public searchTerm = signal('');
  public filterStatus = signal<'all' | 'active' | 'completed'>('all');
  public sortBy = signal<'name' | 'progress' | 'nextClass'>('name');

  readonly sortOptions = [
    { label: 'Nombre A-Z', value: 'name' },
    { label: 'Mayor Progreso', value: 'progress' },
    { label: 'Próxima Clase', value: 'nextClass' },
  ];

  readonly skeletonItems = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly heroActions: SectionHeroAction[] = [];

  /**
   * KPIs del strip del hero slim (antes: 4 celdas `bento-square` sueltas).
   * Los valores van pre-formateados: el strip renderiza `{{ kpi.value }}` crudo
   * y no pasa por `animateCounter`, que era quien localizaba a es-CL.
   */
  readonly heroKpis = computed<SectionHeroKpi[]>(() => {
    const k = this.facade.kpis();
    return [
      { id: 'total', label: 'Total Alumnos', value: formatKpiEsCl(k.totalAlumnos) },
      { id: 'activos', label: 'Activos', value: formatKpiEsCl(k.activos), color: 'success' },
      {
        id: 'progreso',
        label: 'Progreso Promedio',
        value: formatKpiEsCl(k.promedioProgreso),
        suffix: '%',
      },
      {
        id: 'por-certificar',
        label: 'Por Certificar',
        value: formatKpiEsCl(k.porCertificar),
        color: 'warning',
      },
    ];
  });

  readonly statusFilters = [
    { value: 'all' as const, label: 'Todos', count: () => this.facade.students().length },
    { value: 'active' as const, label: 'Activos', count: () => this.facade.kpis().activos },
    {
      value: 'completed' as const,
      label: 'Completados',
      count: () => this.facade.kpis().completados,
    },
  ];

  public filteredStudents = computed(() => {
    let list = this.facade.students() ?? [];
    const term = this.searchTerm().toLowerCase().trim();
    if (term)
      list = list.filter(
        (s) => s.name.toLowerCase().includes(term) || s.rut.toLowerCase().includes(term),
      );
    const status = this.filterStatus();
    if (status !== 'all') list = list.filter((s) => s.status === status);
    const sort = this.sortBy();
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'progress') list = [...list].sort((a, b) => b.practicePercent - a.practicePercent);
    if (sort === 'nextClass')
      list = [...list].sort((a, b) => {
        if (!a.nextClassDate) return 1;
        if (!b.nextClassDate) return -1;
        return a.nextClassDate.localeCompare(b.nextClassDate);
      });
    return list;
  });

  /** Densidad adaptativa (fix-139-b / ASG-b-078): sin límite en desktop (la tabla pagina
   *  sola vía p-table); presupuesto + "Cargar más" en tablet/mobile — mismo patrón que
   *  admin-secretarias/admin-instructores (ASG-b-066/068). */
  private static readonly CARDS_STEP = PAGE_SIZE;
  private readonly layoutService = inject(LayoutService);
  public readonly mobileShown = signal(InstructorAlumnosComponent.CARDS_STEP);

  public readonly maxVisible = computed(() =>
    this.layoutService.tier() === 'desktop' ? null : this.mobileShown(),
  );

  public readonly visibleStudents = computed(() =>
    sliceByBudget(this.filteredStudents(), this.maxVisible()),
  );

  public readonly remainingStudents = computed(() => {
    const max = this.maxVisible();
    if (max === null) return 0;
    return Math.max(0, this.filteredStudents().length - max);
  });

  public loadMoreStudents(): void {
    this.mobileShown.update((n) => n + InstructorAlumnosComponent.CARDS_STEP);
  }

  private resetDensity(): void {
    this.mobileShown.set(InstructorAlumnosComponent.CARDS_STEP);
  }

  getPalette = (name: string) => avatarPalette(name);
  initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('');

  onSearch(val: string) {
    this.searchTerm.set(val);
    this.resetDensity();
  }
  setFilter(val: 'all' | 'active' | 'completed') {
    this.filterStatus.set(val);
    this.resetDensity();
  }
  clearFilters() {
    this.searchTerm.set('');
    this.filterStatus.set('all');
    this.resetDensity();
  }

  openDetail(student: InstructorStudentCard) {
    this.facade.setActiveStudent(student);
    this.facade.openDrawer(StudentDrawerDetailComponent, student.name, 'user');
  }

  async ngOnInit() {
    await this.facade.initialize();
  }

  ngAfterViewInit() {
    requestAnimationFrame(() => {});
  }
}
