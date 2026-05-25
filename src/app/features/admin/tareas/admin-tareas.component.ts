import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { TaskCardComponent } from '@shared/components/task-card/task-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TaskDetailModalComponent } from '@features/tareas/task-detail-modal.component';
import { TaskCreateDrawerComponent } from '@features/tareas/task-create-drawer.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

type TaskTab = 'sent' | 'received' | 'observations';

@Component({
  selector: 'app-admin-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    KpiCardVariantComponent,
    TaskCardComponent,
    EmptyStateComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div #bentoGrid class="bento-grid" appBentoGridLayout>
      <!-- Hero -->
      <app-section-hero
        class="bento-hero"
        title="Comunicación"
        contextLine="Coordinación operativa del equipo"
        icon="message-circle"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
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
          label="Vencidas"
          [value]="facade.overdueCount()"
          [loading]="facade.isLoading()"
          icon="alert-triangle"
          color="error"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Asignadas"
          [value]="facade.sentTasks().length"
          [loading]="facade.isLoading()"
          icon="send"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Recibidas"
          [value]="facade.receivedTasks().length"
          [loading]="facade.isLoading()"
          icon="inbox"
        />
      </div>

      <!-- Lista de tareas con tabs -->
      <div class="bento-banner card p-0 overflow-hidden">
        <!-- Tabs -->
        <div
          class="flex border-b"
          style="border-color: var(--border-default)"
          role="tablist"
          aria-label="Filtros de tareas"
        >
          @for (tab of tabs; track tab.id) {
            <button
              role="tab"
              class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
              [class.border-b-2]="activeTab() === tab.id"
              [style.border-color]="activeTab() === tab.id ? 'var(--ds-brand)' : 'transparent'"
              [style.color]="activeTab() === tab.id ? 'var(--ds-brand)' : 'var(--text-muted)'"
              [attr.aria-selected]="activeTab() === tab.id"
              (click)="activeTab.set(tab.id)"
            >
              {{ tab.label }}
              @if (tab.count() > 0) {
                <span
                  class="ml-1.5 inline-flex items-center justify-center rounded-full text-xs w-5 h-5"
                  style="background: var(--bg-subtle); color: var(--text-muted)"
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
          } @else if (activeTasks().length === 0) {
            <app-empty-state
              message="Sin tareas en esta sección"
              subtitle="Las tareas aparecerán aquí cuando sean creadas o asignadas."
              icon="clipboard-list"
            />
          } @else {
            @for (task of activeTasks(); track task.id) {
              <app-task-card [task]="task" (cardClicked)="openDetail($event)" />
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class AdminTareasComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly activeTab = signal<TaskTab>('sent');

  protected readonly tabs = [
    {
      id: 'sent' as TaskTab,
      label: 'Asignadas por mí',
      count: computed(() => this.facade.sentTasks().filter((t) => t.status !== 'completed').length),
    },
    {
      id: 'received' as TaskTab,
      label: 'Dirigidas a mí',
      count: computed(
        () => this.facade.receivedTasks().filter((t) => t.status !== 'completed').length,
      ),
    },
    {
      id: 'observations' as TaskTab,
      label: 'Observaciones',
      count: computed(
        () => this.facade.observationTasks().filter((t) => t.status !== 'completed').length,
      ),
    },
  ];

  protected readonly activeTasks = computed(() => {
    switch (this.activeTab()) {
      case 'sent':
        return this.facade.sentTasks();
      case 'received':
        return this.facade.receivedTasks();
      case 'observations':
        return this.facade.observationTasks();
    }
  });

  protected readonly heroActions: SectionHeroAction[] = [
    {
      id: 'nueva-comunicacion',
      label: 'Nueva comunicación',
      icon: 'message-circle',
      primary: true,
    },
  ];

  protected readonly skeletons = [1, 2, 3];

  // Placeholder task used only when loading=true (skeleton mode)
  protected readonly dummyTask = {
    id: '',
    branch_id: 0,
    from_user_id: 0,
    from_role: 'admin' as const,
    to_user_id: 0,
    to_role: 'admin' as const,
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
  };

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.facade.dispose());
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  protected onHeroAction(id: string): void {
    if (id === 'nueva-comunicacion') {
      this.drawer.open(TaskCreateDrawerComponent, 'Nueva comunicación', 'message-circle');
    }
  }

  protected openDetail(taskId: string): void {
    this.facade.selectTask(taskId);
    const task = this.facade.selectedTask();
    const title = task?.subject ?? 'Detalle';
    this.drawer.push(TaskDetailModalComponent, title, 'clipboard-list');
  }
}
