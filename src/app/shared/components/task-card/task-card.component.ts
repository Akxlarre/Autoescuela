import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { TaskStatusBadgeComponent } from '@shared/components/task-status-badge/task-status-badge.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { formatTaskAge } from '@core/utils/task.utils';
import type { TaskRow } from '@core/models/ui/task.model';

const TYPE_ICON: Record<string, string> = {
  task: 'clipboard-list',
  observation: 'message-circle',
  question: 'circle-help',
};

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [IconComponent, TaskStatusBadgeComponent, CardHoverDirective, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="card flex flex-col gap-3 p-4">
        <div class="flex items-center justify-between gap-2">
          <app-skeleton-block variant="text" width="60%" height="14px" />
          <app-skeleton-block variant="rect" width="72px" height="20px" />
        </div>
        <app-skeleton-block variant="text" width="100%" height="12px" />
        <app-skeleton-block variant="text" width="80%" height="12px" />
        <div class="flex items-center gap-2 mt-1">
          <app-skeleton-block variant="circle" width="16px" height="16px" />
          <app-skeleton-block variant="text" width="40%" height="11px" />
        </div>
      </div>
    } @else {
      <div
        appCardHover
        class="card flex flex-col gap-2 p-4 cursor-pointer"
        data-llm-action="open-task-detail"
        role="button"
        tabindex="0"
        [attr.aria-label]="'Tarea: ' + task().subject"
        (click)="cardClicked.emit(task().id)"
        (keydown.enter)="cardClicked.emit(task().id)"
      >
        <!-- Header: tipo + estado -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0">
            <app-icon [name]="typeIcon()" [size]="14" [ariaHidden]="true" class="shrink-0" />
            <p class="text-sm font-semibold text-text-primary truncate text-text-primary">
              {{ task().subject }}
            </p>
          </div>
          <app-task-status-badge [status]="task().status" />
        </div>

        <!-- Body preview -->
        @if (bodyPreview()) {
          <p class="text-xs text-text-secondary leading-normal">
            {{ bodyPreview() }}
          </p>
        }

        <!-- Badges de alerta -->
        <div class="flex flex-wrap gap-1.5">
          @if (task().isOverdue) {
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style="color: var(--state-error, #dc2626); background-color: var(--state-error-bg, #fef2f2)"
            >
              <app-icon name="alert-triangle" [size]="11" [ariaHidden]="true" />
              Vencida
            </span>
          }
          @if (task().recipientInactive) {
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-text-muted bg-subtle"
            >
              <app-icon name="user-x" [size]="11" [ariaHidden]="true" />
              Destinatario inactivo
            </span>
          }
        </div>

        <!-- Footer: emisor → destinatario + age + replies -->
        <div class="flex items-center justify-between gap-2 mt-1">
          <span class="text-xs truncate text-text-muted">
            {{ task().senderName }} → {{ task().recipientName }}
          </span>
          <div class="flex items-center gap-2 shrink-0">
            @if (task().replyCount > 0) {
              <span class="inline-flex items-center gap-1 text-xs text-text-secondary">
                <app-icon name="message-circle" [size]="11" [ariaHidden]="true" />
                {{ task().replyCount }}
              </span>
            }
            @if (task().due_date) {
              <span class="text-xs text-text-muted">
                {{ dueDateLabel() }}
              </span>
            }
            <span class="text-xs text-text-muted">
              {{ age() }}
            </span>
          </div>
        </div>
      </div>
    }
  `,
})
export class TaskCardComponent {
  readonly task = input.required<TaskRow>();
  readonly loading = input<boolean>(false);

  readonly cardClicked = output<string>();

  readonly typeIcon = computed(() => TYPE_ICON[this.task().type] ?? 'clipboard-list');

  readonly bodyPreview = computed(() => {
    const body = this.task().body;
    if (!body) return '';
    return body.length > 80 ? body.slice(0, 80) + '…' : body;
  });

  readonly age = computed(() => formatTaskAge(this.task().created_at, new Date()));

  readonly dueDateLabel = computed(() => {
    const due = this.task().due_date;
    if (!due) return '';
    const d = new Date(due);
    return `Vence ${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`;
  });
}
