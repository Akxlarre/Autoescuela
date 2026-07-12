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
import { TaskListContentComponent } from '@shared/components/task-list-content/task-list-content.component';
import { TaskDetailModalComponent } from '@features/tareas/task-detail-modal.component';
import { TaskCreateDrawerComponent } from '@features/tareas/task-create-drawer.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';

type TaskTab = 'sent' | 'received' | 'observations';

@Component({
  selector: 'app-admin-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    TaskListContentComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div #bentoGrid class="bento-grid bento-grid--fill-screen" appBentoGridLayout>
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

      <!-- Lista de tareas con tabs + densidad adaptativa (spec 0028/0029) -->
      <app-task-list-content
        class="bento-banner card p-0 overflow-hidden bento-fill"
        appCardHover
        [tabs]="tabs()"
        [activeTab]="activeTab()"
        [tasks]="activeTasks()"
        [loading]="facade.isLoading()"
        [maxVisible]="maxVisible()"
        emptyMessage="Sin tareas en esta sección"
        emptySubtitle="Las tareas aparecerán aquí cuando sean creadas o asignadas."
        emptyIcon="clipboard-list"
        (activeTabChange)="activeTab.set($any($event))"
        (taskClicked)="openDetail($event)"
      />
    </div>
  `,
})
export class AdminTareasComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutService = inject(LayoutService);
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

  // Densidad adaptativa (spec 0028/0029): sin límite en desktop, acotado
  // en tablet/mobile o con el drawer lateral abierto (tier por contenedor).
  protected readonly maxVisible = computed(() =>
    this.layoutService.tier() === 'desktop' ? null : 5,
  );

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
