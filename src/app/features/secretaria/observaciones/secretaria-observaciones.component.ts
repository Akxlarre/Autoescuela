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
import { TaskListContentComponent } from '@shared/components/task-list-content/task-list-content.component';
import { AnnouncementsContentComponent } from '@shared/components/announcements-content/announcements-content.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { TabsComponent } from '@shared/components/tabs/tabs.component';
import { TaskDetailModalComponent } from '@features/tareas/task-detail-modal.component';
import { TaskCreateDrawerComponent } from '@features/tareas/task-create-drawer.component';
import { AnnouncementComposerDrawerComponent } from '@features/comunicados/announcement-composer-drawer.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { AnnouncementsFacade } from '@core/facades/announcements.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { sentNonObservations, isTaskOpen } from '@core/utils/task.utils';

type ObsTab = 'mis-obs' | 'recibidas' | 'enviadas';

/** Audiencia del canal: el equipo interno (tareas) o los alumnos (comunicados). */
type Canal = 'tareas' | 'comunicados';

@Component({
  selector: 'app-secretaria-observaciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    TaskListContentComponent,
    AnnouncementsContentComponent,
    EmptyStateComponent,
    AlertCardComponent,
    IconComponent,
    TabsComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div
      #bentoGrid
      class="bento-grid bento-grid--fill-screen-kpi bento-grid--rows-fit"
      appBentoGridLayout
    >
      <!-- Hero -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Comunicación"
        contextLine="Comunicación operativa con el equipo"
        icon="message-circle"
        [actions]="heroActions"
        [kpis]="heroKpis()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- Audiencia: equipo interno (tareas) vs alumnos (comunicados, spec 0041-b).
           Son dos canales distintos, no dos filtros del mismo. -->
      <app-tabs
        class="bento-banner"
        [tabs]="canalTabs()"
        [activeId]="canal()"
        (activeIdChange)="onCanalChange($event)"
      />

      @if (canal() === 'tareas') {
        @if (facade.error() && facade.tasks().length === 0) {
          <div class="bento-banner card p-6 flex-1 flex items-center justify-center bento-fill">
            <app-empty-state
              icon="alert-triangle"
              [message]="facade.error()!"
              subtitle="Revisa tu conexión e inténtalo de nuevo."
              actionLabel="Reintentar"
              actionIcon="refresh-cw"
              (action)="facade.reintentar()"
            />
          </div>
        } @else {
          <div
            class="bento-banner card p-0 overflow-hidden bento-fill flex flex-col min-h-0"
            appCardHover
          >
            <!-- Caso B: Aviso de refresco fallido -->
            @if (facade.refreshFailed()) {
              <div class="p-4 pb-0 shrink-0" role="alert">
                <app-alert-card severity="error" title="No se pudieron actualizar las tareas">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span class="text-compact text-text-secondary">
                      Los datos mostrados pueden no estar actualizados.
                    </span>
                    <button
                      type="button"
                      class="btn-secondary flex items-center gap-2 shrink-0"
                      data-llm-action="reintentar-tareas"
                      [disabled]="facade.isLoading()"
                      (click)="facade.reintentar()"
                    >
                      <app-icon name="refresh-cw" [size]="14" />
                      Reintentar
                    </button>
                  </div>
                </app-alert-card>
              </div>
            }

            <!-- Lista con tabs + densidad adaptativa (spec 0028/0029) -->
            <app-task-list-content
              class="flex-1 min-h-0 h-auto!"
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
        }
      } @else {
        <app-announcements-content
          class="bento-banner card p-0 overflow-hidden bento-fill"
          appCardHover
          [announcements]="announcements.announcements()"
          [loading]="announcements.isLoading()"
          (cancelRequested)="onCancelarComunicado($event)"
        />
      }
    </div>
  `,
})
export class SecretariaObservacionesComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  protected readonly announcements = inject(AnnouncementsFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly authFacade = inject(AuthFacade);
  private readonly layoutService = inject(LayoutService);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly activeTab = signal<ObsTab>('mis-obs');
  protected readonly canal = signal<Canal>('tareas');

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  private readonly currentDbId = computed(() => this.authFacade.currentUser()?.dbId);

  protected readonly myObservations = computed(() =>
    this.facade.sentTasks().filter((t) => t.type === 'observation'),
  );

  /** hotfix-102-b (S23): todo lo enviado que no es observación — al admin y a instructores. */
  protected readonly sentTasks = computed(() => sentNonObservations(this.facade.sentTasks()));

  protected readonly pendingMineCount = computed(
    () => this.facade.receivedTasks().filter((t) => isTaskOpen(t.status)).length,
  );

  protected readonly tabs = computed(() => [
    {
      id: 'mis-obs',
      label: 'Mis observaciones',
      count: this.myObservations().filter((t) => isTaskOpen(t.status)).length,
    },
    {
      id: 'recibidas',
      label: 'Tareas recibidas',
      count: this.facade.receivedTasks().filter((t) => isTaskOpen(t.status)).length,
    },
    {
      id: 'enviadas',
      label: 'Enviadas',
      count: this.sentTasks().filter((t) => isTaskOpen(t.status)).length,
    },
  ]);

  protected readonly activeTasks = computed(() => {
    switch (this.activeTab()) {
      case 'mis-obs':
        return this.myObservations();
      case 'recibidas':
        return this.facade.receivedTasks();
      case 'enviadas':
        return this.sentTasks();
    }
  });

  protected readonly heroActions: SectionHeroAction[] = [
    {
      id: 'nueva-comunicacion',
      label: 'Nueva comunicación',
      icon: 'message-circle',
      primary: true,
    },
    {
      id: 'nuevo-comunicado',
      label: 'Nuevo comunicado',
      icon: 'megaphone',
      primary: false,
    },
  ];

  protected readonly canalTabs = computed(() => [
    { id: 'tareas', label: 'Tareas del equipo', count: this.pendingMineCount() },
    { id: 'comunicados', label: 'Comunicados a alumnos', count: null },
  ]);

  protected readonly heroKpis = computed((): SectionHeroKpi[] => {
    if (this.canal() === 'tareas' && this.facade.error() && this.facade.tasks().length === 0) {
      return [];
    }
    return [
      {
        id: 'mis-pendientes',
        label: 'Mis pendientes',
        value: this.pendingMineCount(),
        icon: 'clock',
        color: 'warning',
      },
      {
        id: 'recibidas',
        label: 'Recibidas',
        value: this.facade.receivedTasks().length,
        icon: 'inbox',
      },
      {
        id: 'enviadas',
        label: 'Enviadas',
        value: this.sentTasks().filter((t) => isTaskOpen(t.status)).length,
        icon: 'send',
      },
    ];
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

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  protected async onCancelarComunicado(announcementId: number): Promise<void> {
    const confirmado = await this.confirmModal.confirm({
      title: 'Cancelar comunicado',
      message: 'No se va a enviar. Queda registrado como cancelado.',
      confirmLabel: 'Cancelar envío',
      cancelLabel: 'Volver',
      severity: 'danger',
    });
    if (confirmado) await this.announcements.cancelScheduled(announcementId);
  }

  protected onCanalChange(canal: string): void {
    this.canal.set(canal as Canal);
    // El historial se carga recién al abrir la pestaña: la mayoría de las visitas a
    // Comunicación son por tareas del equipo.
    if (canal === 'comunicados') void this.announcements.initialize();
  }

  protected onHeroAction(id: string): void {
    if (id === 'nueva-comunicacion') {
      this.drawer.open(TaskCreateDrawerComponent, 'Nueva comunicación', 'message-circle');
    }
    if (id === 'nuevo-comunicado') {
      this.drawer.open(AnnouncementComposerDrawerComponent, 'Nuevo comunicado', 'megaphone');
    }
  }

  protected openDetail(taskId: string): void {
    this.facade.selectTask(taskId);
    const task = this.facade.selectedTask();
    const title = task?.subject ?? 'Detalle';
    this.drawer.push(TaskDetailModalComponent, title, 'clipboard-list');
  }
}
