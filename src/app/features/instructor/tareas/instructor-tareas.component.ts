import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { TaskListContentComponent } from '@shared/components/task-list-content/task-list-content.component';
import { TaskDetailModalComponent } from '@features/tareas/task-detail-modal.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { TaskType } from '@core/models/ui/task.model';

type TaskTypeFilter = 'all' | TaskType;

interface FilterTab {
  id: TaskTypeFilter;
  label: string;
  count: number;
}

@Component({
  selector: 'app-instructor-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    KpiCardVariantComponent,
    TaskListContentComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen-kpi" appBentoReveal appBentoGridLayout>
      <!-- Hero (sin CTA — instructor es receptor puro en v1) -->
      <app-section-hero
        class="bento-hero"
        title="Comunicación"
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

      <!-- Lista de tareas + densidad adaptativa (spec 0028/0029) -->
      <app-task-list-content
        class="bento-banner card p-0 overflow-hidden bento-fill"
        appCardHover
        [tabs]="filterTabs()"
        [activeTab]="activeFilter()"
        [tasks]="filteredTasks()"
        [loading]="facade.isLoading()"
        [maxVisible]="maxVisible()"
        [emptyMessage]="emptyMessage()"
        [emptySubtitle]="emptySubtitle()"
        emptyIcon="clipboard-list"
        (activeTabChange)="activeFilter.set($any($event))"
        (taskClicked)="openDetail($event)"
      />
    </div>
  `,
})
export class InstructorTareasComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  private readonly layoutService = inject(LayoutService);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly destroyRef = inject(DestroyRef);

  // ── filtro por tipo ──────────────────────────────────────────────────────────
  protected readonly activeFilter = signal<TaskTypeFilter>('all');

  protected readonly filteredTasks = computed(() => {
    const filter = this.activeFilter();
    const tasks = this.facade.receivedTasks();
    return filter === 'all' ? tasks : tasks.filter((t) => t.type === filter);
  });

  protected readonly filterTabs = computed(() => [
    {
      id: 'all',
      label: 'Todas',
      count: this.facade.receivedTasks().filter((t) => t.status !== 'completed').length,
    },
    {
      id: 'task',
      label: 'Tareas',
      count: this.facade
        .receivedTasks()
        .filter((t) => t.type === 'task' && t.status !== 'completed').length,
    },
    {
      id: 'question',
      label: 'Consultas',
      count: this.facade
        .receivedTasks()
        .filter((t) => t.type === 'question' && t.status !== 'completed').length,
    },
    {
      id: 'observation',
      label: 'Observaciones',
      count: this.facade
        .receivedTasks()
        .filter((t) => t.type === 'observation' && t.status !== 'completed').length,
    },
  ]);

  // Computed usado por los tests (spec: filterChips como signal callable)
  protected readonly filterChips = computed(() =>
    this.filterTabs().map((tab) => ({
      value: tab.id,
      label: tab.label,
      count: tab.count,
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

  // Densidad adaptativa (spec 0028/0029): sin límite en desktop, acotado
  // en tablet/mobile o con el drawer lateral abierto (tier por contenedor).
  protected readonly maxVisible = computed(() =>
    this.layoutService.tier() === 'desktop' ? null : 5,
  );

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
