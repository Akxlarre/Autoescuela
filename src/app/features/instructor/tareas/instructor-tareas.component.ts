import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { TaskCardComponent } from '@shared/components/task-card/task-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TaskDetailModalComponent } from '@features/tareas/task-detail-modal.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import type { TaskType } from '@core/models/ui/task.model';

type TaskTypeFilter = 'all' | TaskType;

interface FilterTab {
  id: TaskTypeFilter;
  label: string;
  count: () => number;
}

@Component({
  selector: 'app-instructor-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    KpiCardVariantComponent,
    TaskCardComponent,
    EmptyStateComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
  ],
  template: `
    <div class="bento-grid" appBentoReveal appBentoGridLayout>
      <!-- Hero (sin CTA — instructor es receptor puro en v1) -->
      <app-section-hero
        class="bento-hero"
        title="Tareas Recibidas"
        contextLine="Tareas y consultas asignadas por secretaría"
        icon="message-circle"
        [actions]="[]"
      />

      <!-- KPIs -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Pendientes"
          [value]="facade.pendingCount()"
          [loading]="facade.isLoading()"
          icon="clock"
          color="warning"
          [accent]="true"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="En progreso"
          [value]="inProgressCount()"
          [loading]="facade.isLoading()"
          icon="activity"
        />
      </div>

      <!-- Lista de tareas -->
      <div class="bento-banner card p-0 overflow-hidden">
        <!-- Tabs -->
        <div
          class="flex border-b border-border-default"
          role="tablist"
          aria-label="Filtros de tareas"
        >
          @for (tab of filterTabs; track tab.id) {
            <button
              role="tab"
              class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
              [class.border-b-2]="activeFilter() === tab.id"
              [style.border-color]="activeFilter() === tab.id ? 'var(--ds-brand)' : 'transparent'"
              [style.color]="activeFilter() === tab.id ? 'var(--ds-brand)' : 'var(--text-muted)'"
              [attr.aria-selected]="activeFilter() === tab.id"
              (click)="activeFilter.set(tab.id)"
            >
              {{ tab.label }}
              @if (tab.count() > 0) {
                <span
                  class="ml-1.5 inline-flex items-center justify-center rounded-full text-xs w-5 h-5 bg-subtle text-text-muted"
                >
                  {{ tab.count() }}
                </span>
              }
            </button>
          }
        </div>

        <!-- Contenido del tab activo -->
        <div class="p-4 flex flex-col gap-3">
          @if (facade.isLoading()) {
            @for (sk of skeletons; track sk) {
              <app-task-card [task]="dummyTask" [loading]="true" />
            }
          } @else if (filteredTasks().length === 0) {
            <app-empty-state
              [message]="emptyMessage()"
              [subtitle]="emptySubtitle()"
              icon="clipboard-list"
            />
          } @else {
            @for (task of filteredTasks(); track task.id) {
              <app-task-card [task]="task" (cardClicked)="openDetail($event)" />
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class InstructorTareasComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly skeletons = [1, 2, 3];

  // ── filtro por tipo ──────────────────────────────────────────────────────────
  protected readonly activeFilter = signal<TaskTypeFilter>('all');

  protected readonly filteredTasks = computed(() => {
    const filter = this.activeFilter();
    const tasks = this.facade.receivedTasks();
    return filter === 'all' ? tasks : tasks.filter((t) => t.type === filter);
  });

  protected readonly filterTabs: FilterTab[] = [
    {
      id: 'all',
      label: 'Todas',
      count: computed(
        () => this.facade.receivedTasks().filter((t) => t.status !== 'completed').length,
      ),
    },
    {
      id: 'task',
      label: 'Tareas',
      count: computed(
        () =>
          this.facade.receivedTasks().filter((t) => t.type === 'task' && t.status !== 'completed')
            .length,
      ),
    },
    {
      id: 'question',
      label: 'Consultas',
      count: computed(
        () =>
          this.facade
            .receivedTasks()
            .filter((t) => t.type === 'question' && t.status !== 'completed').length,
      ),
    },
    {
      id: 'observation',
      label: 'Observaciones',
      count: computed(
        () =>
          this.facade
            .receivedTasks()
            .filter((t) => t.type === 'observation' && t.status !== 'completed').length,
      ),
    },
  ];

  // Computed usado por los tests (spec: filterChips como signal callable)
  protected readonly filterChips = computed(() =>
    this.filterTabs.map((tab) => ({
      value: tab.id,
      label: tab.label,
      count: tab.count(),
    })),
  );

  protected readonly inProgressCount = computed(
    () => this.facade.receivedTasks().filter((t) => t.status === 'in_progress').length,
  );

  // ── empty state contextual ───────────────────────────────────────────────────
  protected readonly emptyMessage = computed(() => {
    switch (this.activeFilter()) {
      case 'task':
        return 'Sin tareas pendientes';
      case 'question':
        return 'Sin consultas pendientes';
      case 'observation':
        return 'Sin observaciones';
      default:
        return 'Sin tareas asignadas';
    }
  });

  protected readonly emptySubtitle = computed(() => {
    switch (this.activeFilter()) {
      case 'task':
        return 'Cuando secretaría te asigne una tarea, aparecerá aquí.';
      case 'question':
        return 'Cuando secretaría te haga una consulta, aparecerá aquí.';
      case 'observation':
        return 'Cuando secretaría registre una observación para ti, aparecerá aquí.';
      default:
        return 'Cuando secretaría te asigne tareas o consultas, aparecerán aquí.';
    }
  });

  protected readonly dummyTask = {
    id: '',
    branch_id: 0,
    from_user_id: 0,
    from_role: 'secretary' as const,
    to_user_id: 0,
    to_role: 'instructor' as const,
    type: 'task' as const,
    subject: '',
    body: null,
    status: 'pending' as const,
    due_date: null,
    completed_at: null,
    seen_at: null,
    seen_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    senderName: '',
    recipientName: '',
    replyCount: 0,
    isOverdue: false,
    ageInDays: 0,
    recipientInactive: false,
    canEdit: false,
    canChangeStatus: false,
    canDelete: false,
  };

  ngOnInit(): void {
    void this.facade.initialize();
    this.destroyRef.onDestroy(() => this.facade.dispose());
  }

  ngAfterViewInit(): void {}

  protected openDetail(taskId: string): void {
    this.facade.selectTask(taskId);
    const task = this.facade.selectedTask();
    const title = task?.subject ?? 'Detalle';
    this.drawer.push(TaskDetailModalComponent, title, 'clipboard-list');
  }
}
