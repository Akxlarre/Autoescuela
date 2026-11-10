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
  untracked,
  viewChild,
} from '@angular/core';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { TaskListContentComponent } from '@shared/components/task-list-content/task-list-content.component';
import { AnnouncementsContentComponent } from '@shared/components/announcements-content/announcements-content.component';
import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TaskDetailModalComponent } from '@features/tareas/task-detail-modal.component';
import { TaskCreateDrawerComponent } from '@features/tareas/task-create-drawer.component';
import { AnnouncementComposerDrawerComponent } from '@features/comunicados/announcement-composer-drawer.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { AnnouncementsFacade } from '@core/facades/announcements.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { isTaskOpen } from '@core/utils/task.utils';

type TaskTab = 'sent' | 'received' | 'observations';

/** Audiencia del canal: el equipo interno (tareas) o los alumnos (comunicados). */
type Canal = 'tareas' | 'comunicados';

@Component({
  selector: 'app-admin-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    TaskListContentComponent,
    AnnouncementsContentComponent,
    TabsComponent,
    AlertCardComponent,
    EmptyStateComponent,
    IconComponent,
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
        [loading]="canal() === 'comunicados' ? announcements.isLoading() : facade.isLoading()"
        title="Comunicación"
        [contextLine]="heroContextLine()"
        icon="message-circle"
        [actions]="heroActions()"
        [kpis]="heroKpis()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- Audiencia: equipo interno (tareas) vs alumnos (comunicados, spec 0041-b).
           Son dos canales distintos, no dos filtros del mismo. -->
      <app-tabs
        class="bento-banner"
        variant="segmented"
        [tabs]="canalTabs()"
        [activeId]="canal()"
        (activeIdChange)="onCanalChange($event)"
      />

      <!-- Caso B: Aviso de refresco fallido -->
      @if (canal() === 'tareas' && facade.refreshFailed()) {
        <div class="bento-banner" role="alert">
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
export class AdminTareasComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(TasksFacade);
  protected readonly announcements = inject(AnnouncementsFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutService = inject(LayoutService);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly activeTab = signal<TaskTab>('sent');
  protected readonly canal = signal<Canal>('comunicados');

  protected readonly tabs = computed(() => [
    {
      id: 'sent',
      label: 'Asignadas por mí',
      count: this.facade.sentTasks().filter((t) => isTaskOpen(t.status)).length,
    },
    {
      id: 'received',
      label: 'Dirigidas a mí',
      count: this.facade.receivedTasks().filter((t) => isTaskOpen(t.status)).length,
    },
    {
      id: 'observations',
      label: 'Observaciones',
      count: this.facade.observationTasks().filter((t) => isTaskOpen(t.status)).length,
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

  protected readonly heroContextLine = computed(() =>
    this.canal() === 'comunicados'
      ? 'Avisos y difusión masiva a los alumnos'
      : 'Coordinación operativa del equipo',
  );

  protected readonly heroActions = computed((): SectionHeroAction[] => {
    if (this.canal() === 'comunicados') {
      return [
        {
          id: 'nuevo-comunicado',
          label: 'Nuevo comunicado',
          icon: 'megaphone',
          primary: true,
        },
        {
          id: 'nueva-comunicacion',
          label: 'Nueva tarea',
          icon: 'clipboard-list',
          primary: false,
        },
      ];
    }
    return [
      {
        id: 'nueva-comunicacion',
        label: 'Nueva tarea',
        icon: 'clipboard-list',
        primary: true,
      },
      {
        id: 'nuevo-comunicado',
        label: 'Nuevo comunicado',
        icon: 'megaphone',
        primary: false,
      },
    ];
  });

  protected readonly canalTabs = computed((): TabOption[] => [
    {
      id: 'comunicados',
      label: 'Comunicados a alumnos',
      icon: 'megaphone',
      count: this.announcements.announcements().length || null,
    },
    {
      id: 'tareas',
      label: 'Tareas del equipo',
      icon: 'clipboard-list',
      count: this.facade.pendingCount() || null,
    },
  ]);

  protected readonly heroKpis = computed((): SectionHeroKpi[] => {
    if (this.canal() === 'comunicados') {
      const allAnnouncements = this.announcements.announcements();
      const enviados = allAnnouncements.filter((a) => a.status === 'enviado').length;
      const programados = allAnnouncements.filter((a) => a.status === 'programado').length;
      const totalAlumnos = allAnnouncements.reduce((sum, a) => sum + (a.recipients_total ?? 0), 0);

      return [
        {
          id: 'enviados',
          label: 'Enviados',
          value: enviados,
          icon: 'send',
          color: 'success',
        },
        {
          id: 'programados',
          label: 'Programados',
          value: programados,
          icon: 'clock',
          color: 'warning',
        },
        {
          id: 'alcance',
          label: 'Alumnos alcanzados',
          value: totalAlumnos,
          icon: 'users',
        },
        {
          id: 'total',
          label: 'Total registros',
          value: allAnnouncements.length,
          icon: 'megaphone',
        },
      ];
    }

    if (this.canal() === 'tareas' && this.facade.error() && this.facade.tasks().length === 0) {
      return [];
    }

    return [
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
    ];
  });

  // Densidad adaptativa (spec 0028/0029): sin límite en desktop, acotado
  // en tablet/mobile o con el drawer lateral abierto (tier por contenedor).
  protected readonly maxVisible = computed(() =>
    this.layoutService.tier() === 'desktop' ? null : 5,
  );

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
      // hotfix-106-b (S18): con la pestaña de comunicados abierta, también su historial.
      if (untracked(() => this.canal()) === 'comunicados') void this.announcements.initialize();
    });
  }

  ngOnInit(): void {
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
      this.drawer.open(TaskCreateDrawerComponent, 'Nueva tarea', 'clipboard-list');
    }
    if (id === 'nuevo-comunicado') {
      this.drawer.open(AnnouncementComposerDrawerComponent, 'Nuevo comunicado', 'megaphone');
    }
  }

  protected openDetail(taskId: string): void {
    this.facade.selectTask(taskId);
    const task = this.facade.selectedTask();
    const title = task?.subject ?? 'Detalle';
    this.drawer.open(TaskDetailModalComponent, title, 'clipboard-list');
  }
}
