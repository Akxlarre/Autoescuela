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
import { TaskCreateDrawerComponent } from '@features/tareas/task-create-drawer.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

type ObsTab = 'mis-obs' | 'recibidas' | 'instructores';

@Component({
  selector: 'app-secretaria-observaciones',
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
      <!-- Hero -->
      <app-section-hero
        class="bento-hero"
        title="Observaciones"
        contextLine="Comunicación operativa con el equipo"
        icon="message-circle"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- KPI -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Mis pendientes"
          [value]="pendingMineCount()"
          [loading]="facade.isLoading()"
          icon="clock"
          color="warning"
          [accent]="true"
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
      <div class="bento-square">
        <app-kpi-card-variant
          label="A instructores"
          [value]="toInstructorTasks().length"
          [loading]="facade.isLoading()"
          icon="users"
        />
      </div>

      <!-- Lista con tabs -->
      <div class="bento-banner card p-0 overflow-hidden">
        <!-- Tabs -->
        <div
          class="flex border-b border-border-default"
          role="tablist"
          aria-label="Filtros de observaciones"
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
                  class="ml-1.5 inline-flex items-center justify-center rounded-full text-xs w-5 h-5 bg-subtle text-text-muted"
                >
                  {{ tab.count() }}
                </span>
              }
            </button>
          }
        </div>

        <!-- Contenido -->
        <div class="p-4 flex flex-col gap-3">
          @if (facade.isLoading()) {
            @for (sk of skeletons; track sk) {
              <app-task-card [task]="dummyTask" [loading]="true" />
            }
          } @else if (activeTasks().length === 0) {
            <app-empty-state
              message="Sin tareas en esta sección"
              subtitle="Las tareas aparecerán aquí cuando sean creadas o asignadas."
              icon="message-circle"
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
export class SecretariaObservacionesComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly activeTab = signal<ObsTab>('mis-obs');

  private readonly currentDbId = computed(() => this.authFacade.currentUser()?.dbId);

  protected readonly myObservations = computed(() =>
    this.facade.sentTasks().filter((t) => t.type === 'observation'),
  );

  protected readonly toInstructorTasks = computed(() =>
    this.facade.sentTasks().filter((t) => t.to_role === 'instructor' && t.status !== 'completed'),
  );

  protected readonly pendingMineCount = computed(
    () => this.facade.receivedTasks().filter((t) => t.status !== 'completed').length,
  );

  protected readonly tabs = [
    {
      id: 'mis-obs' as ObsTab,
      label: 'Mis observaciones',
      count: computed(() => this.myObservations().filter((t) => t.status !== 'completed').length),
    },
    {
      id: 'recibidas' as ObsTab,
      label: 'Tareas recibidas',
      count: computed(
        () => this.facade.receivedTasks().filter((t) => t.status !== 'completed').length,
      ),
    },
    {
      id: 'instructores' as ObsTab,
      label: 'A instructores',
      count: computed(() => this.toInstructorTasks().length),
    },
  ];

  protected readonly activeTasks = computed(() => {
    switch (this.activeTab()) {
      case 'mis-obs':
        return this.myObservations();
      case 'recibidas':
        return this.facade.receivedTasks();
      case 'instructores':
        return this.toInstructorTasks();
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

  protected readonly dummyTask = {
    id: '',
    branch_id: 0,
    from_user_id: 0,
    from_role: 'secretary' as const,
    to_user_id: 0,
    to_role: 'admin' as const,
    type: 'observation' as const,
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
