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
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { InstructorStudentCard } from '@core/models/ui/instructor-portal.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    TagModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    EmptyStateComponent,
    DrawerComponent,
    IconComponent,
    CardHoverDirective,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="px-6 py-6 pb-20 max-w-7xl mx-auto space-y-6">
      <!-- HERO -->
      <section class="bento-hero surface-hero rounded-xl" #heroRef>
        <app-section-hero
          title="Mis Alumnos"
          subtitle="Gestiona y haz seguimiento a tus alumnos asignados"
          [actions]="heroActions"
        />
      </section>

      <!-- KPIs -->
      <div class="bento-grid" appBentoGridLayout #bentoGrid>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Total Alumnos"
            [value]="facade.kpis().totalAlumnos"
            icon="users"
            [loading]="facade.isLoading()"
          />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Activos"
            [value]="facade.kpis().activos"
            icon="user-check"
            color="success"
            [loading]="facade.isLoading()"
          />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Progreso Promedio"
            [value]="facade.kpis().promedioProgreso"
            suffix="%"
            icon="trending-up"
            [loading]="facade.isLoading()"
          />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Por Certificar"
            [value]="facade.kpis().porCertificar"
            icon="award"
            color="warning"
            [loading]="facade.isLoading()"
          />
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="relative w-full sm:w-80">
          <app-icon
            name="search"
            [size]="18"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Buscar por nombre o RUT..."
            class="form-control pl-10 w-full"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          @for (f of statusFilters; track f.value) {
            <button
              class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
              [class.bg-brand-primary]="filterStatus() === f.value"
              [class.text-white]="filterStatus() === f.value"
              [class.bg-surface]="filterStatus() !== f.value"
              [class.text-text-muted]="filterStatus() !== f.value"
              (click)="filterStatus.set(f.value)"
            >
              {{ f.label }} ({{ f.count() }})
            </button>
          }
        </div>
      </div>

      <!-- Loading -->
      @if (facade.isLoading()) {
        <div class="flex justify-center p-12">
          <app-icon
            name="loader-2"
            [size]="32"
            style="color: var(--color-primary)"
            class="animate-spin"
          />
        </div>
      } @else if (filteredStudents().length === 0) {
        <app-empty-state
          icon="users"
          message="No se encontraron alumnos"
          subtitle="No hay alumnos que coincidan con tu búsqueda o filtro actual."
        />
      } @else {
        <!-- Student Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (s of filteredStudents(); track s.studentId) {
            <div
              class="card p-5 cursor-pointer transition-colors"
              appCardHover
              (click)="selectedStudent.set(s)"
            >
              <div class="flex items-start gap-3 mb-3">
                <!-- Avatar con iniciales -->
                <div
                  class="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                  style="background: var(--color-primary); color: var(--color-primary-text)"
                >
                  {{ s.name.split(' ').slice(0, 2).map(n => n[0]).join('') }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="font-bold text-text-primary text-base line-clamp-1">{{ s.name }}</h3>
                    <p-tag [value]="s.statusLabel" [severity]="$any(s.statusColor)" />
                  </div>
                  <p class="text-sm text-text-muted">{{ s.rut }}</p>
                </div>
              </div>

              <div class="space-y-3 mt-4">
                <div class="flex items-center gap-2 text-sm text-text-secondary">
                  <app-icon name="book-open" [size]="16" />
                  <span class="truncate">{{ s.courseName }}</span>
                </div>

                <!-- Progress Bar -->
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-text-muted">Progreso Práctico</span>
                    <span class="font-medium text-text-primary"
                      >{{ s.practiceProgress }}/{{ s.totalSessions }}</span
                    >
                  </div>
                  <div class="w-full bg-divider rounded-full h-2">
                    <div
                      class="bg-brand-primary h-2 rounded-full"
                      [style.width.%]="s.practicePercent"
                    ></div>
                  </div>
                </div>

                <div class="pt-3 border-t border-divider flex items-center justify-between text-sm">
                  <span class="text-text-muted">Próxima Clase:</span>
                  <span class="font-medium text-text-primary flex items-center gap-1">
                    <app-icon name="calendar" [size]="14" />
                    {{
                      s.nextClassDate ? (s.nextClassDate | date: 'dd MMM, HH:mm') : 'No agendada'
                    }}
                  </span>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Detail Drawer -->
    @if (selectedStudent(); as detail) {
      <app-drawer
        [isOpen]="drawerOpen()"
        [title]="detail.name"
        icon="user"
        (closed)="selectedStudent.set(null)"
      >
        <div class="space-y-6 p-6">
          <!-- Estado -->
          <div class="flex items-center gap-3">
            <p-tag [value]="detail.statusLabel" [severity]="$any(detail.statusColor)" />
            <span class="text-sm text-text-muted">{{ detail.rut }}</span>
          </div>

          <!-- Contacto -->
          <div class="space-y-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-text-muted">Contacto</h3>
            @if (detail.phone) {
              <a
                [href]="'tel:' + detail.phone"
                class="flex items-center gap-3 text-sm text-text-primary hover:text-brand-primary p-2 -mx-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <app-icon name="phone" [size]="16" class="text-text-muted" />
                {{ detail.phone }}
              </a>
            }
            @if (detail.email) {
              <a
                [href]="'mailto:' + detail.email"
                class="flex items-center gap-3 text-sm text-text-primary hover:text-brand-primary p-2 -mx-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <app-icon name="mail" [size]="16" class="text-text-muted" />
                <span class="break-all">{{ detail.email }}</span>
              </a>
            }
          </div>

          <!-- Curso -->
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
              Información del Curso
            </h3>
            <div class="bg-surface-hover p-4 rounded-lg space-y-3">
              <div>
                <span class="block text-xs text-text-muted">Curso</span>
                <span class="block text-sm font-medium text-text-primary">{{
                  detail.courseName
                }}</span>
              </div>
              <div class="pt-3 border-t border-divider">
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-text-muted"
                    >Práctica ({{ detail.practiceProgress }}/{{ detail.totalSessions }})</span
                  >
                  <span class="font-medium text-text-primary">{{ detail.practicePercent }}%</span>
                </div>
                <div class="w-full bg-divider rounded-full h-1.5">
                  <div
                    class="bg-brand-primary h-1.5 rounded-full"
                    [style.width.%]="detail.practicePercent"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- CTA -->
          <a
            [routerLink]="['/app/instructor/alumnos', detail.studentId, 'ficha']"
            class="btn btn-primary w-full justify-center"
            data-llm-action="view-student-ficha"
          >
            <app-icon name="file-text" [size]="18" />
            Ver Ficha Técnica Completa
          </a>
        </div>
      </app-drawer>
    }
  `,
})
export class InstructorAlumnosComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorAlumnosFacade);
  private gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  public searchTerm = signal('');
  public filterStatus = signal<'all' | 'active' | 'completed'>('all');
  public selectedStudent = signal<InstructorStudentCard | null>(null);
  public drawerOpen = computed(() => !!this.selectedStudent());

  readonly heroActions: SectionHeroAction[] = [];

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
    if (term) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(term) || s.rut.toLowerCase().includes(term),
      );
    }
    const status = this.filterStatus();
    if (status !== 'all') {
      list = list.filter((s) => s.status === status);
    }
    return list;
  });

  async ngOnInit() {
    await this.facade.initialize();
  }

  ngAfterViewInit() {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
