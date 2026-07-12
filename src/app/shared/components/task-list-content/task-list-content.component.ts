import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';
import { TaskCardComponent } from '@shared/components/task-card/task-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { sliceByBudget, visibleWithLoadMore } from '@core/utils/layout-tier.utils';
import type { TaskRow } from '@core/models/ui/task.model';

const DEFAULT_DESKTOP_SKELETON_COUNT = 3;

const DUMMY_TASK: TaskRow = {
  id: '',
  branch_id: 0,
  from_user_id: 0,
  from_role: 'admin',
  to_user_id: 0,
  to_role: 'admin',
  type: 'task',
  subject: '',
  body: null,
  status: 'pending',
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

/**
 * Tabs + lista de tareas/mensajes + densidad adaptativa (spec 0029).
 * Compartido por AdminTareas / SecretariaObservaciones / InstructorTareas
 * para evitar que las 3 implementaciones sigan divergiendo.
 *
 * El presupuesto de densidad (`maxVisible`) llega YA resuelto por input —
 * este componente NO inyecta LayoutService ni Facades (regla Dumb estricta,
 * mismo patrón que `maxItems` en live-classes-panel, spec 0028).
 */
@Component({
  selector: 'app-task-list-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabsComponent, TaskCardComponent, EmptyStateComponent],
  host: {
    class: 'flex flex-col h-full overflow-hidden',
  },
  template: `
    <div class="shrink-0">
      <app-tabs
        [tabs]="tabs()"
        [activeId]="activeTab()"
        variant="line"
        (activeIdChange)="onTabChange($event)"
      />
    </div>

    <div
      class="p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar"
      [class.justify-center]="!loading() && tasks().length === 0"
    >
      @if (loading()) {
        @for (i of skeletonIndexes(); track i) {
          <app-task-card [task]="dummyTask" [loading]="true" />
        }
      } @else if (tasks().length === 0) {
        <app-empty-state
          [message]="emptyMessage()"
          [subtitle]="emptySubtitle()"
          [icon]="emptyIcon()"
        />
      } @else {
        @for (task of visibleTasks(); track task.id) {
          <app-task-card [task]="task" (cardClicked)="onCardClicked($event)" />
        }
        @if (remainingCount() > 0) {
          <button
            type="button"
            class="btn-ghost w-full flex items-center justify-center font-medium transition-colors cursor-pointer"
            (click)="loadMore()"
            data-llm-action="load-more-tasks"
          >
            Cargar más ({{ remainingCount() }} restantes)
          </button>
        }
      }
    </div>
  `,
  styles: [
    `
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: var(--border-subtle);
        border-radius: 4px;
      }
      .custom-scrollbar:hover::-webkit-scrollbar-thumb {
        background-color: var(--text-muted);
      }
    `,
  ],
})
export class TaskListContentComponent {
  readonly tabs = input.required<TabOption[]>();
  readonly activeTab = input.required<string>();
  readonly tasks = input<TaskRow[]>([]);
  readonly loading = input(false);
  /** Presupuesto de densidad (spec 0028/0029): null = sin límite (desktop). */
  readonly maxVisible = input<number | null>(null);
  readonly emptyMessage = input('Sin tareas');
  readonly emptySubtitle = input('');
  readonly emptyIcon = input('clipboard-list');

  readonly activeTabChange = output<string>();
  readonly taskClicked = output<string>();

  protected readonly dummyTask = DUMMY_TASK;

  // Densidad "Cargar más": se guarda a qué tab pertenecen los clicks para
  // ignorarlos (== reset puramente derivado, sin efecto imperativo) apenas
  // el usuario cambia de tab. Evita leer un input required() en un effect()
  // del constructor (NG0950) y no se dispara por refresh silencioso (SWR),
  // que no toca `activeTab`.
  private readonly loadMoreClicks = signal(0);
  private readonly loadMoreTab = signal<string | null>(null);

  readonly visibleTasks = computed(() =>
    visibleWithLoadMore(this.tasks(), this.maxVisible(), this.activeTab(), {
      forTab: this.loadMoreTab(),
      clicks: this.loadMoreClicks(),
    }),
  );

  readonly remainingCount = computed(() =>
    Math.max(0, this.tasks().length - this.visibleTasks().length),
  );

  readonly skeletonIndexes = computed(() => {
    const count = this.maxVisible() ?? DEFAULT_DESKTOP_SKELETON_COUNT;
    return Array.from({ length: count }, (_, i) => i);
  });

  readonly skeletonCount = computed(() => this.skeletonIndexes().length);

  onTabChange(tabId: string): void {
    this.activeTabChange.emit(tabId);
  }

  onCardClicked(taskId: string): void {
    this.taskClicked.emit(taskId);
  }

  loadMore(): void {
    const tab = this.activeTab();
    if (this.loadMoreTab() !== tab) {
      this.loadMoreTab.set(tab);
      this.loadMoreClicks.set(1);
    } else {
      this.loadMoreClicks.update((n) => n + 1);
    }
  }
}
