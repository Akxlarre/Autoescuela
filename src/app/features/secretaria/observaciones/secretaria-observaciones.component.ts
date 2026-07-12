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
import { TaskCreateDrawerComponent } from '@features/tareas/task-create-drawer.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

type ObsTab = 'mis-obs' | 'recibidas' | 'instructores';

@Component({
  selector: 'app-secretaria-observaciones',
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
      <!-- Hero -->
      <app-section-hero
        class="bento-hero"
        title="Comunicación"
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

      <!-- Lista con tabs + densidad adaptativa (spec 0028/0029) -->
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
        emptyIcon="message-circle"
        (activeTabChange)="activeTab.set($any($event))"
        (taskClicked)="openDetail($event)"
      />
    </div>
  `,
})
export class SecretariaObservacionesComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly layoutService = inject(LayoutService);
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

  protected readonly tabs = computed(() => [
    {
      id: 'mis-obs',
      label: 'Mis observaciones',
      count: this.myObservations().filter((t) => t.status !== 'completed').length,
    },
    {
      id: 'recibidas',
      label: 'Tareas recibidas',
      count: this.facade.receivedTasks().filter((t) => t.status !== 'completed').length,
    },
    {
      id: 'instructores',
      label: 'A instructores',
      count: this.toInstructorTasks().length,
    },
  ]);

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
