import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { formatTaskAge } from '@core/utils/task.utils';
import type { TaskReply } from '@core/models/dto/task-reply.model';
import type { TaskStatus } from '@core/models/ui/task.model';

@Component({
  selector: 'app-task-reply-thread',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <!-- Hilo de respuestas -->
      @if (replies().length === 0) {
        <p class="text-xs text-center py-3 text-text-muted">Sin respuestas aún.</p>
      } @else {
        <ol
          #repliesList
          class="flex flex-col gap-2 overflow-y-auto pr-1"
          style="max-height: 260px"
          aria-label="Hilo de respuestas"
        >
          @for (reply of replies(); track reply.id) {
            <li
              class="flex flex-col gap-0.5 rounded-lg p-3 max-w-[85%]"
              [class.self-end]="reply.from_user_id === currentUserId()"
              [class.self-start]="reply.from_user_id !== currentUserId()"
              [style.background-color]="
                reply.from_user_id === currentUserId()
                  ? 'var(--color-primary-muted, rgba(14,165,233,0.08))'
                  : 'var(--bg-subtle)'
              "
            >
              <p class="text-xs font-medium text-text-secondary">
                {{ reply.from_user_id === currentUserId() ? 'Tú' : 'Otro' }}
                <span class="font-normal ml-1 text-text-muted">
                  · {{ formatAge(reply.created_at) }}
                </span>
              </p>
              <p class="text-sm text-text-primary break-words whitespace-pre-wrap">
                {{ reply.body }}
              </p>
            </li>
          }
        </ol>
      }

      <!-- Input de nueva respuesta (solo si la tarea no está completada) -->
      @if (canReply()) {
        <form class="flex items-end gap-2 mt-1" (submit)="$event.preventDefault(); submitReply()">
          <textarea
            #replyInput
            class="flex-1 resize-none rounded-lg border border-border-default px-3 py-2 text-sm bg-surface text-text-primary min-h-16 focus:outline-none focus:ring-2"
            placeholder="Escribí tu respuesta…"
            [attr.maxlength]="500"
            [value]="draftBody()"
            (input)="draftBody.set($any($event).target.value)"
            data-llm-description="reply text input for task thread"
            aria-label="Respuesta"
          ></textarea>
          <button
            type="submit"
            class="btn-primary flex items-center gap-1.5 h-10 px-4 shrink-0"
            [disabled]="!draftBody().trim()"
            data-llm-action="add-reply-to-task"
            aria-label="Enviar respuesta"
          >
            <app-icon name="send" [size]="14" [ariaHidden]="true" />
            Enviar
          </button>
        </form>
      } @else {
        <p class="text-xs text-center py-2 rounded-lg text-text-muted bg-subtle">
          <app-icon name="lock" [size]="12" [ariaHidden]="true" class="inline mr-1" />
          La tarea está completada — no se permiten más respuestas.
        </p>
      }
    </div>
  `,
})
export class TaskReplyThreadComponent {
  readonly replies = input.required<TaskReply[]>();
  readonly taskStatus = input.required<TaskStatus>();
  readonly currentUserId = input.required<number>();

  readonly replySent = output<string>();

  protected readonly draftBody = signal('');

  protected readonly canReply = computed(() => this.taskStatus() !== 'completed');

  private readonly replyInputRef = viewChild<ElementRef<HTMLTextAreaElement>>('replyInput');
  private readonly repliesListRef = viewChild<ElementRef<HTMLOListElement>>('repliesList');

  constructor() {
    effect(() => {
      this.replies(); // track
      const el = this.repliesListRef()?.nativeElement;
      if (el) setTimeout(() => (el.scrollTop = el.scrollHeight), 0);
    });
  }

  protected formatAge(createdAt: string): string {
    return formatTaskAge(createdAt, new Date());
  }

  protected submitReply(): void {
    const body = this.draftBody().trim();
    if (!body) return;
    this.replySent.emit(body);
    this.draftBody.set('');
    this.replyInputRef()?.nativeElement.focus();
  }
}
