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
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { StudentDrawerDetailComponent } from './components/student-drawer-detail.component';
import type { InstructorStudentCard } from '@core/models/ui/instructor-portal.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

const AVATAR_PALETTES = [
  { bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#0ea5e9,#06b6d4)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#10b981,#059669)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#ec4899,#db2777)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#14b8a6,#0891b2)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#a855f7,#6366f1)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#f97316,#ef4444)', text: '#fff' },
];

function avatarPalette(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

const PAGE_SIZE = 9;

@Component({
  selector: 'app-instructor-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DatePipe, TagModule,
    SectionHeroComponent, KpiCardVariantComponent,
    EmptyStateComponent,
    IconComponent, SkeletonBlockComponent,
    CardHoverDirective, BentoGridLayoutDirective,
  ],
  template: `
    <!-- Layout Wrapper: Garantiza alineación vertical y espaciado consistente -->
    <div class="alumnos-shell">

      <!-- ══ HERO ══ -->
      <app-section-hero
        #heroRef
        title="Mis Alumnos"
        subtitle="Gestiona y haz seguimiento a tus alumnos asignados"
        [actions]="heroActions"
      />

      <!-- ══ KPIs BENTO GRID ══
           Usamos bento-grid--four-equal para forzar el layout horizontal
           exacto del dashboard (4 columnas en MD/LG). -->
      <div class="bento-grid bento-grid--four-equal" appBentoGridLayout #bentoGrid>
        <div class="bento-square">
          <app-kpi-card-variant label="Total Alumnos" [value]="facade.kpis().totalAlumnos"
            icon="users" [loading]="facade.isLoading()" />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant label="Activos" [value]="facade.kpis().activos"
            icon="user-check" color="success" [loading]="facade.isLoading()" />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant label="Progreso Promedio" [value]="facade.kpis().promedioProgreso"
            suffix="%" icon="trending-up" [loading]="facade.isLoading()" />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant label="Por Certificar" [value]="facade.kpis().porCertificar"
            icon="award" color="warning" [loading]="facade.isLoading()" />
        </div>
      </div>

      <!-- ══ TOOLS BAR (Search + Filters) ══
           Unificamos buscador y filtros en una sola card premium. -->
      <div class="card overflow-visible">
        <div class="p-4 space-y-4">
          <!-- Premium Search Field -->
          <div class="search-field">
            <app-icon name="search" [size]="18" class="text-text-muted" />
            <input
              type="text"
              class="search-field__input"
              placeholder="Buscar alumno por nombre o RUT..."
              [ngModel]="searchTerm()"
              (ngModelChange)="onSearch($event)"
            />
            @if (searchTerm()) {
              <button class="search-field__clear" (click)="onSearch('')">
                <app-icon name="x" [size]="14" />
              </button>
            }
          </div>

          <!-- Bottom Tools Row -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Filter Pills Row -->
            <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              @for (f of statusFilters; track f.value) {
                <button
                  class="filter-pill"
                  [class.filter-pill--active]="filterStatus() === f.value"
                  (click)="setFilter(f.value)"
                >
                  <span class="filter-pill__dot" [class.filter-pill__dot--active]="filterStatus() === f.value"></span>
                  <span>{{ f.label }}</span>
                  <span class="filter-pill__badge">{{ f.count() }}</span>
                </button>
              }
            </div>

            <!-- Sort Tool -->
            <div class="sort-tool">
              <app-icon name="arrow-up-down" [size]="14" class="text-text-muted" />
              <select
                class="sort-tool__select"
                [ngModel]="sortBy()"
                (ngModelChange)="sortBy.set($event)"
              >
                <option value="name">Nombre A-Z</option>
                <option value="progress">Mayor Progreso</option>
                <option value="nextClass">Próxima Clase</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ STUDENT DIRECTORY ══ -->
      @if (facade.isLoading()) {
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (i of skeletonItems; track i) {
            <div class="card p-6 flex flex-col gap-4">
              <div class="flex items-center gap-4">
                <app-skeleton-block variant="circle" width="48px" height="48px" />
                <div class="flex-1 space-y-2">
                  <app-skeleton-block variant="text" width="60%" />
                  <app-skeleton-block variant="text" width="40%" />
                </div>
              </div>
              <app-skeleton-block variant="rect" height="40px" />
            </div>
          }
        </div>
      } @else if (filteredStudents().length === 0) {
        <app-empty-state
          icon="search"
          message="No se encontraron alumnos"
          subtitle="Refina tus términos de búsqueda o filtros."
          actionLabel="Ver todos"
          (action)="clearFilters()"
        />
      } @else {
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (s of pagedStudents(); track s.studentId) {
            <div
              class="student-card group"
              appCardHover
              (click)="openDetail(s)"
            >
              <!-- Color Accent Gradient -->
              <div class="student-card__accent" [style.background]="getPalette(s.name).bg"></div>
              
              <div class="p-5 flex flex-col gap-4 h-full relative">
                <!-- Card Header -->
                <div class="flex justify-between items-start gap-4">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="avatar-ring" [style.background]="getPalette(s.name).bg">
                      {{ initials(s.name) }}
                    </div>
                    <div class="min-w-0">
                      <h3 class="text-sm font-bold truncate text-text-primary">{{ s.name }}</h3>
                      <p class="text-xs text-text-muted">{{ s.rut }}</p>
                    </div>
                  </div>
                  <p-tag [value]="s.statusLabel" [severity]="$any(s.statusColor)" />
                </div>

                <!-- Course Info -->
                <div class="flex items-center gap-2 text-xs text-text-secondary">
                  <app-icon name="book-open" [size]="14" />
                  <span class="truncate">{{ s.courseName }}</span>
                </div>

                <!-- Progress Section -->
                <div class="space-y-2">
                  <div class="flex justify-between text-xs text-text-muted">
                    <span>Progreso Práctico</span>
                    <span class="font-bold text-text-primary">{{ s.practiceProgress }}/{{ s.totalSessions }}</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" [style.width.%]="s.practicePercent" [style.background]="getPalette(s.name).bg"></div>
                  </div>
                </div>

                <!-- Footer Actions -->
                <div class="pt-4 border-t border-divider mt-auto flex items-center justify-between">
                  <div class="flex items-center gap-2 text-xs text-text-muted">
                    <app-icon name="calendar" [size]="14" />
                    <span>{{ s.nextClassDate ? (s.nextClassDate | date: 'dd MMM, HH:mm') : 'Sin agendar' }}</span>
                  </div>
                  <div class="details-link">
                    <span>Ficha</span>
                    <app-icon name="chevron-right" [size]="14" />
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- ══ PAGINATION ══ -->
        @if (totalPages() > 1) {
          <div class="pagination-footer">
            <div class="pagination-shell">
              <button class="pag-btn" [disabled]="currentPage() === 0" (click)="prevPage()">
                <app-icon name="chevron-left" [size]="16" />
              </button>
              @for (p of pageNumbers(); track p) {
                <button
                  class="pag-btn"
                  [class.pag-btn--active]="p === currentPage()"
                  (click)="currentPage.set(p)"
                >{{ p + 1 }}</button>
              }
              <button class="pag-btn" [disabled]="currentPage() === totalPages() - 1" (click)="nextPage()">
                <app-icon name="chevron-right" [size]="16" />
              </button>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    /* ══ Layout Shell ══ */
    .alumnos-shell {
      padding: var(--space-6);
      max-width: 80rem;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }
    @media (max-width: 640px) { .alumnos-shell { padding: var(--space-4); gap: var(--space-4); } }

    /* ══ Bento Overrides (DASHBOARD SYNC) ══
       Forzamos 4 columnas en desktop usando la clase maestra bento-grid--four-equal. */
    .bento-grid {
      padding: 0 !important; /* El shell ya tiene padding */
    }

    /* ══ Search field premium ══ */
    .search-field {
      display: flex; align-items: center; gap: var(--space-3);
      background: var(--bg-elevated); border: 1.5px solid var(--border-subtle);
      border-radius: var(--radius-md); padding: var(--space-2) var(--space-4);
      transition: all var(--duration-fast) var(--ease-standard);
    }
    .search-field:focus-within {
      background: var(--bg-surface); border-color: var(--color-primary);
      box-shadow: var(--shadow-sm), 0 0 0 3px color-mix(in sRGB, var(--color-primary) 10%, transparent);
    }
    .search-field__input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary);
    }
    .search-field__clear {
      width: 20px; height: 20px; border-radius: var(--radius-full);
      background: var(--bg-subtle); color: var(--text-muted); border: none;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }

    /* ══ Filters & Tools ══ */
    .filter-pill {
      display: inline-flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-4); border-radius: var(--radius-md);
      font-size: var(--text-xs); font-weight: var(--font-semibold);
      background: var(--bg-elevated); border: 1px solid var(--border-subtle);
      color: var(--text-secondary); cursor: pointer; white-space: nowrap; transition: 0.15s;
    }
    .filter-pill--active { background: var(--color-primary); color: #fff; border-color: transparent; }
    .filter-pill__dot { width: 6px; height: 6px; border-radius: var(--radius-full); background: var(--border-subtle); }
    .filter-pill__dot--active { background: #fff; }
    .filter-pill__badge { font-size: var(--text-xs); font-weight: var(--font-bold); opacity: 0.6; }

    .sort-tool {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
      background: var(--bg-elevated); border: 1px solid var(--border-subtle);
    }
    .sort-tool__select {
      background: transparent; border: none; outline: none;
      font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--text-secondary); cursor: pointer;
    }

    /* ══ Student Card ══ */
    .student-card {
      background: var(--bg-surface); border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg); position: relative; overflow: hidden; cursor: pointer;
      transition: all var(--duration-fast) var(--ease-standard); height: 100%;
    }
    .student-card:hover { 
      transform: translateY(-4px); 
      border-color: var(--color-primary); 
      box-shadow: var(--shadow-lg); 
    }
    .student-card__accent { height: 4px; width: 100%; position: absolute; top: 0; left: 0; opacity: 0.8; }
    
    .avatar-ring {
      width: 42px; height: 42px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: var(--text-sm); font-weight: var(--font-bold);
      box-shadow: var(--shadow-sm);
    }

    .progress-track { height: 6px; width: 100%; background: var(--bg-subtle); border-radius: var(--radius-full); overflow: hidden; }
    .progress-fill { height: 100%; transition: width var(--duration-slow) var(--ease-standard); }

    .details-link {
      display: flex; align-items: center; gap: 4px;
      font-size: var(--text-xs); font-weight: var(--font-bold); color: var(--color-primary);
      padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); 
      background: color-mix(in sRGB, var(--color-primary) 8%, transparent);
      opacity: 0.7; transition: 0.2s;
    }
    .group:hover .details-link { opacity: 1; transform: translateX(2px); }

    /* ══ Pagination ══ */
    .pagination-footer { display: flex; justify-content: center; padding-top: var(--space-4); }
    .pagination-shell { display: flex; align-items: center; gap: 4px; background: var(--bg-surface); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); }
    .pag-btn {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-xs); font-weight: var(--font-semibold); 
      background: transparent; color: var(--text-secondary); cursor: pointer; transition: 0.2s;
    }
    .pag-btn:hover:not(:disabled) { background: var(--bg-elevated); color: var(--color-primary); }
    .pag-btn--active { background: var(--color-primary); color: #fff; }
    .pag-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `],
})
export class InstructorAlumnosComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorAlumnosFacade);
  private gsap = inject(GsapAnimationsService);
  private drawer = inject(LayoutDrawerService);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  public searchTerm = signal('');
  public filterStatus = signal<'all' | 'active' | 'completed'>('all');
  public sortBy = signal<'name' | 'progress' | 'nextClass'>('name');
  public currentPage = signal(0);

  readonly skeletonItems = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly heroActions: SectionHeroAction[] = [];

  readonly statusFilters = [
    { value: 'all' as const,       label: 'Todos',       count: () => this.facade.students().length },
    { value: 'active' as const,    label: 'Activos',     count: () => this.facade.kpis().activos },
    { value: 'completed' as const, label: 'Completados', count: () => this.facade.kpis().completados },
  ];

  public filteredStudents = computed(() => {
    let list = this.facade.students() ?? [];
    const term = this.searchTerm().toLowerCase().trim();
    if (term) list = list.filter(s => s.name.toLowerCase().includes(term) || s.rut.toLowerCase().includes(term));
    const status = this.filterStatus();
    if (status !== 'all') list = list.filter(s => s.status === status);
    const sort = this.sortBy();
    if (sort === 'name')      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'progress')  list = [...list].sort((a, b) => b.practicePercent - a.practicePercent);
    if (sort === 'nextClass') list = [...list].sort((a, b) => {
      if (!a.nextClassDate) return 1; if (!b.nextClassDate) return -1;
      return a.nextClassDate.localeCompare(b.nextClassDate);
    });
    return list;
  });

  public totalPages  = computed(() => Math.ceil(this.filteredStudents().length / PAGE_SIZE));
  public pageStart   = computed(() => this.currentPage() * PAGE_SIZE);
  public pageEnd     = computed(() => Math.min(this.pageStart() + PAGE_SIZE, this.filteredStudents().length));
  public pagedStudents = computed(() => this.filteredStudents().slice(this.pageStart(), this.pageEnd()));
  public pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i));

  getPalette = (name: string) => avatarPalette(name);
  initials   = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('');

  onSearch(val: string) { this.searchTerm.set(val); this.currentPage.set(0); }
  setFilter(val: 'all' | 'active' | 'completed') { this.filterStatus.set(val); this.currentPage.set(0); }
  clearFilters() { this.searchTerm.set(''); this.filterStatus.set('all'); this.currentPage.set(0); }
  prevPage() { if (this.currentPage() > 0) this.currentPage.update(p => p - 1); }
  nextPage() { if (this.currentPage() < this.totalPages() - 1) this.currentPage.update(p => p + 1); }

  openDetail(student: InstructorStudentCard) {
    this.facade.setActiveStudent(student);
    this.drawer.open(
      StudentDrawerDetailComponent,
      student.name,
      'user'
    );
  }

  async ngOnInit() { await this.facade.initialize(); }

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      const hero = this.heroRef();
      if (hero) this.gsap.animateHero(hero.nativeElement);
      const grid = this.bentoGrid();
      if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
    });
  }
}
