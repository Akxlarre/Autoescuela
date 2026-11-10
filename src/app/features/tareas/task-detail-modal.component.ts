import { formatChileDate } from '@core/utils/chile-time.utils';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { TaskStatusBadgeComponent } from '@shared/components/task-status-badge/task-status-badge.component';
import { TaskReplyThreadComponent } from '@shared/components/task-reply-thread/task-reply-thread.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { TaskCreateContextService } from '@core/services/ui/task-create-context.service';
import { TaskCreateDrawerComponent } from './task-create-drawer.component';
import { formatTaskAge } from '@core/utils/task.utils';
import type { TaskStatus } from '@core/models/ui/task.model';

const TYPE_LABEL: Record<string, string> = {
  task: 'Tarea',
  observation: 'Observación',
  question: 'Consulta',
};

const TYPE_ICON: Record<string, string> = {
  task: 'clipboard-list',
  observation: 'message-circle',
  question: 'circle-help',
};

@Component({
  selector: 'app-task-detail-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    TaskStatusBadgeComponent,
    TaskReplyThreadComponent,
    DrawerFormComponent,
    DrawerContentLoaderComponent,
    SkeletonBlockComponent,
    EmptyStateComponent,
  ],
  template: `
    @if (task()) {
      <app-drawer-form [hasFooter]="hasFooterActions()">
        <app-drawer-content-loader>
          <!-- ── Skeletons (350ms slide-in) ── -->
          <ng-template #skeletons>
            <div class="flex flex-col gap-4 w-full">
              <!-- Overview / Metadata Card Skeleton -->
              <div class="card p-4 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <app-skeleton-block variant="text" width="60px" height="12px" />
                    <app-skeleton-block variant="text" width="40px" height="12px" />
                  </div>
                  <app-skeleton-block
                    variant="rect"
                    width="80px"
                    height="22px"
                    borderRadius="9999px"
                  />
                </div>
                <app-skeleton-block variant="rect" width="100%" height="32px" borderRadius="8px" />
                <app-skeleton-block variant="text" width="130px" height="12px" />
              </div>

              <!-- Description Skeleton -->
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="70px" height="11px" />
                <app-skeleton-block variant="rect" width="100%" height="56px" borderRadius="12px" />
              </div>

              <!-- Replies Skeleton -->
              <div class="flex flex-col gap-2 pt-1">
                <app-skeleton-block variant="text" width="80px" height="11px" />
                <div class="flex flex-col gap-2">
                  <div class="flex flex-col gap-1 max-w-[70%]">
                    <div class="flex items-center gap-2">
                      <app-skeleton-block variant="circle" width="20px" height="20px" />
                      <app-skeleton-block variant="text" width="90px" height="12px" />
                    </div>
                    <app-skeleton-block
                      variant="rect"
                      width="180px"
                      height="38px"
                      borderRadius="16px"
                    />
                  </div>
                  <div class="flex flex-col gap-1 max-w-[70%] self-end items-end mt-1">
                    <div class="flex items-center gap-2">
                      <app-skeleton-block variant="text" width="60px" height="12px" />
                      <app-skeleton-block variant="circle" width="20px" height="20px" />
                    </div>
                    <app-skeleton-block
                      variant="rect"
                      width="140px"
                      height="36px"
                      borderRadius="16px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </ng-template>

          <!-- ── Contenido Real ── -->
          <ng-template #content>
            <div class="flex flex-col gap-4 w-full">
              <!-- Overview / Metadata Card -->
              <div class="card p-4 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <span class="micro-label text-text-muted">{{ typeLabel() }}</span>
                    <span class="text-xs text-text-muted">· {{ age() }}</span>
                  </div>
                  <app-task-status-badge [status]="task()!.status" />
                </div>

                <!-- Participants: Sender -> Recipient -->
                <div
                  class="flex items-center gap-3 py-2 px-3 rounded-lg bg-subtle text-xs text-text-primary"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-text-muted">De:</span>
                    <span class="font-medium truncate">{{ task()!.senderName }}</span>
                  </div>
                  <app-icon name="arrow-right" [size]="12" class="text-text-muted shrink-0" />
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-text-muted">Para:</span>
                    <span class="font-medium truncate">{{ task()!.recipientName }}</span>
                  </div>
                </div>

                @if (task()!.due_date) {
                  <div class="flex items-center gap-1.5 text-xs text-text-muted">
                    <app-icon name="calendar" [size]="13" class="text-text-muted shrink-0" />
                    <span>
                      Fecha límite:
                      <strong class="text-text-primary font-medium">{{ dueDateLabel() }}</strong>
                    </span>
                  </div>
                }
              </div>

              <!-- Description / Body -->
              @if (task()!.body) {
                <div class="flex flex-col gap-1.5">
                  <p class="micro-label">Descripción</p>
                  <div
                    class="card p-4 text-sm leading-relaxed text-text-primary whitespace-pre-wrap"
                  >
                    {{ task()!.body }}
                  </div>
                </div>
              }

              <!-- Hilo de respuestas -->
              <div class="flex flex-col gap-2 pt-1">
                <p class="micro-label">Respuestas</p>
                <app-task-reply-thread
                  [replies]="tasksFacade.selectedTaskReplies()"
                  [taskStatus]="task()!.status"
                  [currentUserId]="currentUserId()"
                  [currentUserName]="currentUserName()"
                  [senderId]="task()!.from_user_id"
                  [senderName]="task()!.senderName"
                  [recipientId]="task()!.to_user_id"
                  [recipientName]="task()!.recipientName"
                  (replySent)="onReplySent($event)"
                />
              </div>
            </div>
          </ng-template>
        </app-drawer-content-loader>

        <!-- Fixed Footer Actions -->
        @if (hasFooterActions()) {
          <ng-container ngProjectAs="[drawer-form-footer]">
            <div class="flex items-center justify-between w-full">
              <!-- Left: Destructive Action (Eliminar) -->
              <div>
                @if (task()!.canDelete) {
                  <button
                    class="btn-danger-ghost btn-sm"
                    (click)="onDeleteClicked()"
                    [disabled]="isMutating()"
                    data-llm-action="delete-task"
                  >
                    <app-icon name="trash-2" [size]="13" [ariaHidden]="true" />
                    Eliminar
                  </button>
                }
              </div>

              <!-- Right: Workflow Actions (Iniciar, Completar, Editar) -->
              <div class="flex items-center gap-2">
                @if (task()!.canEdit) {
                  <button
                    class="btn-secondary btn-sm"
                    data-llm-action="edit-task"
                    [disabled]="isMutating()"
                    (click)="onEditClicked()"
                  >
                    <app-icon name="edit-3" [size]="13" [ariaHidden]="true" />
                    Editar
                  </button>
                }

                @if (
                  task()!.canChangeStatus &&
                  task()!.status === 'pending' &&
                  task()!.type !== 'observation'
                ) {
                  <button
                    class="btn-warning-soft btn-sm"
                    (click)="changeStatus('in_progress')"
                    [disabled]="isMutating()"
                    data-llm-action="mark-task-in-progress"
                  >
                    <app-icon name="circle-play" [size]="13" [ariaHidden]="true" />
                    Iniciar
                  </button>
                }

                @if (
                  task()!.canChangeStatus &&
                  (task()!.status === 'pending' || task()!.status === 'in_progress')
                ) {
                  <button
                    class="btn-success-soft btn-sm"
                    (click)="changeStatus('completed')"
                    [disabled]="isMutating()"
                    data-llm-action="mark-task-completed"
                  >
                    <app-icon name="circle-check" [size]="13" [ariaHidden]="true" />
                    Completar
                  </button>
                }
              </div>
            </div>
          </ng-container>
        }
      </app-drawer-form>
    } @else {
      <app-drawer-form [hasFooter]="false">
        <div class="flex flex-col items-center justify-center min-h-[300px] w-full py-12">
          <app-empty-state
            icon="clipboard-list"
            message="No hay tarea seleccionada"
            subtitle="Selecciona una tarea de la lista para ver el detalle."
          />
        </div>
      </app-drawer-form>
    }
  `,
})
export class TaskDetailModalComponent {
  protected readonly tasksFacade = inject(TasksFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly taskContext = inject(TaskCreateContextService);

  protected readonly task = this.tasksFacade.selectedTask;
  protected readonly isMutating = signal(false);

  protected readonly currentUserId = () => this.authFacade.currentUser()?.dbId ?? 0;
  protected readonly currentUserName = () => this.authFacade.currentUser()?.name ?? null;

  protected readonly typeLabel = () => TYPE_LABEL[this.task()?.type ?? ''] ?? '';
  protected readonly typeIcon = () => TYPE_ICON[this.task()?.type ?? ''] ?? 'clipboard-list';

  protected readonly hasFooterActions = computed(() => {
    const t = this.task();
    if (!t) return false;
    return Boolean(t.canDelete || t.canEdit || t.canChangeStatus);
  });

  protected readonly age = () => {
    const t = this.task();
    return t ? formatTaskAge(t.created_at, new Date()) : '';
  };

  protected readonly dueDateLabel = () => {
    const due = this.task()?.due_date;
    if (!due) return '';
    return formatChileDate(due, { day: 'numeric', month: 'short' });
  };

  constructor() {
    let hadInitialTask = false;
    effect(() => {
      const t = this.task();
      if (!t) {
        if (hadInitialTask) {
          this.drawer.close();
        }
        return;
      }
      hadInitialTask = true;

      void this.tasksFacade.loadReplies(t.id);

      // AC5: auto-mark seen for observation when recipient opens
      const currentUser = this.authFacade.currentUser();
      if (t.type === 'observation' && t.to_user_id === currentUser?.dbId && !t.seen_at) {
        void this.tasksFacade.markSeen(t);
      }
    });
  }

  protected async changeStatus(status: TaskStatus): Promise<void> {
    const t = this.task();
    if (!t || this.isMutating()) return;
    this.isMutating.set(true);
    await this.tasksFacade.updateStatus(t.id, status);
    this.isMutating.set(false);
  }

  protected async markSeen(): Promise<void> {
    const t = this.task();
    if (!t || this.isMutating()) return;
    this.isMutating.set(true);
    await this.tasksFacade.markSeen(t);
    this.isMutating.set(false);
  }

  protected async onReplySent(body: string): Promise<void> {
    const t = this.task();
    if (!t) return;
    void this.tasksFacade.addReply(t.id, body);
  }

  /** Spec 0053-b: abre el formulario en modo edición, apilado sobre el detalle. */
  protected onEditClicked(): void {
    const t = this.task();
    if (!t?.canEdit) return;
    this.taskContext.primeEdit(t);
    this.drawer.push(TaskCreateDrawerComponent, 'Editar tarea', 'edit-3');
  }

  protected async onDeleteClicked(): Promise<void> {
    const t = this.task();
    if (!t || this.isMutating()) return;

    const typeLabel = TYPE_LABEL[t.type]?.toLowerCase() ?? 'mensaje';
    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar mensaje',
      message: `¿Eliminar esta ${typeLabel}? Esta acción no se puede deshacer.`,
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    this.isMutating.set(true);
    const ok = await this.tasksFacade.softDelete(t.id);
    if (ok) {
      this.drawer.close();
      this.tasksFacade.selectTask(null);
    }
    this.isMutating.set(false);
  }
}
