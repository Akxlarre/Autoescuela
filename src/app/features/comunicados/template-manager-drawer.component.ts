import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { NotificationTemplatesFacade } from '@core/facades/notification-templates.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { insertAtCursor } from '@core/utils/announcement-template.utils';
import { TEMPLATE_VARIABLES } from '@core/models/ui/notification-template.model';
import type { TemplateDraft, TemplateRow } from '@core/models/ui/notification-template.model';

const DRAFT_VACIO: TemplateDraft = { id: null, name: '', subject: '', body: '', active: true };

/**
 * Gestión de plantillas de comunicado (spec 0042-b, AC1). Solo admin.
 *
 * El gate visual es por comodidad; quien impide de verdad que una secretaría escriba es la
 * RLS de `notification_templates` (AC4). Si esta pantalla se le mostrara por error, la BD
 * seguiría rechazando la operación.
 */
@Component({
  selector: 'app-template-manager-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    EmptyStateComponent,
    DrawerFormComponent,
    StableWidthDirective,
  ],
  template: `
    <app-drawer-form>
      <div class="flex flex-col gap-5" data-llm-form="manage-announcement-templates">
        @if (editing()) {
          <!-- ── Editor ───────────────────────────────────────────────── -->
          <h3 class="section-title">
            {{ draft().id === null ? 'Nueva plantilla' : 'Editar plantilla' }}
          </h3>

          <div class="flex flex-col gap-1.5">
            <label class="field-label" for="t-name">Nombre <span class="text-error">*</span></label>
            <input
              id="t-name"
              type="text"
              class="field-input"
              maxlength="80"
              [ngModel]="draft().name"
              (ngModelChange)="patch({ name: $event })"
              data-llm-description="template name, only visible to staff"
            />
            <p class="field-hint">Solo lo ve el equipo, no los alumnos.</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label" for="t-subject">
              Asunto <span class="text-error">*</span>
            </label>
            <input
              id="t-subject"
              type="text"
              class="field-input"
              maxlength="150"
              [ngModel]="draft().subject"
              (ngModelChange)="patch({ subject: $event })"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label" for="t-body"
              >Mensaje <span class="text-error">*</span></label
            >
            <textarea
              #bodyInput
              id="t-body"
              rows="7"
              class="field-input"
              [ngModel]="draft().body"
              (ngModelChange)="patch({ body: $event })"
            ></textarea>
          </div>

          <div class="card p-3 space-y-2">
            <p class="micro-label">Variables disponibles</p>
            <p class="text-xs text-text-muted">
              Se reemplazan por los datos de cada alumno al enviar. Si escribes una que no existe,
              queda vacía y el envío no se rompe.
            </p>
            <div class="flex flex-wrap gap-1.5">
              @for (v of variables; track v) {
                <button
                  type="button"
                  class="cursor-pointer rounded-md border border-border-default bg-surface px-2 py-1 text-2xs font-mono text-text-secondary transition-colors hover:bg-subtle"
                  (click)="insertarVariable(v)"
                >
                  {{ '{{' + v + '}}' }}
                </button>
              }
            </div>
          </div>

          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="cursor-pointer"
              [ngModel]="draft().active"
              (ngModelChange)="patch({ active: $event })"
            />
            <span class="text-xs text-text-secondary">
              Disponible al redactar (destildar la archiva sin borrarla)
            </span>
          </label>
        } @else {
          <!-- ── Lista ─────────────────────────────────────────────────── -->
          <h3 class="section-title">Plantillas de comunicado</h3>

          @if (facade.isLoading()) {
            <div class="flex flex-col gap-3">
              @for (i of [0, 1, 2]; track i) {
                <app-skeleton-block variant="text" width="70%" height="15px" />
              }
            </div>
          } @else if (facade.templates().length === 0) {
            <app-empty-state
              icon="file-text"
              message="Todavía no hay plantillas"
              subtitle="Crea una para no reescribir los comunicados que se repiten."
            />
          } @else {
            <ul class="card p-0 overflow-hidden divide-y divide-border-subtle">
              @for (t of facade.templates(); track t.id) {
                <li class="flex items-center gap-3 px-3 py-2.5">
                  <div class="min-w-0 flex-1 space-y-0.5">
                    <div class="flex items-center gap-2">
                      <p class="item-title truncate">{{ t.name }}</p>
                      @if (!t.active) {
                        <app-badge variant="neutral">Archivada</app-badge>
                      }
                    </div>
                    <p class="text-xs text-text-muted truncate">{{ t.subject }}</p>
                    @if (t.usedVariables.length > 0) {
                      <p class="text-2xs font-mono text-text-muted">
                        {{ formatVariables(t.usedVariables) }}
                      </p>
                    }
                  </div>
                  <button
                    type="button"
                    class="cursor-pointer rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-subtle"
                    [attr.aria-label]="'Editar ' + t.name"
                    (click)="editar(t)"
                  >
                    <app-icon name="pencil" [size]="15" />
                  </button>
                  <button
                    type="button"
                    class="cursor-pointer rounded-lg p-1.5 text-error transition-colors hover:bg-subtle"
                    [attr.aria-label]="'Eliminar ' + t.name"
                    data-llm-action="eliminar-plantilla"
                    (click)="eliminar(t)"
                  >
                    <app-icon name="trash-2" [size]="15" />
                  </button>
                </li>
              }
            </ul>
          }
        }

        @if (facade.error()) {
          <div class="flex items-center gap-2 rounded-lg px-3 py-2 bg-error-subtle">
            <app-icon name="alert-circle" [size]="14" color="var(--state-error)" />
            <span class="text-xs text-error">{{ facade.error() }}</span>
          </div>
        }
      </div>

      <ng-container ngProjectAs="[drawer-form-footer]">
        @if (editing()) {
          <button type="button" class="btn-secondary" (click)="cancelarEdicion()">Volver</button>
          <button
            type="button"
            class="btn-primary flex items-center justify-center gap-2"
            [disabled]="!puedeGuardar()"
            [appStableWidth]="facade.isSaving()"
            data-llm-action="guardar-plantilla"
            (click)="guardar()"
          >
            @if (facade.isSaving()) {
              <app-icon name="loader-circle" [size]="16" class="animate-spin" />
              Guardando…
            } @else {
              <app-icon name="check" [size]="16" />
              Guardar
            }
          </button>
        } @else {
          <button type="button" class="btn-secondary" (click)="drawer.close()">Cerrar</button>
          <button
            type="button"
            class="btn-primary flex items-center justify-center gap-2"
            (click)="nueva()"
          >
            <app-icon name="plus" [size]="16" />
            Nueva plantilla
          </button>
        }
      </ng-container>
    </app-drawer-form>
  `,
})
export class TemplateManagerDrawerComponent {
  protected readonly facade = inject(NotificationTemplatesFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly confirmModal = inject(ConfirmModalService);

  protected readonly variables = TEMPLATE_VARIABLES;

  /** Sin la referencia al textarea no hay cursor que respetar (AC10). */
  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');

  protected readonly editing = signal(false);
  protected readonly draft = signal<TemplateDraft>({ ...DRAFT_VACIO });

  protected readonly puedeGuardar = computed(() => {
    const d = this.draft();
    return (
      d.name.trim().length > 0 &&
      d.subject.trim().length > 0 &&
      d.body.trim().length > 0 &&
      !this.facade.isSaving()
    );
  });

  constructor() {
    void this.facade.initialize();
  }

  protected formatVariables(vars: readonly string[]): string {
    return vars.map((v) => `{{${v}}}`).join(' ');
  }

  protected patch(cambio: Partial<TemplateDraft>): void {
    this.draft.update((d) => ({ ...d, ...cambio }));
  }

  /**
   * Inserta el marcador donde está el cursor (spec 0043-b, AC10).
   *
   * El textarea usa `[ngModel]` de una vía, así que después de mover el modelo hay que
   * reponer el DOM y el cursor a mano: si no, el caret se va al final del texto y el botón
   * sigue obligando a cortar y pegar, que es justo lo que venía a evitar. Se escribe el
   * valor antes de devolver el foco porque asignar el mismo string después no reubica el
   * caret, pero asignar uno distinto sí lo mandaría al final.
   */
  protected insertarVariable(variable: string): void {
    const el = this.bodyInput()?.nativeElement;
    const actual = el?.value ?? this.draft().body;

    const { text, caret } = insertAtCursor(
      actual,
      `{{${variable}}}`,
      el?.selectionStart ?? null,
      el?.selectionEnd ?? null,
    );

    this.patch({ body: text });

    if (el) {
      el.value = text;
      el.focus();
      el.setSelectionRange(caret, caret);
    }
  }

  protected nueva(): void {
    this.facade.clearError();
    this.draft.set({ ...DRAFT_VACIO });
    this.editing.set(true);
  }

  protected editar(t: TemplateRow): void {
    this.facade.clearError();
    this.draft.set({
      id: t.id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      active: t.active,
    });
    this.editing.set(true);
  }

  protected cancelarEdicion(): void {
    this.facade.clearError();
    this.editing.set(false);
  }

  protected async guardar(): Promise<void> {
    if (await this.facade.save(this.draft())) this.editing.set(false);
  }

  protected async eliminar(t: TemplateRow): Promise<void> {
    const confirmado = await this.confirmModal.confirm({
      title: 'Eliminar plantilla',
      message: `Se va a eliminar "${t.name}". Los comunicados ya enviados con ella no se tocan.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });
    if (confirmado) await this.facade.remove(t.id);
  }
}
