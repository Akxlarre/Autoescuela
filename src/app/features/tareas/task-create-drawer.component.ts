import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import { TasksFacade } from '@core/facades/tasks.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { TaskCreateContextService } from '@core/services/ui/task-create-context.service';
import type { TaskType } from '@core/models/ui/task.model';

const TYPE_OPTIONS: { label: string; value: TaskType }[] = [
  { label: 'Tarea', value: 'task' },
  { label: 'Observación', value: 'observation' },
  { label: 'Consulta', value: 'question' },
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  secretary: 'Secretaria',
  instructor: 'Instructor',
};

@Component({
  selector: 'app-task-create-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SelectModule],
  template: `
    <div class="flex flex-col gap-5 py-2">
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-5">
        <!-- Tipo -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="t-type">
            Tipo <span class="text-error">*</span>
          </label>
          <p-select
            id="t-type"
            formControlName="type"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
            data-llm-description="task type selector: task, observation, or question"
          />
        </div>

        <!-- Destinatario -->
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold uppercase tracking-wide text-text-muted"
            for="t-recipient"
          >
            Destinatario <span class="text-error">*</span>
          </label>
          @if (recipientOptions().length === 0) {
            <p class="text-xs py-1 text-text-muted">No hay destinatarios disponibles.</p>
          } @else {
            <p-select
              id="t-recipient"
              formControlName="recipientId"
              [options]="recipientOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar destinatario…"
              styleClass="w-full"
              data-llm-description="task recipient selector filtered by role permissions and branch"
            />
          }
        </div>

        <!-- Asunto -->
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold uppercase tracking-wide text-text-muted"
            for="t-subject"
          >
            Asunto <span class="text-error">*</span>
          </label>
          <input
            id="t-subject"
            type="text"
            formControlName="subject"
            placeholder="Ej. Revisar documentación del alumno"
            maxlength="200"
            class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2 focus:outline-none transition-all"
            data-llm-description="task subject input - concise title for the task"
          />
        </div>

        <!-- Descripción -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="t-body">
            Descripción
          </label>
          <textarea
            id="t-body"
            formControlName="body"
            placeholder="Detalle opcional de la tarea…"
            rows="3"
            maxlength="2000"
            class="w-full px-3 py-2 text-sm rounded-xl border border-border-default bg-surface text-text-primary resize-none focus:ring-2 focus:outline-none transition-all"
            data-llm-description="task body description - optional detailed content"
          ></textarea>
        </div>

        <!-- Fecha límite (solo type='task') -->
        @if (selectedType() === 'task') {
          <div class="flex flex-col gap-1.5">
            <label
              class="text-xs font-semibold uppercase tracking-wide text-text-muted"
              for="t-due"
            >
              Fecha límite
            </label>
            <input
              id="t-due"
              type="date"
              formControlName="due_date"
              class="w-full h-11 px-3 text-sm rounded-xl border focus:ring-2 focus:outline-none transition-all"
              class="border-border-default bg-surface text-text-primary"
              data-llm-description="task due date picker - only shown for task type"
            />
          </div>
        }

        <!-- Error del facade -->
        @if (tasksFacade.error()) {
          <p class="text-xs rounded-lg px-3 py-2 text-error bg-error-subtle">
            <app-icon name="alert-circle" [size]="12" [ariaHidden]="true" class="inline mr-1" />
            {{ tasksFacade.error() }}
          </p>
        }

        <!-- Botones -->
        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            class="btn-primary flex-1"
            [disabled]="form.invalid || isSaving()"
            data-llm-action="submit-create-task"
          >
            @if (isSaving()) {
              <app-icon name="loader-2" [size]="16" [ariaHidden]="true" class="animate-spin" />
              Enviando…
            } @else {
              <app-icon name="send" [size]="16" [ariaHidden]="true" />
              Enviar tarea
            }
          </button>
          <button type="button" class="btn-ghost" (click)="drawer.close()">Cancelar</button>
        </div>
      </form>
    </div>
  `,
})
export class TaskCreateDrawerComponent {
  protected readonly tasksFacade = inject(TasksFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly taskContext = inject(TaskCreateContextService);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly isSaving = signal(false);
  protected readonly selectedType = signal<TaskType>('task');

  protected readonly recipientOptions = computed(() =>
    this.tasksFacade.recipients().map((r) => ({
      label: `${r.name} · ${ROLE_LABEL[r.role] ?? r.role}`,
      value: r.dbId,
    })),
  );

  protected readonly form = new FormGroup({
    type: new FormControl<TaskType>('task', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    recipientId: new FormControl<number | null>(null, Validators.required),
    subject: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    body: new FormControl<string | null>(null),
    due_date: new FormControl<string | null>(null),
  });

  constructor() {
    void this.tasksFacade.loadRecipients();

    const initialType = this.taskContext.initialType();
    if (initialType !== 'task') {
      this.form.patchValue({ type: initialType }, { emitEvent: false });
      this.selectedType.set(initialType);
    }
    this.taskContext.reset();

    this.form
      .get('type')!
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe((t) => {
        this.selectedType.set(t as TaskType);
        if (t !== 'task') {
          this.form.patchValue({ due_date: null }, { emitEvent: false });
        }
      });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSaving()) return;

    const val = this.form.getRawValue();
    const recipient = this.tasksFacade.recipients().find((r) => r.dbId === val.recipientId);
    if (!recipient) return;

    this.isSaving.set(true);
    const success = await this.tasksFacade.createTask({
      type: val.type,
      to_user_id: recipient.dbId,
      to_role: recipient.role,
      subject: val.subject,
      body: val.body ?? null,
      due_date: val.type === 'task' ? (val.due_date ?? null) : null,
    });
    this.isSaving.set(false);

    if (success) {
      this.drawer.close();
    }
  }
}
