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
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { formatTaskAge } from '@core/utils/task.utils';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';
import type { TaskReply, TaskStatus } from '@core/models/ui/task.model';

interface EnrichedReply {
  id: string;
  from_user_id: number;
  body: string;
  created_at: string;
  isMe: boolean;
  authorName: string;
  authorInitials: string;
  showAuthorHeader: boolean;
  age: string;
}

@Component({
  selector: 'app-task-reply-thread',
  standalone: true,
  imports: [IconComponent, AnimateInDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <!-- Hilo de respuestas -->
      @if (enrichedReplies().length === 0) {
        <div class="card p-6 flex flex-col items-center justify-center text-center border-dashed">
          <app-icon name="message-circle" [size]="20" class="text-text-muted opacity-40 mb-1.5" />
          <p class="text-xs font-medium text-text-secondary">Sin respuestas aún</p>
          <p class="text-xs text-text-muted">
            Sé el primero en responder o agregar una actualización a este hilo.
          </p>
        </div>
      } @else {
        <ol
          #repliesList
          class="flex flex-col gap-1 overflow-y-auto pr-1 max-h-96"
          aria-label="Hilo de respuestas"
        >
          @for (reply of enrichedReplies(); track reply.id) {
            <li
              appAnimateIn
              class="flex flex-col rounded-2xl p-2.5 px-3.5 max-w-[85%] w-fit border shadow-2xs transition-all"
              [class.self-end]="reply.isMe"
              [class.self-start]="!reply.isMe"
              [class.rounded-tr-xs]="reply.isMe"
              [class.rounded-tl-xs]="!reply.isMe"
              [class.bg-brand-muted]="reply.isMe"
              [class.border-border-subtle]="true"
              [class.bg-surface]="!reply.isMe"
              [class.mt-2]="reply.showAuthorHeader"
              [class.mt-0.5]="!reply.showAuthorHeader"
            >
              @if (reply.showAuthorHeader) {
                <div class="flex items-center gap-1.5 mb-1">
                  <span
                    class="inline-flex items-center justify-center w-5 h-5 rounded-full text-2xs font-bold shrink-0"
                    [style.background]="reply.isMe ? 'var(--color-primary)' : 'var(--bg-subtle)'"
                    [style.color]="
                      reply.isMe ? 'var(--color-primary-text, #ffffff)' : 'var(--text-secondary)'
                    "
                  >
                    {{ reply.authorInitials }}
                  </span>
                  <span class="text-xs font-semibold text-text-primary">
                    {{ reply.authorName }}
                  </span>
                  <span class="text-2xs text-text-muted ml-auto"> · {{ reply.age }} </span>
                </div>
              }
              <p
                class="text-sm leading-relaxed text-text-primary wrap-break-word whitespace-pre-wrap"
              >
                {{ reply.body }}
              </p>
            </li>
          }
        </ol>
      }

      <!-- Input de nueva respuesta (solo si la tarea no está completada) -->
      @if (canReply()) {
        <form
          class="flex items-end gap-1.5 p-1.5 sm:p-2 sm:gap-2 rounded-xl bg-surface border border-border-subtle focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/30 transition-all shrink-0 mt-1"
          (submit)="$event.preventDefault(); submitReply()"
        >
          <textarea
            #replyInput
            rows="1"
            class="flex-1 resize-none border-0 px-2 py-1.5 text-sm bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none max-h-28 overflow-y-auto leading-normal"
            style="min-height: 36px;"
            placeholder="Escribe una respuesta…"
            [attr.maxlength]="500"
            [value]="draftBody()"
            (input)="onTextInput($event)"
            (keydown.control.enter)="onKeydownEnter($event)"
            (keydown.meta.enter)="onKeydownEnter($event)"
            data-llm-description="reply text input for task thread"
            aria-label="Respuesta"
          ></textarea>
          <button
            type="submit"
            class="btn-primary btn-sm flex items-center justify-center gap-1.5 h-9 px-2.5 sm:px-3 shrink-0 rounded-lg cursor-pointer transition-all"
            [disabled]="!draftBody().trim()"
            data-llm-action="add-reply-to-task"
            aria-label="Enviar respuesta"
            title="Enviar (Ctrl+Enter)"
          >
            <app-icon name="send" [size]="14" [ariaHidden]="true" />
            <span class="hidden sm:inline text-xs font-medium">Enviar</span>
          </button>
        </form>
      } @else {
        <div
          class="card p-3 flex items-center justify-center gap-2 text-xs font-medium text-text-muted"
        >
          <app-icon name="lock" [size]="14" [ariaHidden]="true" class="shrink-0" />
          <span>Tarea completada · Hilo cerrado a nuevas respuestas</span>
        </div>
      }
    </div>
  `,
})
export class TaskReplyThreadComponent {
  readonly replies = input.required<TaskReply[]>();
  readonly taskStatus = input.required<TaskStatus>();
  readonly currentUserId = input.required<number>();
  readonly currentUserName = input<string | null>(null);
  readonly senderId = input<number | null>(null);
  readonly senderName = input<string | null>(null);
  readonly recipientId = input<number | null>(null);
  readonly recipientName = input<string | null>(null);

  readonly replySent = output<string>();

  protected readonly draftBody = signal('');

  protected readonly canReply = computed(() => this.taskStatus() !== 'completed');

  protected readonly enrichedReplies = computed((): EnrichedReply[] => {
    const list = this.replies();
    const myId = this.currentUserId();
    const myName = this.currentUserName();

    return list.map((reply, idx) => {
      const isMe = reply.from_user_id === myId;
      const prev = idx > 0 ? list[idx - 1] : null;

      // Group consecutive messages from the same sender sent within 5 minutes
      const sameSenderAsPrev = prev !== null && prev.from_user_id === reply.from_user_id;
      const timeDiffMs = prev
        ? Math.abs(new Date(reply.created_at).getTime() - new Date(prev.created_at).getTime())
        : Infinity;
      const withinWindow = timeDiffMs < 5 * 60 * 1000;

      const showAuthorHeader = !sameSenderAsPrev || !withinWindow;

      let authorName = 'Compañero';
      let initials = '?';

      if (isMe) {
        authorName = 'Tú';
        initials = myName ? getInitialsFromDisplayName(myName) : 'T';
      } else if (this.senderId() && reply.from_user_id === this.senderId()) {
        authorName = this.senderName() ?? 'Emisor';
        initials = getInitialsFromDisplayName(authorName);
      } else if (this.recipientId() && reply.from_user_id === this.recipientId()) {
        authorName = this.recipientName() ?? 'Destinatario';
        initials = getInitialsFromDisplayName(authorName);
      }

      return {
        id: reply.id,
        from_user_id: reply.from_user_id,
        body: reply.body,
        created_at: reply.created_at,
        isMe,
        authorName,
        authorInitials: initials,
        showAuthorHeader,
        age: formatTaskAge(reply.created_at, new Date()),
      };
    });
  });

  private readonly replyInputRef = viewChild<ElementRef<HTMLTextAreaElement>>('replyInput');
  private readonly repliesListRef = viewChild<ElementRef<HTMLOListElement>>('repliesList');

  constructor() {
    effect(() => {
      this.replies(); // track
      const el = this.repliesListRef()?.nativeElement;
      if (el) {
        setTimeout(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 60);
      }
    });
  }

  protected onTextInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.draftBody.set(target.value);
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  }

  protected onKeydownEnter(event: Event): void {
    event.preventDefault();
    this.submitReply();
  }

  protected submitReply(): void {
    const body = this.draftBody().trim();
    if (!body) return;
    this.replySent.emit(body);
    this.draftBody.set('');
    const input = this.replyInputRef()?.nativeElement;
    if (input) {
      input.style.height = 'auto';
      input.focus();
    }
  }
}
