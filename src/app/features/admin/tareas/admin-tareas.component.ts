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
import { TaskCardComponent } from '@shared/components/task-card/task-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TaskDetailModalComponent } from '@features/tareas/task-detail-modal.component';
import { TaskCreateDrawerComponent } from '@features/tareas/task-create-drawer.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { ScrollContainerDirective } from '@core/directives/scroll-container.directive';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';

import { TabsComponent } from '@shared/components/tabs/tabs.component';

type TaskTab = 'sent' | 'received' | 'observations';

@Component({
  selector: 'app-admin-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    TaskCardComponent,
    EmptyStateComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    TabsComponent,
    ScrollContainerDirective,
  ],
  template: `
    <div 
      #bentoGrid 
      class="bento-grid bento-grid--fill-screen" 
      appBentoGridLayout
    >
      <!-- Hero -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Comunicación"
        contextLine="Coordinación operativa del equipo"
        icon="message-circle"
        [actions]="heroActions"
        [kpis]="heroKpis()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- Lista de tareas con tabs -->
      <div class="bento-banner card p-0 overflow-hidden flex flex-col" appCardHover>
        <!-- Tabs -->
        <div class="shrink-0">
          <app-tabs
          [tabs]="tabs()"
          [activeId]="activeTab()"
          variant="line"
          (activeIdChange)="activeTab.set($any($event))"
        />

        </div>

        <!-- Contenido del tab activo -->
        <div 
          class="p-4 flex flex-col gap-3 flex-1" 
          [class.justify-center]="!facade.isLoading() && activeTasks().length === 0"
          appScrollContainer 
          maxHeight="none" 
          [scrollX]="false"
        >
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

  protected readonly tabs = computed(() => [
    {
      id: 'sent',
      label: 'Asignadas por mí',
      count: this.facade.sentTasks().filter((t) => t.status !== 'completed').length,
    },
    {
      id: 'received',
      label: 'Dirigidas a mí',
      count: this.facade.receivedTasks().filter((t) => t.status !== 'completed').length,
    },
    {
      id: 'observations',
      label: 'Observaciones',
      count: this.facade.observationTasks().filter((t) => t.status !== 'completed').length,
    },
  ]);

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

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'pendientes',
      label: 'Pendientes',
      value: this.facade.pendingCount(),
      icon: 'clock',
      color: 'warning',
    },
    {
      id: 'vencidas',
      label: 'Vencidas',
      value: this.facade.overdueCount(),
      icon: 'alert-triangle',
      color: 'error',
    },
    { id: 'asignadas', label: 'Asignadas', value: this.facade.sentTasks().length, icon: 'send' },
    {
      id: 'recibidas',
      label: 'Recibidas',
      value: this.facade.receivedTasks().length,
      icon: 'inbox',
    },
  ]);

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
    canDelete: false,
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
    this.drawer.open(TaskDetailModalComponent, title, 'clipboard-list');
  }
}
