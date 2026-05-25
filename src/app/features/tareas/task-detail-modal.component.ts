import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { TaskStatusBadgeComponent } from '@shared/components/task-status-badge/task-status-badge.component';
import { TaskReplyThreadComponent } from '@shared/components/task-reply-thread/task-reply-thread.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { AuthFacade } from '@core/facades/auth.facade';
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
  imports: [IconComponent, TaskStatusBadgeComponent, TaskReplyThreadComponent],
  template: `
    @if (task()) {
      <div class="flex flex-col gap-5">
        <!-- Header -->
        <div class="flex flex-col gap-2">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <app-icon
                [name]="typeIcon()"
                [size]="18"
                [ariaHidden]="true"
                class="shrink-0"
                style="color: var(--text-muted)"
              />
              <h2 class="text-base font-semibold truncate" style="color: var(--text-primary)">
                {{ task()!.subject }}
              </h2>
            </div>
            <app-task-status-badge [status]="task()!.status" />
          </div>

          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <span class="text-xs" style="color: var(--text-muted)">
              <app-icon name="user" [size]="11" [ariaHidden]="true" class="inline mr-1" />
              {{ task()!.senderName }} → {{ task()!.recipientName }}
            </span>
            @if (task()!.due_date) {
              <span class="text-xs" style="color: var(--text-muted)">
                <app-icon name="calendar" [size]="11" [ariaHidden]="true" class="inline mr-1" />
                Vence {{ dueDateLabel() }}
              </span>
            }
            <span class="text-xs" style="color: var(--text-muted)">
              {{ typeLabel() }} · {{ age() }}
            </span>
          </div>
        </div>

        <!-- Body -->
        @if (task()!.body) {
          <p
            class="text-sm leading-relaxed rounded-xl px-4 py-3"
            style="color: var(--text-primary); background: var(--bg-subtle)"
          >
            {{ task()!.body }}
          </p>
        }

        <!-- Botones de acción -->
        <div class="flex flex-wrap gap-2">
          @if (
            task()!.canChangeStatus &&
            task()!.status === 'pending' &&
            task()!.type !== 'observation'
          ) {
            <button
              class="h-9 px-4 text-xs font-semibold rounded-lg transition-all"
              style="background: var(--state-warning-bg); color: var(--state-warning)"
              (click)="changeStatus('in_progress')"
              [disabled]="isMutating()"
              data-llm-action="mark-task-in-progress"
            >
              <span class="flex items-center gap-1.5">
                <app-icon name="circle-play" [size]="13" [ariaHidden]="true" />
                Iniciar
              </span>
            </button>
            <button
              class="h-9 px-4 text-xs font-semibold rounded-lg transition-all"
              style="background: var(--state-success-bg); color: var(--state-success)"
              (click)="changeStatus('completed')"
              [disabled]="isMutating()"
              data-llm-action="mark-task-completed"
            >
              <span class="flex items-center gap-1.5">
                <app-icon name="circle-check" [size]="13" [ariaHidden]="true" />
                Completar
              </span>
            </button>
          }

          @if (task()!.canChangeStatus && task()!.status === 'in_progress') {
            <button
              class="h-9 px-4 text-xs font-semibold rounded-lg transition-all"
              style="background: var(--state-success-bg); color: var(--state-success)"
              (click)="changeStatus('completed')"
              [disabled]="isMutating()"
              data-llm-action="mark-task-completed"
            >
              <span class="flex items-center gap-1.5">
                <app-icon name="circle-check" [size]="13" [ariaHidden]="true" />
                Completar
              </span>
            </button>
          }

          @if (task()!.canEdit) {
            <button
              class="h-9 px-4 text-xs font-semibold rounded-lg border transition-all ml-auto"
              style="border-color: var(--border-default); color: var(--text-secondary)"
              data-llm-action="edit-task"
              disabled
            >
              <span class="flex items-center gap-1.5">
                <app-icon name="edit-3" [size]="13" [ariaHidden]="true" />
                Editar
              </span>
            </button>
          }
        </div>

        <!-- Hilo de respuestas -->
        <div class="border-t pt-4" style="border-color: var(--border-default)">
          <p
            class="text-xs font-semibold uppercase tracking-wide mb-3"
            style="color: var(--text-muted)"
          >
            Respuestas
          </p>
          <app-task-reply-thread
            [replies]="tasksFacade.selectedTaskReplies()"
            [taskStatus]="task()!.status"
            [currentUserId]="currentUserId()"
            (replySent)="onReplySent($event)"
          />
        </div>
      </div>
    } @else {
      <p class="text-sm text-center py-8" style="color: var(--text-muted)">
        Seleccioná una tarea para ver el detalle.
      </p>
    }
  `,
})
export class TaskDetailModalComponent {
  protected readonly tasksFacade = inject(TasksFacade);
  private readonly authFacade = inject(AuthFacade);

  protected readonly task = this.tasksFacade.selectedTask;
  protected readonly isMutating = signal(false);

  protected readonly currentUserId = () => this.authFacade.currentUser()?.dbId ?? 0;

  protected readonly typeLabel = () => TYPE_LABEL[this.task()?.type ?? ''] ?? '';
  protected readonly typeIcon = () => TYPE_ICON[this.task()?.type ?? ''] ?? 'clipboard-list';

  protected readonly age = () => {
    const t = this.task();
    return t ? formatTaskAge(t.created_at, new Date()) : '';
  };

  protected readonly dueDateLabel = () => {
    const due = this.task()?.due_date;
    if (!due) return '';
    return new Date(due).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  };

  constructor() {
    effect(() => {
      const t = this.task();
      if (!t) return;

      void this.tasksFacade.loadReplies(t.id);

      // AC5: auto-mark seen for observation when recipient opens
      const currentUser = this.authFacade.currentUser();
      if (t.type === 'observation' && t.to_user_id === currentUser?.dbId && !t.seen_at) {
        void this.tasksFacade.markSeen(t.id);
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
    await this.tasksFacade.markSeen(t.id);
    this.isMutating.set(false);
  }

  protected async onReplySent(body: string): Promise<void> {
    const t = this.task();
    if (!t) return;
    const ok = await this.tasksFacade.addReply(t.id, body);
    if (ok) void this.tasksFacade.loadReplies(t.id);
  }
}
