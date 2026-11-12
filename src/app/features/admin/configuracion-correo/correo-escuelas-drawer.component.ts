import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { BranchEmailFacade } from '@core/facades/branch-email.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import {
  SENDER_DOMAIN,
  validateBranchEmailForm,
  type BranchEmailFormErrors,
} from '@core/utils/branch-email.utils';
import type { BranchEmailForm } from '@core/models/ui/branch-email-config.model';

const FIELDS: (keyof BranchEmailForm)[] = ['senderName', 'senderAddress', 'replyTo', 'phone'];

/**
 * Correo de las escuelas (spec 0061-b, AC11/AC12/AC-E6). Solo admin (lo abre
 * `AjustesDrawerComponent` bajo `@if (isAdmin())`).
 *
 * Una tarjeta por escuela con lo que define a nombre de quién salen sus correos: nombre visible,
 * dirección de envío (solo @gestordeautoescuelas.cl), correo de respuesta y teléfono del pie. Los
 * correos siguientes usan los valores nuevos sin redesplegar nada.
 *
 * Clon estructural de `TarifaInstructoresDrawerComponent`.
 */
@Component({
  selector: 'app-correo-escuelas-drawer',
  standalone: true,
  imports: [
    FormsModule,
    IconComponent,
    SkeletonBlockComponent,
    DrawerFormComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .field-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
  `,
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      <!-- Header -->
      <div class="shrink-0 border-b border-border-subtle p-5 mb-4">
        <h2 class="text-lg font-bold text-text-primary">Correo de las Escuelas</h2>
        <p class="mt-1 text-sm text-text-muted">
          A nombre de quién salen los correos de cada escuela (contratos, certificados, Zoom,
          comunicados) y a dónde llegan las respuestas de los alumnos.
        </p>
      </div>

      <app-drawer-form>
        <div class="space-y-4">
          @if (facade.isLoading()) {
            <app-skeleton-block variant="rect" width="100%" height="220px" />
            <app-skeleton-block variant="rect" width="100%" height="220px" />
          } @else if (facade.configs().length === 0) {
            @if (facade.error(); as error) {
              <app-empty-state
                [message]="error"
                icon="building-2"
                actionLabel="Reintentar"
                actionIcon="refresh-cw"
                (action)="reload()"
              />
            } @else {
              <app-empty-state message="No hay escuelas registradas." icon="building-2" />
            }
          } @else {
            @for (config of facade.configs(); track config.branchId) {
              <div class="card space-y-3">
                <p class="item-title">{{ config.branchName }}</p>

                <label class="block space-y-1">
                  <span class="micro-label">Nombre visible del remitente</span>
                  <input
                    type="text"
                    class="field-input"
                    [ngModel]="formFor(config.branchId).senderName"
                    (ngModelChange)="setField(config.branchId, 'senderName', $event)"
                    [placeholder]="config.branchName"
                    data-llm-description="input for the sender display name of this school's emails"
                  />
                </label>

                <label class="block space-y-1">
                  <span class="micro-label">Dirección de envío</span>
                  <input
                    type="email"
                    class="field-input"
                    [ngModel]="formFor(config.branchId).senderAddress"
                    (ngModelChange)="setField(config.branchId, 'senderAddress', $event)"
                    [placeholder]="'escuela@' + senderDomain"
                    data-llm-description="input for the sender address of this school's emails, must be on the authenticated platform domain"
                  />
                  @if (errorsFor(config.branchId).senderAddress; as error) {
                    <p class="field-error">{{ error }}</p>
                  } @else {
                    <p class="text-xs text-text-muted">
                      Solo &#64;{{ senderDomain }}. Si la dejas vacía, sale desde la dirección
                      general de la plataforma con el nombre de la escuela.
                    </p>
                  }
                </label>

                <label class="block space-y-1">
                  <span class="micro-label">Correo de respuesta</span>
                  <input
                    type="email"
                    class="field-input"
                    [ngModel]="formFor(config.branchId).replyTo"
                    (ngModelChange)="setField(config.branchId, 'replyTo', $event)"
                    placeholder="contacto@escuela.cl"
                    data-llm-description="input for the reply-to address where students' replies arrive"
                  />
                  @if (errorsFor(config.branchId).replyTo; as error) {
                    <p class="field-error">{{ error }}</p>
                  } @else {
                    <p class="text-xs text-text-muted">
                      Ahí llegan las respuestas de los alumnos. Puede ser de cualquier dominio.
                    </p>
                  }
                </label>

                <label class="block space-y-1">
                  <span class="micro-label">Teléfono del pie</span>
                  <input
                    type="tel"
                    class="field-input"
                    [ngModel]="formFor(config.branchId).phone"
                    (ngModelChange)="setField(config.branchId, 'phone', $event)"
                    placeholder="+56 42 000 0000"
                    data-llm-description="input for the phone number shown in the footer of this school's emails"
                  />
                </label>

                <div class="flex flex-wrap justify-end gap-2 pt-1">
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="!canSendTest(config.branchId)"
                    [attr.title]="
                      isDirty(config.branchId) ? 'Guarda los cambios antes de probar' : null
                    "
                    data-llm-action="enviar-correo-prueba-escuela"
                    (click)="sendTest(config.branchId)"
                  >
                    @if (testingBranchId() === config.branchId) {
                      <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                      <span>Enviando…</span>
                    } @else {
                      <app-icon name="send" [size]="14" />
                      <span>Enviar correo de prueba</span>
                    }
                  </button>
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="!canSave(config.branchId)"
                    data-llm-action="guardar-correo-escuela"
                    (click)="save(config.branchId)"
                  >
                    @if (savingBranchId() === config.branchId) {
                      <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                      <span>Guardando…</span>
                    } @else {
                      <app-icon name="save" [size]="14" />
                      <span>Guardar</span>
                    }
                  </button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        <ng-container ngProjectAs="[drawer-form-footer]">
          <button type="button" class="btn-secondary" (click)="close()">Cerrar</button>
        </ng-container>
      </app-drawer-form>
    </div>
  `,
})
export class CorreoEscuelasDrawerComponent {
  protected readonly facade = inject(BranchEmailFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly senderDomain = SENDER_DOMAIN;
  /** Borradores por escuela; sin entrada = sin cambios. */
  private readonly drafts = signal<Record<number, BranchEmailForm>>({});
  protected readonly savingBranchId = signal<number | null>(null);
  protected readonly testingBranchId = signal<number | null>(null);

  constructor() {
    void this.facade.load();
  }

  protected reload(): void {
    void this.facade.load();
  }

  /** Lo que muestra el formulario: el borrador si existe, si no lo guardado. */
  protected formFor(branchId: number): BranchEmailForm {
    const draft = this.drafts()[branchId];
    if (draft) return draft;
    const saved = this.facade.configs().find((c) => c.branchId === branchId);
    return {
      senderName: saved?.senderName ?? null,
      senderAddress: saved?.senderAddress ?? null,
      replyTo: saved?.replyTo ?? null,
      phone: saved?.phone ?? null,
    };
  }

  protected setField(branchId: number, field: keyof BranchEmailForm, value: string | null): void {
    const next = { ...this.formFor(branchId), [field]: value };
    this.drafts.update((d) => ({ ...d, [branchId]: next }));
  }

  protected errorsFor(branchId: number): BranchEmailFormErrors {
    return validateBranchEmailForm(this.formFor(branchId));
  }

  protected isDirty(branchId: number): boolean {
    const draft = this.drafts()[branchId];
    if (!draft) return false;
    const saved = this.facade.configs().find((c) => c.branchId === branchId);
    const norm = (v: string | null | undefined) => (v ?? '').trim();
    return FIELDS.some((f) => norm(draft[f]) !== norm(saved?.[f]));
  }

  protected canSave(branchId: number): boolean {
    return (
      this.isDirty(branchId) &&
      Object.keys(this.errorsFor(branchId)).length === 0 &&
      !this.facade.isSaving()
    );
  }

  /** AC12 prueba lo GUARDADO: con cambios pendientes, primero hay que guardar. */
  protected canSendTest(branchId: number): boolean {
    return !this.isDirty(branchId) && !this.facade.isSendingTest();
  }

  protected async save(branchId: number): Promise<void> {
    if (!this.canSave(branchId)) return;
    this.savingBranchId.set(branchId);
    const ok = await this.facade.save(branchId, this.formFor(branchId));
    this.savingBranchId.set(null);
    if (ok) {
      this.drafts.update((d) => {
        const next = { ...d };
        delete next[branchId];
        return next;
      });
    }
  }

  protected async sendTest(branchId: number): Promise<void> {
    if (!this.canSendTest(branchId)) return;
    this.testingBranchId.set(branchId);
    await this.facade.enviarPrueba(branchId);
    this.testingBranchId.set(null);
  }

  protected close(): void {
    this.layoutDrawer.back();
  }
}
