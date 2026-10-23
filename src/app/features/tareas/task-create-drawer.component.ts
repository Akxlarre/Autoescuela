import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import { TasksFacade } from '@core/facades/tasks.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { TaskCreateContextService } from '@core/services/ui/task-create-context.service';
import type { TaskRow, TaskType } from '@core/models/ui/task.model';
import { toChileDate } from '@core/utils/chile-time.utils';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

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
  imports: [
    ReactiveFormsModule,
    IconComponent,
    SelectModule,
    DateInputComponent,
    DrawerFormComponent,
    StableWidthDirective,
  ],
  template: `
    <app-drawer-form>
      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="flex flex-col gap-5"
        data-llm-form="create-task"
      >
        <!-- Tipo -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="t-type">Tipo <span class="text-error">*</span></label>
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
          <label class="field-label" for="t-recipient">
            Destinatario <span class="text-error">*</span>
          </label>
          @if (editing(); as tarea) {
            <!-- spec 0053-b (AC2): el destinatario no se cambia al editar. -->
            <p
              class="field-input bg-subtle text-text-secondary"
              data-llm-description="task recipient, read-only while editing"
            >
              {{ tarea.recipientName }}
            </p>
          } @else if (recipientOptions().length === 0) {
            <p class="field-hint">No hay destinatarios disponibles.</p>
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
          <label class="field-label" for="t-subject"
            >Asunto <span class="text-error">*</span></label
          >
          <input
            id="t-subject"
            type="text"
            formControlName="subject"
            placeholder="Ej. Revisar documentación del alumno"
            maxlength="200"
            class="field-input"
            data-llm-description="task subject input - concise title for the task"
          />
        </div>

        <!-- Descripción -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="t-body">Descripción</label>
          <textarea
            id="t-body"
            formControlName="body"
            placeholder="Detalle opcional de la tarea…"
            rows="3"
            maxlength="2000"
            class="field-input resize-none"
            data-llm-description="task body description - optional detailed content"
          ></textarea>
        </div>

        <!-- Fecha límite (solo type='task') -->
        @if (selectedType() === 'task') {
          <div class="flex flex-col gap-1.5">
            <app-date-input
              label="Fecha límite"
              [value]="form.get('due_date')?.value ?? ''"
              (valueChange)="form.get('due_date')?.setValue($event)"
              data-llm-description="task due date picker - only shown for task type"
            />
          </div>
        }

        <!-- Error del facade -->
        @if (tasksFacade.error()) {
          <div class="flex items-center gap-2 rounded-lg px-3 py-2 bg-error-subtle">
            <app-icon
              name="alert-circle"
              [size]="14"
              color="var(--state-error)"
              [ariaHidden]="true"
            />
            <span class="text-xs text-error">{{ tasksFacade.error() }}</span>
          </div>
        }
      </form>

      <!-- Footer canónico -->
      <ng-container ngProjectAs="[drawer-form-footer]">
        <!-- Al editar vuelve al detalle de la tarea, no cierra todo (spec 0053-b). -->
        <button
          type="button"
          class="btn-secondary"
          (click)="editing() ? drawer.back() : drawer.close()"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex items-center justify-center gap-2"
          [disabled]="form.invalid || isSaving()"
          [appStableWidth]="isSaving()"
          (click)="submit()"
          [attr.data-llm-action]="editing() ? 'save-task-edit' : 'submit-create-task'"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="16" [ariaHidden]="true" class="animate-spin" />
            {{ editing() ? 'Guardando…' : 'Enviando…' }}
          } @else if (editing()) {
            <app-icon name="check" [size]="16" [ariaHidden]="true" />
            Guardar cambios
          } @else {
            <app-icon name="send" [size]="16" [ariaHidden]="true" />
            Enviar tarea
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class TaskCreateDrawerComponent {
  protected readonly tasksFacade = inject(TasksFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly taskContext = inject(TaskCreateContextService);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly isSaving = signal(false);
  protected readonly selectedType = signal<TaskType>('task');
  /** Tarea en edición (spec 0053-b); null = crear. Se toma del contexto al abrir. */
  protected readonly editing = signal<TaskRow | null>(this.taskContext.editing());

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
      // spec 0053-b (AC-E2): un asunto de solo espacios no vale.
      validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)],
    }),
    body: new FormControl<string | null>(null),
    due_date: new FormControl<string | null>(null),
  });

  constructor() {
    const tarea = this.editing();
    if (tarea) {
      // spec 0053-b (AC1/AC2): campos precargados; tipo y destinatario fijos.
      this.form.patchValue(
        {
          type: tarea.type,
          recipientId: tarea.to_user_id,
          subject: tarea.subject,
          body: tarea.body ?? null,
          due_date: tarea.due_date ? toChileDate(tarea.due_date) : null,
        },
        { emitEvent: false },
      );
      this.form.get('type')!.disable({ emitEvent: false });
      this.selectedType.set(tarea.type);
    } else {
      void this.tasksFacade.loadRecipients();
      const initialType = this.taskContext.initialType();
      if (initialType !== 'task') {
        this.form.patchValue({ type: initialType }, { emitEvent: false });
        this.selectedType.set(initialType);
      }
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

    const tarea = this.editing();
    if (tarea) {
      this.isSaving.set(true);
      const ok = await this.tasksFacade.updateTask(tarea, {
        subject: val.subject,
        body: val.body ?? null,
        due_date: val.due_date ?? null,
      });
      this.isSaving.set(false);
      // AC3: vuelve al detalle, que ya muestra los datos nuevos.
      if (ok) this.drawer.back();
      return;
    }

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
